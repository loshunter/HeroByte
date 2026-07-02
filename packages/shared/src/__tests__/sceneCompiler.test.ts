import { describe, expect, it } from "vitest";
import {
  COMPILED_SCENE_SCHEMA_VERSION,
  compileScene,
  createMapDocument,
  doorBlocksMovement,
  doorBlocksVision,
  getMovementBlockingSegments,
  toLiveGridSize,
  type MapDocument,
  type MapDoorElement,
  type MapElement,
  type MapLightElement,
  type MapWallElement,
} from "../index.js";

function withElements(elements: MapElement[]): MapDocument {
  const document = createMapDocument({ id: "map-1", name: "Keep", timestamp: 1 });
  return { ...document, elements, revision: 7 };
}

function wall(overrides: Partial<MapWallElement["data"]> = {}, id = "wall-1"): MapWallElement {
  return {
    id,
    layerId: "walls",
    type: "wall",
    locked: false,
    hidden: false,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: {
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      blocksMovement: true,
      blocksVision: true,
      ...overrides,
    },
  };
}

function door(overrides: Partial<MapDoorElement["data"]> = {}, id = "door-1"): MapDoorElement {
  return {
    id,
    layerId: "walls",
    type: "door",
    locked: false,
    hidden: false,
    transform: { x: 10, y: 20, scaleX: 1, scaleY: 1, rotation: 0 },
    data: { width: 40, state: "closed", blocksMovement: true, blocksVision: true, ...overrides },
  };
}

function light(overrides: Partial<MapLightElement["data"]> = {}, id = "light-1"): MapLightElement {
  return {
    id,
    layerId: "lighting",
    type: "light",
    locked: false,
    hidden: false,
    transform: { x: 300, y: 400, scaleX: 1, scaleY: 1, rotation: 0 },
    data: { radius: 120, color: "#ffcc66", intensity: 0.8, castsShadows: true, ...overrides },
  };
}

describe("compileScene", () => {
  it("compiles an empty document into an empty scene with source metadata", () => {
    const scene = compileScene(withElements([]), 99);

    expect(scene).toEqual({
      schemaVersion: COMPILED_SCENE_SCHEMA_VERSION,
      sourceDocumentId: "map-1",
      sourceRevision: 7,
      compiledAt: 99,
      width: 2048,
      height: 2048,
      walls: [],
      doors: [],
      lights: [],
    });
  });

  it("compiles a two-point wall into a single segment preserving blocking flags", () => {
    const scene = compileScene(withElements([wall({ blocksVision: false })]), 99);

    expect(scene.walls).toEqual([
      { id: "wall-1#0", x1: 0, y1: 0, x2: 100, y2: 0, blocksMovement: true, blocksVision: false },
    ]);
  });

  it("compiles a polyline wall into one segment per consecutive point pair", () => {
    const polyline = wall({
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
      ],
    });

    const scene = compileScene(withElements([polyline]), 99);

    expect(scene.walls.map((segment) => segment.id)).toEqual(["wall-1#0", "wall-1#1"]);
    expect(scene.walls[1]).toMatchObject({ x1: 100, y1: 0, x2: 100, y2: 50 });
  });

  it("applies element transforms scale-first, then rotation, then translation", () => {
    const transformed: MapWallElement = {
      ...wall({
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
      }),
      transform: { x: 100, y: 200, scaleX: 2, scaleY: 1, rotation: 90 },
    };

    const scene = compileScene(withElements([transformed]), 99);
    const segment = scene.walls[0]!;

    expect(segment.x1).toBeCloseTo(100);
    expect(segment.y1).toBeCloseTo(200);
    expect(segment.x2).toBeCloseTo(100);
    expect(segment.y2).toBeCloseTo(220);
  });

  it("compiles doors from their transform origin along the rotated width axis", () => {
    const rotated: MapDoorElement = {
      ...door({ state: "locked" }),
      transform: { x: 5, y: 6, scaleX: 1, scaleY: 1, rotation: 180 },
    };

    const scene = compileScene(withElements([rotated]), 99);
    const compiled = scene.doors[0]!;

    expect(compiled.id).toBe("door-1");
    expect(compiled.state).toBe("locked");
    expect(compiled.x1).toBeCloseTo(5);
    expect(compiled.y1).toBeCloseTo(6);
    expect(compiled.x2).toBeCloseTo(-35);
    expect(compiled.y2).toBeCloseTo(6);
  });

  it("compiles lights at their world position with scaled radius", () => {
    const scaled: MapLightElement = {
      ...light(),
      transform: { x: 300, y: 400, scaleX: 2, scaleY: 0.5, rotation: 45 },
    };

    const scene = compileScene(withElements([scaled]), 99);

    expect(scene.lights).toEqual([
      {
        id: "light-1",
        x: 300,
        y: 400,
        radius: 240,
        color: "#ffcc66",
        intensity: 0.8,
        castsShadows: true,
      },
    ]);
  });

  it("excludes hidden elements from the compiled scene", () => {
    const hidden = { ...wall(), hidden: true };

    const scene = compileScene(withElements([hidden, door()]), 99);

    expect(scene.walls).toEqual([]);
    expect(scene.doors).toHaveLength(1);
  });

  it("compiles physics from invisible layers because paint and physics are independent", () => {
    const document = withElements([wall()]);
    document.layers = document.layers.map((layer) =>
      layer.id === "walls" ? { ...layer, visible: false, opacity: 0 } : layer,
    );

    const scene = compileScene(document, 99);

    expect(scene.walls).toHaveLength(1);
  });

  it("is deterministic for the same document and timestamp", () => {
    const document = withElements([wall(), door({ state: "secret" }), light()]);

    expect(compileScene(document, 99)).toEqual(compileScene(document, 99));
  });
});

describe("door blocking semantics", () => {
  it("open doors never block, regardless of authored flags", () => {
    const scene = compileScene(withElements([door({ state: "open" })]), 99);

    expect(doorBlocksMovement(scene.doors[0]!)).toBe(false);
    expect(doorBlocksVision(scene.doors[0]!)).toBe(false);
  });

  it.each(["closed", "locked", "secret"] as const)("%s doors block per authored flags", (state) => {
    const scene = compileScene(
      withElements([door({ state, blocksMovement: true, blocksVision: false })]),
      99,
    );

    expect(doorBlocksMovement(scene.doors[0]!)).toBe(true);
    expect(doorBlocksVision(scene.doors[0]!)).toBe(false);
  });
});

describe("toLiveGridSize", () => {
  it("rounds and clamps document grid sizes into the live tabletop range", () => {
    expect(toLiveGridSize(50)).toBe(50);
    expect(toLiveGridSize(25.6)).toBe(26);
    expect(toLiveGridSize(2)).toBe(10);
    expect(toLiveGridSize(900)).toBe(500);
  });
});

describe("getMovementBlockingSegments", () => {
  it("returns blocking walls and non-open blocking doors, skipping the rest", () => {
    const scene = compileScene(
      withElements([
        wall(),
        wall({ blocksMovement: false }, "wall-vision-only"),
        door({ state: "closed" }),
        door({ state: "open" }, "door-open"),
        door({ state: "locked", blocksMovement: false }, "door-ghost"),
      ]),
      99,
    );

    const segments = getMovementBlockingSegments(scene);

    expect(segments.map((segment) => segment.id)).toEqual(["wall-1#0", "door-1"]);
  });
});
