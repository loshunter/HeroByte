// ============================================================================
// KEYBOARD MOVEMENT — the pure half
// ============================================================================
// One press moves the selection exactly one grid cell. Everything here is a
// pure function over the snapshot so the hook stays a thin listener and the
// rules (which keys, who may move what, where a chained press starts from)
// are testable without a DOM.
//
// The MOVE is always one cell. What that cell COSTS against a movement budget
// is a separate question (the diagonal rule) and deliberately not answered
// here — see the arc prompt's "keep the move and the charge separate".

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
// a diagonal step is one press rather than two — which is what lets a budget
// charge it by the table's diagonal rule later.
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
 * owner's, or everyone's (`owner: "*"`); a locked object is the DM's only.
 * The server remains the guard — this only avoids dead round trips.
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
      const prop = snapshot.props?.find((candidate) => candidate.id === id.slice(5));
      if (!prop || (!isDM && prop.owner !== "*" && prop.owner !== uid)) continue;
      out.push({ id, x: prop.x, y: prop.y });
    }
  }
  return out;
}

/**
 * What the last press sent for an object, so the next press can chain from
 * it while the snapshot is still catching up. Two quick presses would
 * otherwise both start from the same origin and the second would land on the
 * first's cell — a lost step on any real latency.
 */
export interface PendingStep {
  /** The snapshot cell the press started from. */
  from: { x: number; y: number };
  /** The cell it asked for. */
  to: { x: number; y: number };
  at: number;
}

/** How long a pending step is trusted before a press falls back to the snapshot. */
export const PENDING_STEP_TTL_MS = 1500;

/**
 * Where a press starts from. The snapshot, unless the last step is fresh and
 * the snapshot still shows the cell that step LEFT — then the step's target.
 * A refused step (a wall) means the snapshot never catches up, and the TTL
 * is what stops the chain drifting through the wall forever.
 */
export function stepOrigin(
  current: { x: number; y: number },
  pending: PendingStep | undefined,
  now: number,
): { x: number; y: number } {
  if (!pending || now - pending.at > PENDING_STEP_TTL_MS) return current;
  if (pending.from.x !== current.x || pending.from.y !== current.y) return current;
  return pending.to;
}
