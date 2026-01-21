import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import type { RoomSnapshot, Token, Drawing, PlayerStagingZone, Pointer } from "@shared";
import { useSceneObjects } from "../useSceneObjects";

// Helper to create a minimal valid snapshot
function createLegacySnapshot(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    users: [],
    tokens: [],
    players: [],
    characters: [],
    props: [],
    drawings: [],
    pointers: [],
    diceRolls: [],
    gridSize: 50,
    // sceneObjects is explicitly undefined/empty for legacy tests
    sceneObjects: undefined,
    ...overrides,
  };
}

describe("useSceneObjects - Migration Logic", () => {
  it("should migrate legacy map background", () => {
    const snapshot = createLegacySnapshot({
      mapBackground: "https://example.com/map.jpg",
    });

    const { result } = renderHook(() => useSceneObjects(snapshot));

    const mapObj = result.current.find((o) => o.type === "map");
    expect(mapObj).toBeDefined();
    expect(mapObj?.id).toBe("map");
    expect(mapObj?.data.imageUrl).toBe("https://example.com/map.jpg");
    expect(mapObj?.transform).toEqual({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 });
    expect(mapObj?.zIndex).toBe(-100);
    expect(mapObj?.locked).toBe(true);
  });

  it("should migrate legacy tokens", () => {
    const token: Token = {
      id: "t1",
      owner: "player1",
      x: 100,
      y: 200,
      color: "#ff0000",
      imageUrl: "token.png",
      size: "medium",
    };

    const snapshot = createLegacySnapshot({
      tokens: [token],
    });

    const { result } = renderHook(() => useSceneObjects(snapshot));

    const tokenObj = result.current.find((o) => o.type === "token");
    expect(tokenObj).toBeDefined();
    expect(tokenObj?.id).toBe("token:t1");
    expect(tokenObj?.owner).toBe("player1");
    expect(tokenObj?.transform).toEqual({ x: 100, y: 200, scaleX: 1, scaleY: 1, rotation: 0 });
    expect(tokenObj?.data.color).toBe("#ff0000");
    expect(tokenObj?.data.imageUrl).toBe("token.png");
    expect(tokenObj?.zIndex).toBe(10);
  });

  it("should migrate legacy drawings", () => {
    const drawing: Drawing = {
      id: "d1",
      owner: "player1",
      type: "freehand",
      points: [0, 0, 10, 10],
      color: "#00ff00",
      width: 5,
      opacity: 0.5,
    };

    const snapshot = createLegacySnapshot({
      drawings: [drawing],
    });

    const { result } = renderHook(() => useSceneObjects(snapshot));

    const drawingObj = result.current.find((o) => o.type === "drawing");
    expect(drawingObj).toBeDefined();
    expect(drawingObj?.id).toBe("drawing:d1");
    expect(drawingObj?.data.drawing).toEqual(drawing);
    expect(drawingObj?.zIndex).toBe(5);
  });

  it("should migrate legacy staging zone", () => {
    const zone: PlayerStagingZone = {
      x: 5,
      y: 5,
      width: 10,
      height: 2,
      rotation: 90,
    };

    const snapshot = createLegacySnapshot({
      playerStagingZone: zone,
    });

    const { result } = renderHook(() => useSceneObjects(snapshot));

    const zoneObj = result.current.find((o) => o.type === "staging-zone");
    expect(zoneObj).toBeDefined();
    expect(zoneObj?.id).toBe("staging-zone");
    expect(zoneObj?.transform.x).toBe(5);
    expect(zoneObj?.transform.rotation).toBe(90);
    expect(zoneObj?.data.label).toBe("Player Staging Zone");
    expect(zoneObj?.zIndex).toBe(-80);
  });

  it("should migrate legacy pointers", () => {
    const pointer: Pointer = {
      id: "p1",
      uid: "user1",
      x: 50,
      y: 50,
      name: "User 1",
      color: "#000",
    };

    const snapshot = createLegacySnapshot({
      pointers: [pointer],
    });

    const { result } = renderHook(() => useSceneObjects(snapshot));

    const pointerObj = result.current.find((o) => o.type === "pointer");
    expect(pointerObj).toBeDefined();
    expect(pointerObj?.id).toBe("pointer:p1");
    expect(pointerObj?.owner).toBe("user1");
    expect(pointerObj?.transform.x).toBe(50);
    expect(pointerObj?.zIndex).toBe(20);
  });

  it("should handle mixed legacy content", () => {
    const snapshot = createLegacySnapshot({
      mapBackground: "map.jpg",
      tokens: [{ id: "t1", x: 0, y: 0, owner: "u1", color: "red", size: "medium" }],
    });

    const { result } = renderHook(() => useSceneObjects(snapshot));

    expect(result.current).toHaveLength(2);
    expect(result.current.some((o) => o.type === "map")).toBe(true);
    expect(result.current.some((o) => o.type === "token")).toBe(true);
  });

  it("should prioritize sceneObjects if present", () => {
    const snapshot = createLegacySnapshot({
      mapBackground: "legacy-map.jpg",
      sceneObjects: [
        {
          id: "new-map",
          type: "map",
          owner: null,
          locked: true,
          zIndex: -100,
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
          data: { imageUrl: "new-map.jpg" },
        },
      ],
    });

    const { result } = renderHook(() => useSceneObjects(snapshot));

    expect(result.current).toHaveLength(1);
    expect(result.current[0].data.imageUrl).toBe("new-map.jpg");
  });

  it("should return empty array for null snapshot", () => {
    const { result } = renderHook(() => useSceneObjects(null));
    expect(result.current).toEqual([]);
  });
});
