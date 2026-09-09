// ============================================================================
// KEYBOARD MOVEMENT — the pure half
// ============================================================================
// One press moves the selection exactly one grid cell. Everything here is a
// pure function over the snapshot so the hook stays a thin listener and the
// rules (which keys, who may move what, where a chained press starts from)
// are testable without a DOM.
//
// The MOVE is always one cell. What that cell COSTS against a movement budget
// is the server's business (movementCharge, under the table's diagonal rule).

import type { RoomSnapshot } from "@herobyte/shared";

export interface CellDelta {
  dx: -1 | 0 | 1;
  dy: -1 | 0 | 1;
}

/** A selected object the actor is allowed to move, with its current cell. */
export interface MovableSelection {
  /** Scene-object id (`token:…` / `prop:…`) — what `transform-object` takes. */
  id: string;
  x: number;
  y: number;
}

// Screen-up is smaller y (Konva's y grows downward). WASD and the arrows are
// the four orthogonals; Q/E/Z/C and the numpad corners are the diagonals, so
// a diagonal step is one press rather than two — which is what lets the
// budget charge it by the table's diagonal rule.
const KEY_DELTAS: Record<string, CellDelta> = {
  arrowup: { dx: 0, dy: -1 },
  arrowdown: { dx: 0, dy: 1 },
  arrowleft: { dx: -1, dy: 0 },
  arrowright: { dx: 1, dy: 0 },
  w: { dx: 0, dy: -1 },
  s: { dx: 0, dy: 1 },
  a: { dx: -1, dy: 0 },
  d: { dx: 1, dy: 0 },
  q: { dx: -1, dy: -1 },
  e: { dx: 1, dy: -1 },
  z: { dx: -1, dy: 1 },
  c: { dx: 1, dy: 1 },
};

const NUMPAD_DELTAS: Record<string, CellDelta> = {
  Numpad8: { dx: 0, dy: -1 },
  Numpad2: { dx: 0, dy: 1 },
  Numpad4: { dx: -1, dy: 0 },
  Numpad6: { dx: 1, dy: 0 },
  Numpad7: { dx: -1, dy: -1 },
  Numpad9: { dx: 1, dy: -1 },
  Numpad1: { dx: -1, dy: 1 },
  Numpad3: { dx: 1, dy: 1 },
};

/**
 * The cell delta a key names, or null when the key is not a movement key.
 * Modifier and repeat handling is the caller's (the guard lives in the hook).
 */
export function deltaForKey(event: Pick<KeyboardEvent, "key" | "code">): CellDelta | null {
  return NUMPAD_DELTAS[event.code] ?? KEY_DELTAS[event.key.toLowerCase()] ?? null;
}

export interface MovableSelectionInput {
  selectedObjectIds: readonly string[];
  snapshot: RoomSnapshot | null;
  uid: string;
  isDM: boolean;
}

/**
 * The selected objects this actor may move, mirroring the server's
 * TransformHandler rules so a press that the server would refuse sends
 * nothing: a token is the owner's or the DM's; a prop is the DM's, its
 * owner's, or everyone's (`owner: "*"`) — and, for a player, only while the
 * table's player-props switch is on; a locked object is the DM's only. The
 * server remains the guard — this only avoids dead round trips.
 */
export function movableSelection({
  selectedObjectIds,
  snapshot,
  uid,
  isDM,
}: MovableSelectionInput): MovableSelection[] {
  if (!snapshot) return [];
  const out: MovableSelection[] = [];
  for (const id of selectedObjectIds) {
    const locked = snapshot.sceneObjects?.find((object) => object.id === id)?.locked === true;
    if (locked && !isDM) continue;
    if (id.startsWith("token:")) {
      const token = snapshot.tokens?.find((candidate) => candidate.id === id.slice(6));
      if (!token || (!isDM && token.owner !== uid)) continue;
      out.push({ id, x: token.x, y: token.y });
    } else if (id.startsWith("prop:")) {
      if (!isDM && snapshot.playerPropsEnabled !== true) continue;
      const prop = snapshot.props?.find((candidate) => candidate.id === id.slice(5));
      if (!prop || (!isDM && prop.owner !== "*" && prop.owner !== uid)) continue;
      out.push({ id, x: prop.x, y: prop.y });
    }
  }
  return out;
}

/**
 * What the presses in flight have asked for, so the next press can chain
 * from it while the snapshot is still catching up. Two quick presses would
 * otherwise both start from the same origin and the second would land on the
 * first's cell — a lost step on any real latency.
 *
 * A chain is one DIRECTION: every step in it is `delta` from the last, so
 * the path from `from` to `to` is a straight line the snapshot walks along
 * as the server confirms each step.
 */
export interface PendingStep {
  /** The snapshot cell the chain started from. */
  from: { x: number; y: number };
  /** The cell the last press asked for. */
  to: { x: number; y: number };
  delta: CellDelta;
  /** When the FIRST unconfirmed step of this chain was sent. */
  startedAt: number;
}

/** How long a chain is trusted, from its FIRST unconfirmed step. */
export const PENDING_STEP_TTL_MS = 1500;
/** Presses a chain may run ahead of the snapshot (~600 ms of round trip). */
export const PENDING_STEP_MAX_DEPTH = 4;

const sameDelta = (a: CellDelta, b: CellDelta) => a.dx === b.dx && a.dy === b.dy;

/**
 * Where a press starts from: the chain's last target, or the snapshot.
 *
 * The chain is trusted only while ALL of these hold — it is the same
 * direction as this press; it is younger than the TTL, counted from its first
 * unconfirmed step (a refused step never confirms, so a held key against a
 * wall cannot keep a chain alive by pressing); it has not run more than
 * PENDING_STEP_MAX_DEPTH cells ahead of the snapshot; and the snapshot cell
 * lies ON its path (the chain's start, any confirmed step, or its target).
 * Anything else — a turn, a stale chain, a snapshot elsewhere — starts over
 * from where the token really is, so a refused chain can never be the origin
 * of a press in another direction (that is how a token used to teleport).
 */
export function stepOrigin(
  current: { x: number; y: number },
  pending: PendingStep | undefined,
  delta: CellDelta,
  now: number,
): { x: number; y: number } {
  if (!pending || !sameDelta(pending.delta, delta)) return current;
  if (now - pending.startedAt > PENDING_STEP_TTL_MS) return current;
  const ahead = Math.max(Math.abs(pending.to.x - current.x), Math.abs(pending.to.y - current.y));
  if (ahead >= PENDING_STEP_MAX_DEPTH) return current;
  // On the path: current = from + k·delta for some 0 ≤ k ≤ length.
  const { dx, dy } = pending.delta;
  const length = Math.max(
    Math.abs(pending.to.x - pending.from.x),
    Math.abs(pending.to.y - pending.from.y),
  );
  const kx = dx === 0 ? null : (current.x - pending.from.x) / dx;
  const ky = dy === 0 ? null : (current.y - pending.from.y) / dy;
  const k = kx ?? ky;
  if (k === null || !Number.isInteger(k) || k < 0 || k > length) return current;
  if (kx !== null && ky !== null && kx !== ky) return current;
  if (dx === 0 && current.x !== pending.from.x) return current;
  if (dy === 0 && current.y !== pending.from.y) return current;
  return pending.to;
}

/** The chain after a press that starts from `origin` and asks for `to`. */
export function nextPendingStep(
  current: { x: number; y: number },
  origin: { x: number; y: number },
  to: { x: number; y: number },
  delta: CellDelta,
  pending: PendingStep | undefined,
  now: number,
): PendingStep {
  // Continued only while something is still unconfirmed: once the snapshot
  // has caught up with the chain's target, a new chain starts here and now.
  const continued =
    pending !== undefined &&
    origin.x === pending.to.x &&
    origin.y === pending.to.y &&
    (current.x !== origin.x || current.y !== origin.y);
  return continued
    ? { from: pending.from, to, delta, startedAt: pending.startedAt }
    : { from: current, to, delta, startedAt: now };
}
