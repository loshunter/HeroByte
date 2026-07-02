import { describe, expect, it } from "vitest";
import type { CompiledScene } from "@herobyte/shared";
import { createEmptyRoomState, type RoomState } from "../../model.js";
import { createVisionContext, isWorldPointVisible } from "../visionFilter.js";

// A 400x400 scene split by a vertical wall at x=200: viewers on the left
// cannot see the right half.
function sceneWithDividingWall(): CompiledScene {
  return {
    schemaVersion: 1,
    sourceDocumentId: "map",
    sourceRevision: 1,
    compiledAt: 1,
    width: 400,
    height: 400,
    walls: [
      { id: "divider", x1: 200, y1: 0, x2: 200, y2: 400, blocksMovement: true, blocksVision: true },
    ],
    doors: [],
    lights: [],
  };
}

// Tokens are in GRID CELLS (gridSize 50): cell (1,3) = world pixel (75,175),
// left of the wall; cell (6,3) = (325,175), right of it.
function stateWithFog(): RoomState {
  const state = createEmptyRoomState();
  state.fogEnabled = true;
  state.compiledScene = sceneWithDividingWall();
  state.tokens = [
    { id: "mine", owner: "player-1", x: 1, y: 3, color: "red" },
    { id: "theirs", owner: "player-2", x: 6, y: 3, color: "blue" },
  ];
  return state;
}

describe("createVisionContext", () => {
  it("returns null when fog is disabled", () => {
    const state = stateWithFog();
    state.fogEnabled = false;
    expect(createVisionContext(state, "player-1")).toBeNull();
  });

  it("returns null when no scene has been published", () => {
    const state = stateWithFog();
    state.compiledScene = undefined;
    expect(createVisionContext(state, "player-1")).toBeNull();
  });

  it("builds one polygon per owned token", () => {
    const context = createVisionContext(stateWithFog(), "player-1");
    expect(context).not.toBeNull();
    expect(context!.polygons).toHaveLength(1);
  });
});

describe("isWorldPointVisible", () => {
  it("sees points on the viewer's side of the wall but not beyond it", () => {
    const context = createVisionContext(stateWithFog(), "player-1")!;

    expect(isWorldPointVisible(context, { x: 150, y: 200 })).toBe(true);
    expect(isWorldPointVisible(context, { x: 300, y: 200 })).toBe(false);
  });

  it("treats everything outside the published map rect as visible, matching the fog overlay", () => {
    const context = createVisionContext(stateWithFog(), "player-1")!;

    // Staging zones and off-map tokens live outside the fogged rect.
    expect(isWorldPointVisible(context, { x: -50, y: 200 })).toBe(true);
    expect(isWorldPointVisible(context, { x: 450, y: 450 })).toBe(true);
  });

  it("sees nothing inside the map when the viewer has no tokens", () => {
    const context = createVisionContext(stateWithFog(), "player-3")!;

    expect(isWorldPointVisible(context, { x: 100, y: 200 })).toBe(false);
    expect(isWorldPointVisible(context, { x: 300, y: 200 })).toBe(false);
  });

  it("accounts for the live map transform", () => {
    const state = stateWithFog();
    // Map dragged +1000: doc x=200 wall now lives at world x=1200.
    state.sceneObjects = [
      {
        id: "map",
        type: "map",
        owner: undefined,
        locked: true,
        zIndex: -100,
        transform: { x: 1000, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        data: { imageUrl: "url" },
      },
    ];
    // Move the viewer's token into the transformed map's left half:
    // cell (22,4) = world (1125,225) = doc (125,225).
    state.tokens[0]!.x = 22;
    state.tokens[0]!.y = 4;

    const context = createVisionContext(state, "player-1")!;

    expect(isWorldPointVisible(context, { x: 1150, y: 200 })).toBe(true);
    expect(isWorldPointVisible(context, { x: 1300, y: 200 })).toBe(false);
    // The original (untransformed) coordinates are now outside the map rect.
    expect(isWorldPointVisible(context, { x: 300, y: 200 })).toBe(true);
  });

  it("sees through a door once it opens", () => {
    const state = stateWithFog();
    state.compiledScene!.walls = [
      { id: "top", x1: 200, y1: 0, x2: 200, y2: 180, blocksMovement: true, blocksVision: true },
      {
        id: "bottom",
        x1: 200,
        y1: 220,
        x2: 200,
        y2: 400,
        blocksMovement: true,
        blocksVision: true,
      },
    ];
    state.compiledScene!.doors = [
      {
        id: "door",
        x1: 200,
        y1: 180,
        x2: 200,
        y2: 220,
        state: "closed",
        blocksMovement: true,
        blocksVision: true,
      },
    ];

    const closed = createVisionContext(state, "player-1")!;
    expect(isWorldPointVisible(closed, { x: 300, y: 200 })).toBe(false);

    state.compiledScene!.doors[0]!.state = "open";
    const open = createVisionContext(state, "player-1")!;
    expect(isWorldPointVisible(open, { x: 300, y: 200 })).toBe(true);
  });
});
