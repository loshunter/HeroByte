// ============================================================================
// EXPLORED FOG STORE (S7) — what this player remembers seeing
// ============================================================================
// A per-player, per-table, per-map accumulated union of everywhere their own
// tokens have ever had line of sight, kept in localStorage.
//
// THIS IS A RENDERING CONVENIENCE, NOT A PRIVACY BOUNDARY. It exists so a
// corridor you have already walked reads as "remembered" rather than "never
// seen", and it can only ever re-show map ART the client already holds. The
// server keeps stripping every entity outside CURRENT vision exactly as it did
// before — a remembered room may show remembered walls, but it must never show
// the monster that walked into it while you were away. Nothing in this file is
// allowed to become the reason something is or is not sent.
//
// Client-local by deliberate choice (arc S7): a per-player visibility grid in
// RoomState would be a new persisted collection, a new SNAPSHOT_LIMITS entry,
// and a per-player namespace inside shared state — a persistence arc for
// something whose whole value is that it is yours. The cost is that it does not
// follow you to another device, which is the same trade S5 made for macros.

/**
 * Keyed per TABLE and per PLAYER and per MAP DOCUMENT.
 *
 * The room segment is not optional: switching tables is a same-tab navigation,
 * and a flat key is exactly how the room-secret store once auto-submitted the
 * previous table's password at a new one. Here the same bug would bleed one
 * table's explored area onto another — a privacy-shaped leak, not just a bad
 * prompt.
 *
 * `sourceDocumentId` is arbitrary trimmed text by contract, so it is
 * percent-encoded before joining: a `:` inside it would forge a key segment.
 */
const KEY_PREFIX = "herobyte:fog-explored:v1";
const INDEX_KEY = "herobyte:fog-explored:v1:index";
/** How many maps a player keeps memory of before the oldest is dropped. */
const MAX_REMEMBERED_MAPS = 6;
/**
 * The mask's longest side. Caps a single entry at 512*512 bits = 32KB packed,
 * ~44KB of base64, against a ~5MB origin quota — so six of them cannot fill it.
 * No existing client store caps by BYTES (all seven cap by entry count), so
 * this constant is new and the reason is written down here.
 */
export const MASK_MAX_DIMENSION = 512;
/** Never coarser than this many document pixels per mask cell (~1/6 of a grid square). */
const MIN_MASK_CELL = 8;

export interface ExploredMaskMeta {
  /** Document pixels per mask cell. */
  cell: number;
  /** Mask dimensions in cells. */
  cols: number;
  rows: number;
}

export interface StoredExploredMask extends ExploredMaskMeta {
  /** Scene document size the mask was built for; a resize invalidates it. */
  sceneWidth: number;
  sceneHeight: number;
  /** One bit per mask cell, row-major, packed LSB-first, base64-encoded. */
  bits: Uint8Array;
}

/**
 * Mask resolution for a scene, in DOCUMENT pixels — the unit `CompiledScene`
 * width/height are in. Not device pixels: the fog layer draws this as one
 * upscaled image and Konva already applies the device pixel ratio once at the
 * Stage, so scaling here would multiply memory for no visible gain.
 */
export function maskGeometryFor(sceneWidth: number, sceneHeight: number): ExploredMaskMeta {
  const longest = Math.max(sceneWidth, sceneHeight, 1);
  const cell = Math.max(MIN_MASK_CELL, Math.ceil(longest / MASK_MAX_DIMENSION));
  return {
    cell,
    cols: Math.max(1, Math.ceil(sceneWidth / cell)),
    rows: Math.max(1, Math.ceil(sceneHeight / cell)),
  };
}

export function exploredFogKey(
  roomId: string | undefined,
  uid: string,
  sourceDocumentId: string,
): string {
  // A bare prefix would be the default table's sentinel, but the uid and
  // document segments follow, so the default table just spells itself out.
  return [KEY_PREFIX, roomId ?? "default", uid, encodeURIComponent(sourceDocumentId)].join(":");
}

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function packBits(bits: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bits.length; i += 1) {
    binary += String.fromCharCode(bits[i]!);
  }
  return btoa(binary);
}

function unpackBits(encoded: string, byteLength: number): Uint8Array | null {
  try {
    const binary = atob(encoded);
    if (binary.length !== byteLength) return null;
    const bits = new Uint8Array(byteLength);
    for (let i = 0; i < byteLength; i += 1) {
      bits[i] = binary.charCodeAt(i);
    }
    return bits;
  } catch {
    return null;
  }
}

export function byteLengthFor(meta: ExploredMaskMeta): number {
  return Math.ceil((meta.cols * meta.rows) / 8);
}

/**
 * Read this player's memory of one map, or null when there is none to trust.
 *
 * Re-validated against the CURRENT scene, not merely parsed: a stored mask
 * whose resolution or scene size no longer matches describes a different map
 * and is dropped. `sourceRevision` is deliberately NOT part of that check — a
 * live-bound table recompiles the scene on EVERY applied DM command, so keying
 * on it would wipe the whole party's memory on every brush stroke. A republish
 * that changes the document id or its size still invalidates.
 */
export function loadExploredMask(
  key: string,
  expected: ExploredMaskMeta & {
    sceneWidth: number;
    sceneHeight: number;
  },
): Uint8Array | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    if (
      record.cell !== expected.cell ||
      record.cols !== expected.cols ||
      record.rows !== expected.rows ||
      record.sceneWidth !== expected.sceneWidth ||
      record.sceneHeight !== expected.sceneHeight ||
      typeof record.bits !== "string"
    ) {
      return null;
    }
    return unpackBits(record.bits, byteLengthFor(expected));
  } catch {
    return null;
  }
}

/** Persist this player's memory. A full or disabled store must never break play. */
export function saveExploredMask(
  key: string,
  meta: ExploredMaskMeta & { sceneWidth: number; sceneHeight: number },
  bits: Uint8Array,
): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify({ ...meta, bits: packBits(bits) }));
    touchIndex(store, key);
  } catch {
    // Quota, private mode, or a disabled store. Memory fog is a nicety; losing
    // it must not cost the frame it was drawn on.
  }
}

/**
 * An LRU index over the keys this store has written, so a player who has
 * visited many maps does not accumulate one entry per map forever. No other
 * client store prunes by prefix — there was no prior art to copy, so the index
 * is explicit rather than a scan.
 */
function touchIndex(store: Storage, key: string): void {
  try {
    const parsed: unknown = JSON.parse(store.getItem(INDEX_KEY) ?? "[]");
    const keys = Array.isArray(parsed)
      ? parsed.filter((k): k is string => typeof k === "string")
      : [];
    const next = [key, ...keys.filter((k) => k !== key)];
    for (const stale of next.slice(MAX_REMEMBERED_MAPS)) {
      store.removeItem(stale);
    }
    store.setItem(INDEX_KEY, JSON.stringify(next.slice(0, MAX_REMEMBERED_MAPS)));
  } catch {
    // An unreadable index costs pruning, not correctness.
  }
}

/** Forget one map — used when the stored mask fails validation. */
export function clearExploredMask(key: string): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    // Nothing to do; the stale entry will be pruned by the LRU eventually.
  }
}
