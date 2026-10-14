// ============================================================================
// ASSET QUOTA RESOLUTION
// ============================================================================
// The whole-store and per-room ceilings used to be hardcoded at 200MB/50MB —
// "the free-tier number", a fossil of the ephemeral-disk era that also produced
// the go-use-Imgur guidance. Production now runs a persistent disk, so the
// ceiling should track the disk it actually sits on. Resolution order:
//
//   1. Constructor options (tests, embedders) — always win, resolved silently.
//   2. HEROBYTE_ASSET_MAX_TOTAL_MB / HEROBYTE_ASSET_MAX_ROOM_MB — the operator.
//   3. Derived from statfs on the asset directory: what the store already
//      holds plus what the disk can still take, minus a reserve for the other
//      stores (state files are KB-scale, but the OS and headroom are not).
//   4. The old 200MB fallback, only when the disk cannot be measured at all.
//
// The per-room ceiling follows whichever total won (a quarter of it, floored
// at the old 50MB) unless set explicitly, so fairness scales with the disk.

import { mkdir, statfs } from "node:fs/promises";
import { AssetRejectedError, roomsOf, type StoredAsset } from "./assetTypes.js";
import { isAbandonedApply } from "./assetRoomClaims.js";

/**
 * How many bytes of abandoned apply-intent uploads a room carries free. A real
 * token creator abandons a picture rarely (one is 30-100 KB), so this is
 * ~50-150 of them; past it they count again. Without a cap, a client sending
 * the intent on every upload escapes the per-room quota and fills the shared
 * store (review finding): the cap holds it to the room limit plus this.
 */
export const ABANDONED_APPLY_ALLOWANCE_BYTES = 5 * 1024 * 1024;

/**
 * Bytes charged to one room: what it claims, less apply-intent uploads it
 * abandoned (the token creator's picture no sweep has seen used), up to
 * ABANDONED_APPLY_ALLOWANCE_BYTES. Those stay claimed and on the disk, so the
 * WHOLE-store total still counts them. A stamp a sweep later drops (the
 * picture was used after all) makes the bytes count again, with no quota
 * check: a table can sit over its limit until it frees space.
 */
export function roomChargedBytes(
  assets: Iterable<StoredAsset>,
  roomId: string,
  now: number = Date.now(),
): number {
  let claimed = 0;
  let abandoned = 0;
  for (const asset of assets) {
    if (!roomsOf(asset).includes(roomId)) continue;
    claimed += asset.size;
    if (isAbandonedApply(asset, roomId, now)) abandoned += asset.size;
  }
  return claimed - Math.min(abandoned, ABANDONED_APPLY_ALLOWANCE_BYTES);
}

export interface AssetQuotaLimits {
  maxTotalBytes: number;
  maxRoomBytes: number;
}

const MB = 1024 * 1024;
/** Headroom left for everything that is not the asset store. */
const RESERVE_BYTES = 256 * MB;
export const FALLBACK_TOTAL_BYTES = 200 * MB;
const ROOM_FLOOR_BYTES = 50 * MB;

/** Pure derivation, split out so the arithmetic is testable without a disk. */
export function deriveTotalFromDisk(input: {
  availBytes: number;
  capacityBytes: number;
  storeBytes: number;
}): number {
  // On a tiny disk a fixed reserve could eat most of it; never reserve more
  // than a quarter of the filesystem.
  const reserve = Math.min(RESERVE_BYTES, Math.floor(input.capacityBytes / 4));
  return Math.max(0, input.storeBytes + input.availBytes - reserve);
}

/** Room ceiling from a resolved total: a quarter, floored at the old 50MB
 * default, never above the total itself. */
export function roomBytesFromTotal(totalBytes: number): number {
  return Math.min(totalBytes, Math.max(ROOM_FLOOR_BYTES, Math.floor(totalBytes / 4)));
}

/**
 * Grace between a condemned asset losing its last claim and its bytes leaving
 * the disk. Long on purpose: it is the survival window for references no
 * server-side scan can see (My Stuff shelves, saved player files, another
 * table's pasted URL) to come back and resurrect the claim. 0 disables the
 * grace (immediate deletion).
 */
export function reclaimGraceMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.HEROBYTE_ASSET_RECLAIM_GRACE_HOURS;
  if (raw !== undefined && raw.trim() !== "") {
    const hours = Number(raw);
    if (Number.isFinite(hours) && hours >= 0) return hours * 60 * 60 * 1000;
    console.warn(
      `[Assets] Ignoring HEROBYTE_ASSET_RECLAIM_GRACE_HOURS="${raw}" — expected hours >= 0`,
    );
  }
  return 7 * 24 * 60 * 60 * 1000;
}

/** A positive number of megabytes, or undefined (with a warning for garbage). */
export function parseQuotaEnvMb(name: string, raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  const mb = Number(raw);
  if (!Number.isFinite(mb) || mb <= 0) {
    console.warn(`[Assets] Ignoring ${name}="${raw}" — expected a positive number of MB`);
    return undefined;
  }
  return Math.floor(mb * MB);
}

/**
 * Resolve both ceilings. Called lazily on the first quota check (inside the
 * service's mutation lock) and cached for the process lifetime — the disk is
 * measured once, not per upload.
 */
export async function resolveQuotaLimits(input: {
  directory: string;
  /** Bytes the store already holds, from the loaded index. */
  storeBytes: number;
  options: { maxTotalBytes?: number; maxRoomBytes?: number };
  env?: NodeJS.ProcessEnv;
}): Promise<AssetQuotaLimits> {
  const env = input.env ?? process.env;
  const envTotal = parseQuotaEnvMb("HEROBYTE_ASSET_MAX_TOTAL_MB", env.HEROBYTE_ASSET_MAX_TOTAL_MB);
  const envRoom = parseQuotaEnvMb("HEROBYTE_ASSET_MAX_ROOM_MB", env.HEROBYTE_ASSET_MAX_ROOM_MB);

  let totalBytes = input.options.maxTotalBytes ?? envTotal;
  let totalSource = input.options.maxTotalBytes !== undefined ? "option" : "env";
  if (totalBytes === undefined) {
    try {
      // The directory may not exist before the first upload; statfs needs it.
      await mkdir(input.directory, { recursive: true });
      const stats = await statfs(input.directory);
      totalBytes = deriveTotalFromDisk({
        availBytes: stats.bsize * stats.bavail,
        capacityBytes: stats.bsize * stats.blocks,
        storeBytes: input.storeBytes,
      });
      totalSource = "derived from disk";
    } catch (error) {
      totalBytes = FALLBACK_TOTAL_BYTES;
      totalSource = "fallback — disk not measurable";
      console.warn(`[Assets] Could not measure the disk under "${input.directory}":`, error);
    }
  }

  const roomBytes = input.options.maxRoomBytes ?? envRoom ?? roomBytesFromTotal(totalBytes);

  // Explicit options mean a test or an embedder — stay quiet. Everything else
  // is an operator-facing decision worth one boot log line.
  if (input.options.maxTotalBytes === undefined && input.options.maxRoomBytes === undefined) {
    console.log(
      `[Assets] Store quota: ${Math.round(totalBytes / MB)}MB total (${totalSource}), ` +
        `${Math.round(roomBytes / MB)}MB per table` +
        (envRoom !== undefined ? " (env)" : "") +
        ` — HEROBYTE_ASSET_MAX_TOTAL_MB / HEROBYTE_ASSET_MAX_ROOM_MB override`,
    );
  }

  return { maxTotalBytes: totalBytes, maxRoomBytes: roomBytes };
}

/**
 * Refuse an upload that would bust either ceiling.
 *
 * TWO quotas, and both are load-bearing. The per-room one is fairness: without
 * it one table's uploads returned 507 to every other table (a room's abandoned
 * token-creator uploads are exempt only up to ABANDONED_APPLY_ALLOWANCE_BYTES,
 * so it still bounds each table). The whole-store one is physics: the disk is
 * finite no matter how the rooms divide it, and it counts every byte.
 *
 * Call it INSIDE the service's runExclusive, which is what keeps the
 * read-then-write atomic: checking outside the lock would reintroduce the
 * quota TOCTOU that an earlier review already found here once.
 */
export function assertQuota(
  index: Record<string, StoredAsset>,
  incoming: number,
  roomId: string,
  limits: AssetQuotaLimits,
  /** Bytes the STORE gains: 0 when the file is already on disk. */
  storeIncoming: number = incoming,
): void {
  const assets = Object.values(index);
  const total = assets.reduce((sum, asset) => sum + asset.size, 0);
  if (total + storeIncoming > limits.maxTotalBytes) {
    throw new AssetRejectedError("Asset storage quota exceeded", 507);
  }
  const roomTotal = roomChargedBytes(assets, roomId);
  if (roomTotal + incoming > limits.maxRoomBytes) {
    throw new AssetRejectedError("This table's asset storage is full", 507);
  }
}
