// Movement blocking against the compiled scene. Every server path that moves
// a token (legacy "move" messages, scene-object transforms) funnels through
// this check so walls and shut doors stay physically real regardless of which
// message a client speaks.
//
// Units: tokens live in GRID-CELL coordinates while compiled geometry lives
// in map pixels; both positions are converted to world pixels (cell centers)
// before the segment test, mirroring the client renderer.

import { findBlockingSegment, gridCellToWorldPoint, type ScenePoint } from "@herobyte/shared";
import type { RoomState } from "../model.js";

export function isTokenMoveBlocked(
  state: RoomState,
  fromCell: ScenePoint,
  toCell: ScenePoint,
): boolean {
  if (!state.compiledScene) {
    return false;
  }
  const mapTransform = state.sceneObjects.find((object) => object.type === "map")?.transform;
  return (
    findBlockingSegment(
      state.compiledScene,
      gridCellToWorldPoint(state.gridSize, fromCell),
      gridCellToWorldPoint(state.gridSize, toCell),
      mapTransform,
    ) !== null
  );
}
