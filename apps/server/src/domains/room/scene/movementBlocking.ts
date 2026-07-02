// Movement blocking against the compiled scene. Every server path that moves
// a token (legacy "move" messages, scene-object transforms) funnels through
// this check so walls and shut doors stay physically real regardless of which
// message a client speaks.

import { findBlockingSegment, type ScenePoint } from "@herobyte/shared";
import type { RoomState } from "../model.js";

export function isTokenMoveBlocked(state: RoomState, from: ScenePoint, to: ScenePoint): boolean {
  if (!state.compiledScene) {
    return false;
  }
  const mapTransform = state.sceneObjects.find((object) => object.type === "map")?.transform;
  return findBlockingSegment(state.compiledScene, from, to, mapTransform) !== null;
}
