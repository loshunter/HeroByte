// ============================================================================
// PIECE LOCK — the one rule every move and delete asks
// ============================================================================
// A locked token, prop or drawing cannot be moved or deleted by ANYONE, the DM
// included, until the DM unlocks it (owner, 2026-10-04). The lock lives on the
// piece's scene object (`token:<id>`, `prop:<id>`, `drawing:<id>`), set by
// LockingHandler (lock-selected / unlock-selected) or the `locked` toggle on
// transform-object (TransformHandler), and carried across rebuilds by id.
//
// Only those three kinds: the map's scene object is locked by default and
// pointers are locked on every rebuild, and neither is a piece — a blanket rule
// would stop the DM aligning the map.
//
// Table-wide changes are not single moves and still win, by design: Restore
// table backup puts back the file's pieces (seated players keep their tokens as
// they stand), the Main Hall's idle wipe empties it, deleting a map in the map
// library deletes the pieces left on it, and travelling to another map carries
// the party's tokens, locked or not (to the arrival point when it warps) while
// everything else stays parked with the map it was on — locks included.
//
// A refusal is said only to someone who could otherwise have done it (the DM or
// the piece's owner): telling anyone else would confirm that a piece they cannot
// see still exists, and a refused move broadcasts.

import type { RoomState } from "../model.js";

type LockState = Pick<RoomState, "sceneObjects">;

/** Scene-object ids the piece lock governs. */
const LOCKABLE_PIECE = /^(token|prop|drawing):/;

export function isLockablePiece(sceneId: string): boolean {
  return LOCKABLE_PIECE.test(sceneId);
}

/** Is this scene object a locked token, prop or drawing? */
export function isLockedPiece(state: LockState, sceneId: string): boolean {
  if (!isLockablePiece(sceneId)) return false;
  return state.sceneObjects.some((object) => object.id === sceneId && object.locked === true);
}

/** Every locked piece's scene id, in one pass — for an action that asks per piece. */
export function lockedPieceIds(state: LockState): Set<string> {
  return new Set(
    state.sceneObjects.filter((o) => o.locked === true && isLockablePiece(o.id)).map((o) => o.id),
  );
}

/**
 * Locked on the table OR parked with another map (a scene the party travelled away
 * from keeps its stayers' locks): an NPC whose token waits on that map is still
 * standing on a locked token, and deleting it would drop the token on return.
 */
export function isTokenLockedAnywhere(
  state: Pick<RoomState, "sceneObjects" | "sceneStates">,
  tokenId: string,
): boolean {
  const id = `token:${tokenId}`;
  if (isLockedPiece(state, id)) return true;
  return Object.values(state.sceneStates ?? {}).some((scene) =>
    (scene.sceneObjects ?? []).some((object) => object.id === id && object.locked === true),
  );
}

export const isTokenLocked = (state: LockState, tokenId: string) =>
  isLockedPiece(state, `token:${tokenId}`);
export const isPropLocked = (state: LockState, propId: string) =>
  isLockedPiece(state, `prop:${propId}`);
export const isDrawingLocked = (state: LockState, drawingId: string) =>
  isLockedPiece(state, `drawing:${drawingId}`);

/**
 * What a handler returns when the lock refused (part of) an action: the router
 * sends the sender one `locked-refused` frame. `kept` is set when a bulk action
 * went ahead and skipped these locked pieces.
 */
export interface LockRefusal {
  ids: string[];
  kept?: boolean;
  /** The lock is on a token parked with another map, out of the client's sight. */
  elsewhere?: boolean;
}

/**
 * After a clear that removed every other player, the locked tokens it kept pass to the
 * DM who cleared — except a player character's token its own player still owns (the
 * character survives a clear, so the token stays theirs). An NPC's token a departed
 * co-DM placed passes to the DM, as REMOVE's do: the uid must not keep driving it.
 */
export function handKeptTokensTo(
  state: Pick<RoomState, "tokens" | "characters">,
  dmUid: string,
): void {
  const ownCharacterToken = new Set(
    state.characters
      .filter((c) => c.tokenId && c.ownedByPlayerUID)
      .map((c) => `${c.tokenId}|${c.ownedByPlayerUID}`),
  );
  for (const token of state.tokens) {
    if (token.owner === dmUid || ownCharacterToken.has(`${token.id}|${token.owner}`)) continue;
    token.owner = dmUid;
  }
}
