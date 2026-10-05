// ============================================================================
// PIECE LOCK — the one rule every move and delete asks
// ============================================================================
// A locked token, prop or drawing cannot be moved or deleted by ANYONE, the DM
// included, until the DM unlocks it (owner, 2026-10-04). The lock lives on the
// piece's scene object (`token:<id>`, `prop:<id>`, `drawing:<id>`), set by
// LockingHandler and carried across rebuilds by id (SceneGraphBuilder).
//
// Only those three kinds: the map's scene object is locked by default and
// pointers are locked on every rebuild, and neither is a piece — a blanket rule
// would stop the DM aligning the map.

import type { RoomState } from "../model.js";

/** Scene-object ids the piece lock governs. */
const LOCKABLE_PIECE = /^(token|prop|drawing):/;

export function isLockablePiece(sceneId: string): boolean {
  return LOCKABLE_PIECE.test(sceneId);
}

/** Is this scene object a locked token, prop or drawing? */
export function isLockedPiece(state: Pick<RoomState, "sceneObjects">, sceneId: string): boolean {
  if (!isLockablePiece(sceneId)) return false;
  return state.sceneObjects.some((object) => object.id === sceneId && object.locked === true);
}

export const isTokenLocked = (state: Pick<RoomState, "sceneObjects">, tokenId: string) =>
  isLockedPiece(state, `token:${tokenId}`);
export const isPropLocked = (state: Pick<RoomState, "sceneObjects">, propId: string) =>
  isLockedPiece(state, `prop:${propId}`);
export const isDrawingLocked = (state: Pick<RoomState, "sceneObjects">, drawingId: string) =>
  isLockedPiece(state, `drawing:${drawingId}`);

/**
 * What a handler returns when the lock refused (part of) an action: the router
 * sends the sender one `locked-refused` frame. `kept` is set when a bulk action
 * went ahead and skipped these locked pieces.
 */
export interface LockRefusal {
  ids: string[];
  kept?: boolean;
}
