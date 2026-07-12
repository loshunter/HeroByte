// screen → world → document-space pointer conversion for the map-edit tools.
// Live-authored maps have no raster "map" object, so document space ≡ world
// space; the hop through inverseTransformScenePoint keeps tools correct even if
// a document is bound onto a room that also carries a raster background.

import { useCallback, type RefObject } from "react";
import type Konva from "konva";
import {
  inverseTransformScenePoint,
  type MapGridSettings,
  type SceneObjectTransform,
} from "@herobyte/shared";
import { snapPointToGrid } from "../map-studio/snapToGrid";

const IDENTITY_TRANSFORM: SceneObjectTransform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };

type Point = { x: number; y: number };

export interface PointerToDoc {
  /** Unsnapped document-space point under the pointer, or null. */
  toDocPoint: (stageRef: RefObject<Konva.Stage | null>) => Point | null;
  /** Grid-snapped document-space point — for the two-point drag tools. */
  toSnappedDocPoint: (
    stageRef: RefObject<Konva.Stage | null>,
    grid: MapGridSettings,
  ) => Point | null;
}

export function usePointerToDoc(
  toWorld: (sx: number, sy: number) => Point,
  mapTransform: SceneObjectTransform | undefined,
): PointerToDoc {
  const toDocPoint = useCallback(
    (stageRef: RefObject<Konva.Stage | null>): Point | null => {
      const pointer = stageRef.current?.getPointerPosition();
      if (!pointer) return null;
      const world = toWorld(pointer.x, pointer.y);
      return inverseTransformScenePoint(mapTransform ?? IDENTITY_TRANSFORM, world);
    },
    [toWorld, mapTransform],
  );

  const toSnappedDocPoint = useCallback(
    (stageRef: RefObject<Konva.Stage | null>, grid: MapGridSettings): Point | null => {
      const doc = toDocPoint(stageRef);
      return doc ? snapPointToGrid(doc, grid) : null;
    },
    [toDocPoint],
  );

  return { toDocPoint, toSnappedDocPoint };
}
