// ============================================================================
// KEYBOARD MOVEMENT — the pure half
// ============================================================================
// One press moves the selection exactly one grid cell. Everything here is a
// pure function over the snapshot so the hook stays a thin listener and the
// rules (which keys, who may move what) are testable without a DOM.
//
// The MOVE is always one cell, and the wire is RELATIVE (`step-object` carries
// a direction and the ids, never a cell): where each cell IS is the server's
// business, and so is what a step COSTS against a movement budget
// (movementCharge, under the diagonal rule). Tokens and props only — a
// drawing's transform is in pixels, so "one cell" means nothing there.
//
// NOTHING SELECTED → YOUR OWN TOKEN (follow-up F4). Selection only lives in
// Select/Transform mode, so with the plain cursor a player had to arm Select
// and click their token before a key did anything. With an EMPTY selection
// the keys now stand in for "my token": the actor's ONE PC character's
// linked token — or, when that character predates linking, the ONE token of
// theirs that no character claims. Never a guess between two (the by-owner
// precedent in useCombatOrdering / MobileEntitiesList: with two characters a
// guess is wrong for one of them — and the same for two loose tokens). A
// non-empty selection the actor may not move is a deliberate selection of
// someone else's piece, not "nothing" — it stays inert.

import type { RoomSnapshot } from "@herobyte/shared";
import { looseOwnToken } from "../../utils/looseOwnToken";

export interface CellDelta {
  dx: -1 | 0 | 1;
  dy: -1 | 0 | 1;
}

/** A scene-object id (`token:…` / `prop:…`) the actor is allowed to move — what `step-object` names. */
export type MovableSelection = string;

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
 * The scene-object id of the actor's own token when nothing is selected, or
 * null when there is no single answer. The actor must run exactly ONE `pc`
 * character (a DM's own PC counts — F3 made it a combatant; an NPC is unowned
 * by every road the client drives, and an owned one is filtered by `type`
 * regardless). That character's linked token answers when
 * the snapshot has it; a link to a token the snapshot lacks (stashed by a
 * scene capture) answers nothing rather than guessing. Only when the
 * character predates linking (`tokenId` unset) does ownership decide, and
 * "owned by me" alone is NOT enough: every NPC token carries the uid of the
 * DM who placed it and is linked to its NPC character (placeNPCToken), so
 * the by-owner road considers only tokens no character claims — and exactly
 * one of them, because two is a guess. The id still goes through
 * `movableSelection`, so a locked own token stays a DM's to move, exactly as
 * if it had been clicked.
 */
export function ownTokenFallback({
  snapshot,
  uid,
}: Pick<MovableSelectionInput, "snapshot" | "uid">): MovableSelection | null {
  if (!snapshot) return null;
  const characters = snapshot.characters ?? [];
  const tokens = snapshot.tokens ?? [];
  const own = characters.filter(
    (character) => character.type === "pc" && character.ownedByPlayerUID === uid,
  );
  if (own.length !== 1) return null;
  const link = own[0].tokenId;
  if (link) {
    const linked = tokens.find((token) => token.id === link);
    return linked ? `token:${linked.id}` : null;
  }
  const loose = looseOwnToken(tokens, characters, uid);
  return loose ? `token:${loose.id}` : null;
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
      out.push(id);
    } else if (id.startsWith("prop:")) {
      const prop = snapshot.props?.find((candidate) => candidate.id === id.slice(5));
      if (!prop) continue;
      // TransformHandler's rule: a shared ("*") prop moves for everyone; your
      // own only while the table's player-props switch is on.
      const mayMove =
        isDM || prop.owner === "*" || (snapshot.playerPropsEnabled === true && prop.owner === uid);
      if (!mayMove) continue;
      out.push(id);
    }
  }
  return out;
}
