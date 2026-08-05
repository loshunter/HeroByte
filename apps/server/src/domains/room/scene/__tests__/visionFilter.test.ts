import { describe, expect, it } from "vitest";
import type { CompiledScene } from "@herobyte/shared";
import {
  computeViewerVisionPolygon,
  getVisionBlockingSegments,
  gridCellToWorldPoint,
} from "@herobyte/shared";
import { createEmptyRoomState, type RoomState } from "../../model.js";
import { createVisionContext, isWorldPointVisible, visionSignature } from "../visionFilter.js";

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

// ============================================================================
// S7 — per-token sight radius
// ============================================================================
// Grid is 50 world px per square and 5 ft per square, so 10 ft = 100 px.
// The viewer's token sits at cell (1,3) = world (75,175).
describe("per-token vision radius", () => {
  it("does not shorten sight when no radius is set", () => {
    const context = createVisionContext(stateWithFog(), "player-1")!;
    // 75 px away, and 105 px away — both on the viewer's side of the wall.
    expect(isWorldPointVisible(context, { x: 150, y: 175 })).toBe(true);
    expect(isWorldPointVisible(context, { x: 180, y: 175 })).toBe(true);
  });

  it("stops sight at the radius", () => {
    const state = stateWithFog();
    state.tokens[0]!.visionRadius = 10; // 2 squares = 100 world px
    const context = createVisionContext(state, "player-1")!;

    expect(isWorldPointVisible(context, { x: 150, y: 175 })).toBe(true); // 75 away
    expect(isWorldPointVisible(context, { x: 180, y: 175 })).toBe(false); // 105 away
  });

  it("reads the radius in FEET, against the room's feet-per-square", () => {
    const state = stateWithFog();
    state.tokens[0]!.visionRadius = 10;
    state.gridSquareSize = 10; // 10 ft is now ONE square = 50 world px
    const context = createVisionContext(state, "player-1")!;

    expect(isWorldPointVisible(context, { x: 110, y: 175 })).toBe(true); // 35 away
    expect(isWorldPointVisible(context, { x: 150, y: 175 })).toBe(false); // 75 away
  });

  it("blinds a token whose radius is zero", () => {
    const state = stateWithFog();
    state.tokens[0]!.visionRadius = 0;
    const context = createVisionContext(state, "player-1")!;

    expect(isWorldPointVisible(context, { x: 76, y: 175 })).toBe(false);
    expect(isWorldPointVisible(context, { x: 150, y: 175 })).toBe(false);
    // Outside the fogged rect is still not hidden — staging zones live there.
    expect(isWorldPointVisible(context, { x: -50, y: 200 })).toBe(true);
  });

  it("gives a second token its own radius, and the union is what is seen", () => {
    const state = stateWithFog();
    state.tokens = [
      { id: "short", owner: "player-1", x: 1, y: 3, color: "red", visionRadius: 5 },
      { id: "long", owner: "player-1", x: 1, y: 6, color: "red", visionRadius: 30 },
    ];
    const context = createVisionContext(state, "player-1")!;
    expect(context.polygons).toHaveLength(2);

    // 105 px from the short-sighted token but well inside the far one's 300 px.
    expect(isWorldPointVisible(context, { x: 180, y: 175 })).toBe(true);
  });

  // The units trap: the sweep runs in DOCUMENT space and the map transform
  // scales between the two. Get it wrong and sight is off by exactly the scale
  // factor — invisible at the default scale of 1.
  it("scales the radius through the live map transform", () => {
    const state = stateWithFog();
    state.sceneObjects = [
      {
        id: "map",
        type: "map",
        owner: undefined,
        locked: true,
        zIndex: -100,
        transform: { x: 0, y: 0, scaleX: 2, scaleY: 2, rotation: 0 },
        data: { imageUrl: "url" },
      },
    ];
    // Token at cell (3,3) = world (175,175) = doc (87.5, 87.5).
    state.tokens = [{ id: "mine", owner: "player-1", x: 3, y: 3, color: "red", visionRadius: 10 }];
    const context = createVisionContext(state, "player-1")!;

    // 10 ft is 100 WORLD px whatever the map scale, so a point 80 world px away
    // is seen and one 120 away is not.
    expect(isWorldPointVisible(context, { x: 255, y: 175 })).toBe(true); // 80 away
    expect(isWorldPointVisible(context, { x: 295, y: 175 })).toBe(false); // 120 away
  });

  // The invariant the whole slice exists to protect: the server's polygon IS
  // the client's polygon, because both call the same function on the same
  // numbers. If createVisionContext ever converts units itself, this catches it.
  it("produces exactly the polygon the shared viewer helper produces", () => {
    const state = stateWithFog();
    state.tokens[0]!.visionRadius = 25;
    state.sceneObjects = [
      {
        id: "map",
        type: "map",
        owner: undefined,
        locked: true,
        zIndex: -100,
        transform: { x: 30, y: -12, scaleX: 1.5, scaleY: 1.5, rotation: 20 },
        data: { imageUrl: "url" },
      },
    ];

    const context = createVisionContext(state, "player-1")!;
    const expected = computeViewerVisionPolygon({
      origin: gridCellToWorldPoint(state.gridSize, {
        x: state.tokens[0]!.x,
        y: state.tokens[0]!.y,
      }),
      radiusFeet: 25,
      segments: getVisionBlockingSegments(state.compiledScene!),
      bounds: { width: state.compiledScene!.width, height: state.compiledScene!.height },
      gridSize: state.gridSize,
      gridSquareSize: state.gridSquareSize,
      mapTransform: state.sceneObjects[0]!.transform,
    });

    expect(context.polygons[0]).toEqual(expected);
    expect(context.polygons[0]!.length).toBeGreaterThan(8);
  });
});

// ============================================================================
// S7 — the cache key
// ============================================================================
// visionSignature is what messageRouter memoizes polygons on. Anything the
// polygon reads that is missing here produces STALE vision: the DM changes a
// radius, nothing happens, and it reads as "the message never sent". These are
// the first direct tests this function has ever had.
describe("visionSignature", () => {
  it("changes when the recipient's own token gains a radius", () => {
    const before = stateWithFog();
    const after = stateWithFog();
    after.tokens[0]!.visionRadius = 60;

    expect(visionSignature(after, "player-1")).not.toBe(visionSignature(before, "player-1"));
  });

  it("changes when an existing radius is edited", () => {
    const state = stateWithFog();
    state.tokens[0]!.visionRadius = 60;
    const before = visionSignature(state, "player-1");
    state.tokens[0]!.visionRadius = 30;

    expect(visionSignature(state, "player-1")).not.toBe(before);
  });

  it("changes when a radius is cleared back to unlimited", () => {
    const state = stateWithFog();
    state.tokens[0]!.visionRadius = 60;
    const limited = visionSignature(state, "player-1");
    delete state.tokens[0]!.visionRadius;

    expect(visionSignature(state, "player-1")).not.toBe(limited);
  });

  it("changes when feet-per-square changes, because the radius is in feet", () => {
    const state = stateWithFog();
    state.tokens[0]!.visionRadius = 60;
    const before = visionSignature(state, "player-1");
    // A live `grid-square-size` message can do this with no republish.
    state.gridSquareSize = 10;

    expect(visionSignature(state, "player-1")).not.toBe(before);
  });

  it("ignores a radius on someone else's token", () => {
    const before = stateWithFog();
    const after = stateWithFog();
    after.tokens[1]!.visionRadius = 5;

    expect(visionSignature(after, "player-1")).toBe(visionSignature(before, "player-1"));
  });

  it("is stable when nothing relevant changed", () => {
    expect(visionSignature(stateWithFog(), "player-1")).toBe(
      visionSignature(stateWithFog(), "player-1"),
    );
  });
});
