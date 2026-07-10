import type { MapLayer } from "@herobyte/shared";
import type { MapDoorDraft, MapWallDraft } from "../types";
import type { RoomDrag, StudioTool } from "./MapStudioWorkspace.types";

/**
 * Wall + door placement geometry (Slice 2). Both tools are a two-point drag —
 * the wall/room canonical pattern — whose endpoints are already grid-snapped by
 * the canvas controller. These pure converters turn a `{start, end}` drag into
 * the client draft the `add-element` command builders consume; keeping them out
 * of the controller keeps that hook under the file-size cap and makes the risky
 * geometry unit-testable without React.
 */

/** Two-point drag → wall draft (a polyline segment). Null for a zero-length drag. */
export function wallDraftFromDrag(layerId: string, drag: RoomDrag): MapWallDraft | null {
  if (drag.start.x === drag.end.x && drag.start.y === drag.end.y) return null;
  return {
    layerId,
    x1: drag.start.x,
    y1: drag.start.y,
    x2: drag.end.x,
    y2: drag.end.y,
    blocksMovement: true,
    blocksVision: true,
  };
}

/**
 * Two-point drag → door draft. A door is exactly one segment: its transform
 * sits at the drag START, `width` is the drag length, and `rotation` (degrees)
 * is the drag angle — so a door drawn along a wall lands correctly angled for
 * free. Authored state is "closed": an "open" door blocks neither movement nor
 * vision (sceneCompiler short-circuits on "open"), so it would look broken until
 * toggled. Null for a zero-length drag.
 */
export function doorDraftFromDrag(layerId: string, drag: RoomDrag): MapDoorDraft | null {
  const dx = drag.end.x - drag.start.x;
  const dy = drag.end.y - drag.start.y;
  const width = Math.hypot(dx, dy);
  if (width === 0) return null;
  return {
    layerId,
    x: drag.start.x,
    y: drag.start.y,
    width,
    rotation: (Math.atan2(dy, dx) * 180) / Math.PI,
    state: "closed",
    blocksMovement: true,
    blocksVision: true,
  };
}

/** The walls-kind layer holds both walls and doors (see DEFAULT_MAP_LAYERS). */
export function findWallsLayer(layers: Map<string, MapLayer>): MapLayer | null {
  for (const layer of layers.values()) {
    if (layer.kind === "walls") return layer;
  }
  return null;
}

/**
 * Route a completed wall/door drag to the matching add-element action. Resolves
 * the placement layer by KIND (walls/doors aren't asset-driven, so the
 * asset-based `pickPlacementLayer` won't find it) and no-ops when there is no
 * walls layer or the drag has no length. The controller gates on `saving`
 * before calling this — `addWall`/`addDoor` do not self-gate.
 */
export function commitSegmentDrag(
  tool: StudioTool,
  layers: Map<string, MapLayer>,
  drag: RoomDrag,
  addWall: (draft: MapWallDraft) => unknown,
  addDoor: (draft: MapDoorDraft) => unknown,
): void {
  const layer = findWallsLayer(layers);
  if (!layer) return;
  if (tool === "door") {
    const draft = doorDraftFromDrag(layer.id, drag);
    if (draft) addDoor(draft);
  } else if (tool === "wall") {
    const draft = wallDraftFromDrag(layer.id, drag);
    if (draft) addWall(draft);
  }
}
