import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Drawing, RoomSnapshot, SceneObject } from "@shared";
import { useSceneObjectsData } from "../useSceneObjectsData";

function createDrawing(id: string): Drawing {
  return {
    id,
    owner: "dm",
    type: "freehand",
    points: [],
    color: "#FF0000",
    width: 2,
    opacity: 1,
  };
}

const baseSceneObjects: SceneObject[] = [
  {
    id: "map-1",
    type: "map",
    owner: null,
    locked: true,
    zIndex: -100,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: { imageUrl: "map.png" },
  },
  {
    id: "drawing-1",
    type: "drawing",
    owner: "dm",
    locked: false,
    zIndex: 5,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: { drawing: createDrawing("drawing-1") },
  },
  {
    id: "staging-zone-1",
    type: "staging-zone",
    owner: null,
    locked: false,
    zIndex: -80,
    transform: { x: 10, y: 5, scaleX: 1, scaleY: 1, rotation: 45 },
    data: { width: 4, height: 3, rotation: 45, label: "Custom Zone" },
  },
];

function createSnapshot(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    users: [],
    tokens: [],
    players: [],
    characters: [],
    props: [],
    mapBackground: undefined,
    pointers: [],
    drawings: [],
    gridSize: 50,
    gridSquareSize: undefined,
    diceRolls: [],
    sceneObjects: baseSceneObjects,
    ...overrides,
  };
}

describe("useSceneObjectsData", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return the scene objects from the snapshot", () => {
    const snapshot = createSnapshot();

    const { result } = renderHook(() => useSceneObjectsData(snapshot, 50));

    expect(result.current.sceneObjects).toHaveLength(3);
  });

  it("should return the map object when present", () => {
    const snapshot = createSnapshot();

    const { result } = renderHook(() => useSceneObjectsData(snapshot, 50));

    expect(result.current.mapObject?.type).toBe("map");
    expect(result.current.mapObject?.id).toBe("map-1");
  });

  it("should return undefined for mapObject when no map exists", () => {
    const snapshot = createSnapshot({
      sceneObjects: baseSceneObjects.filter((object) => object.type !== "map"),
    });

    const { result } = renderHook(() => useSceneObjectsData(snapshot, 50));

    expect(result.current.mapObject).toBeUndefined();
  });

  it("should filter drawing objects", () => {
    const snapshot = createSnapshot();

    const { result } = renderHook(() => useSceneObjectsData(snapshot, 50));

    expect(result.current.drawingObjects).toHaveLength(1);
    expect(result.current.drawingObjects[0].type).toBe("drawing");
  });

  it("should find the staging zone object", () => {
    const snapshot = createSnapshot();

    const { result } = renderHook(() => useSceneObjectsData(snapshot, 50));

    expect(result.current.stagingZoneObject?.type).toBe("staging-zone");
  });

  it("should return null staging zone object when not present", () => {
    const snapshot = createSnapshot({
      sceneObjects: baseSceneObjects.filter((object) => object.type !== "staging-zone"),
    });

    const { result } = renderHook(() => useSceneObjectsData(snapshot, 50));

    expect(result.current.stagingZoneObject).toBeNull();
    expect(result.current.stagingZoneDimensions).toBeNull();
  });

  it("should calculate staging zone dimensions", () => {
    const snapshot = createSnapshot();

    const { result } = renderHook(() => useSceneObjectsData(snapshot, 40));

    expect(result.current.stagingZoneDimensions).toEqual({
      centerX: (10 + 0.5) * 40,
      centerY: (5 + 0.5) * 40,
      widthPx: 4 * 40,
      heightPx: 3 * 40,
      rotation: 45,
      label: "Custom Zone",
    });
  });

  it("should default the staging zone label when missing", () => {
    const snapshot = createSnapshot({
      sceneObjects: [
        baseSceneObjects[0],
        baseSceneObjects[1],
        {
          ...baseSceneObjects[2],
          data: { width: 2, height: 2, rotation: 15 },
        },
      ],
    });

    const { result } = renderHook(() => useSceneObjectsData(snapshot, 30));

    expect(result.current.stagingZoneDimensions?.label).toBe("Player Staging Zone");
  });

  it("should handle a null snapshot", () => {
    const { result } = renderHook(() => useSceneObjectsData(null, 50));

    expect(result.current.sceneObjects).toEqual([]);
    expect(result.current.mapObject).toBeUndefined();
    expect(result.current.drawingObjects).toEqual([]);
    expect(result.current.stagingZoneObject).toBeNull();
    expect(result.current.stagingZoneDimensions).toBeNull();
  });
});
