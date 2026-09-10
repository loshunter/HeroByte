// ============================================================================
// KEYBOARD MOVEMENT — the pure half
// ============================================================================
// One press moves the selection exactly one grid cell. Everything here is a
// pure function over the snapshot so the hook stays a thin listener and the
// rules (which keys, who may move what, where a chained press starts from)
// are testable without a DOM.
//
// The MOVE is always one cell, and the wire is RELATIVE (`step-object` carries
// a direction): where the cell IS is the server's business, and so is what it
// COSTS against a movement budget (movementCharge, under the diagonal rule).

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
      const prop = snapshot.props?.find((candidate) => candidate.id === id.slice(5));
      if (!prop) continue;
      // TransformHandler's rule: a shared ("*") prop moves for everyone; your
      // own only while the table's player-props switch is on.
      const mayMove =
        isDM || prop.owner === "*" || (snapshot.playerPropsEnabled === true && prop.owner === uid);
      if (!mayMove) continue;
      out.push({ id, x: prop.x, y: prop.y });
    }
  }
  return out;
}
