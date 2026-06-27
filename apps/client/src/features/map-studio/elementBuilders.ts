import type { MapDoorElement, MapShapeElement, MapWallElement } from "@herobyte/shared";
import type { MapDoorDraft, MapShapeDraft, MapWallDraft } from "./types";

export function createShapeElement(id: string, draft: MapShapeDraft): MapShapeElement {
  return {
    id,
    layerId: draft.layerId,
    type: "shape",
    locked: false,
    hidden: false,
    transform: { x: draft.x, y: draft.y, scaleX: 1, scaleY: 1, rotation: 0 },
    data: {
      shape: draft.shape,
      points: [
        { x: 0, y: 0 },
        { x: draft.width, y: draft.height },
      ],
      fill: draft.fill,
      stroke: draft.stroke,
      strokeWidth: 4,
      opacity: 1,
    },
  };
}

export function createWallElement(id: string, draft: MapWallDraft): MapWallElement {
  return {
    id,
    layerId: draft.layerId,
    type: "wall",
    locked: false,
    hidden: false,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: {
      points: [
        { x: draft.x1, y: draft.y1 },
        { x: draft.x2, y: draft.y2 },
      ],
      blocksMovement: draft.blocksMovement,
      blocksVision: draft.blocksVision,
    },
  };
}

export function createDoorElement(id: string, draft: MapDoorDraft): MapDoorElement {
  return {
    id,
    layerId: draft.layerId,
    type: "door",
    locked: false,
    hidden: false,
    transform: {
      x: draft.x,
      y: draft.y,
      scaleX: 1,
      scaleY: 1,
      rotation: draft.rotation,
    },
    data: {
      width: draft.width,
      state: draft.state,
      blocksMovement: draft.blocksMovement,
      blocksVision: draft.blocksVision,
    },
  };
}
