import { useMemo } from "react";
import type { RoomSnapshot, SceneObject } from "@shared";
import { useSceneObjects } from "./useSceneObjects.js";

export type MapSceneObject = SceneObject & { type: "map" };
export type DrawingSceneObject = SceneObject & { type: "drawing" };
export type StagingZoneSceneObject = SceneObject & { type: "staging-zone" };

export type StagingZoneDimensions = {
  centerX: number;
  centerY: number;
  widthPx: number;
  heightPx: number;
  rotation: number;
  label: string;
};

export type SceneObjectsData = {
  sceneObjects: SceneObject[];
  mapObject: MapSceneObject | undefined;
  drawingObjects: DrawingSceneObject[];
  stagingZoneObject: StagingZoneSceneObject | null;
  stagingZoneDimensions: StagingZoneDimensions | null;
};

/**
 * Aggregates derived data for map, drawing, and staging-zone objects from the
 * latest room snapshot while preserving existing debug logging.
 *
 * @param snapshot - Current room snapshot provided by the server.
 * @param gridSize - Grid cell size in pixels used for dimension calculations.
 * @returns Derived scene object collections and staging zone metadata.
 */
export function useSceneObjectsData(
  snapshot: RoomSnapshot | null,
  gridSize: number,
): SceneObjectsData {
  const sceneObjects = useSceneObjects(snapshot);

  const mapObject = useMemo(
    () => sceneObjects.find((object): object is MapSceneObject => object.type === "map"),
    [sceneObjects],
  );

  const drawingObjects = useMemo(
    () => sceneObjects.filter((object): object is DrawingSceneObject => object.type === "drawing"),
    [sceneObjects],
  );

  const stagingZoneObject = useMemo<StagingZoneSceneObject | null>(
    () =>
      sceneObjects.find(
        (object): object is StagingZoneSceneObject => object.type === "staging-zone",
      ) ?? null,
    [sceneObjects],
  );

  const stagingZoneDimensions = useMemo<StagingZoneDimensions | null>(() => {
    if (!stagingZoneObject) {
      return null;
    }

    return {
      centerX: (stagingZoneObject.transform.x + 0.5) * gridSize,
      centerY: (stagingZoneObject.transform.y + 0.5) * gridSize,
      widthPx: stagingZoneObject.data.width * gridSize,
      heightPx: stagingZoneObject.data.height * gridSize,
      rotation: stagingZoneObject.transform.rotation,
      label: stagingZoneObject.data.label ?? "Player Staging Zone",
    };
  }, [gridSize, stagingZoneObject]);

  return {
    sceneObjects,
    mapObject,
    drawingObjects,
    stagingZoneObject,
    stagingZoneDimensions,
  };
}
