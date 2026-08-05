import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  coerceTokenVisionRadii,
  coerceVisionRadius,
  computeViewerVisionPolygon,
  computeVisionPolygon,
  getVisionBlockingSegments,
  inverseTransformScenePoint,
  pointInPolygon,
  tokenVisionRadius,
  transformScenePoint,
  VISION_RADIUS_MAX_FEET,
  VISION_RADIUS_MIN_FEET,
  type BlockingSegment,
  type CompiledScene,
  type SceneTransform,
  type ScenePoint,
} from "../index.js";

const BOUNDS = { width: 400, height: 400 };

function visible(origin: ScenePoint, segments: BlockingSegment[], target: ScenePoint): boolean {
  return pointInPolygon(target, computeVisionPolygon(origin, segments, BOUNDS));
}

function wall(id: string, x1: number, y1: number, x2: number, y2: number): BlockingSegment {
  return { id, x1, y1, x2, y2 };
}

describe("pointInPolygon", () => {
  const square: ScenePoint[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it("accepts interior points and rejects exterior ones", () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
  });

  it("rejects everything for degenerate polygons", () => {
    expect(pointInPolygon({ x: 5, y: 5 }, [])).toBe(false);
    expect(pointInPolygon({ x: 5, y: 5 }, square.slice(0, 2))).toBe(false);
  });
});

describe("computeVisionPolygon", () => {
  it("sees the whole bounds when nothing blocks", () => {
    const origin = { x: 200, y: 200 };
    const polygon = computeVisionPolygon(origin, [], BOUNDS);

    expect(polygon.length).toBeGreaterThanOrEqual(4);
    expect(pointInPolygon({ x: 10, y: 10 }, polygon)).toBe(true);
    expect(pointInPolygon({ x: 390, y: 390 }, polygon)).toBe(true);
    expect(pointInPolygon({ x: 10, y: 390 }, polygon)).toBe(true);
    expect(pointInPolygon({ x: 390, y: 10 }, polygon)).toBe(true);
  });

  it("hides the area behind a wall but not beside it", () => {
    const origin = { x: 100, y: 200 };
    const segments = [wall("w", 200, 150, 200, 250)];

    // Directly behind the wall (same horizontal ray).
    expect(visible(origin, segments, { x: 300, y: 200 })).toBe(false);
    // Beside the wall's shadow.
    expect(visible(origin, segments, { x: 300, y: 40 })).toBe(true);
    expect(visible(origin, segments, { x: 300, y: 360 })).toBe(true);
    // In front of the wall.
    expect(visible(origin, segments, { x: 150, y: 200 })).toBe(true);
  });

  it("sees through a doorway gap between two walls", () => {
    const origin = { x: 100, y: 200 };
    const segments = [wall("top", 200, 0, 200, 180), wall("bottom", 200, 220, 200, 400)];

    // Straight through the gap.
    expect(visible(origin, segments, { x: 300, y: 200 })).toBe(true);
    // Blocked above and below the gap.
    expect(visible(origin, segments, { x: 300, y: 100 })).toBe(false);
    expect(visible(origin, segments, { x: 300, y: 300 })).toBe(false);
  });

  it("is fully enclosed by a surrounding room", () => {
    const origin = { x: 200, y: 200 };
    const segments = [
      wall("n", 150, 150, 250, 150),
      wall("e", 250, 150, 250, 250),
      wall("s", 250, 250, 150, 250),
      wall("w", 150, 250, 150, 150),
    ];

    expect(visible(origin, segments, { x: 200, y: 220 })).toBe(true);
    expect(visible(origin, segments, { x: 200, y: 300 })).toBe(false);
    expect(visible(origin, segments, { x: 300, y: 200 })).toBe(false);
    expect(visible(origin, segments, { x: 100, y: 100 })).toBe(false);
  });

  it("clamps vision to the scene bounds", () => {
    const polygon = computeVisionPolygon({ x: 200, y: 200 }, [], BOUNDS);

    for (const vertex of polygon) {
      expect(vertex.x).toBeGreaterThanOrEqual(-0.01);
      expect(vertex.x).toBeLessThanOrEqual(400.01);
      expect(vertex.y).toBeGreaterThanOrEqual(-0.01);
      expect(vertex.y).toBeLessThanOrEqual(400.01);
    }
  });

  // The live table is an infinite canvas and tokens spawn at the document
  // rect's top-left CORNER cell, so a token dragged one cell up or left sits
  // OUTSIDE the rect. The scene-bounds segments used to double as the
  // containment box, so an outside origin degenerated to a zero-area polygon
  // — no fog hole at all, the reported "fog covers everything including my
  // token". Vision from outside must still reach into the scene.
  describe("origins outside the scene rect (off-document tokens)", () => {
    const outsideOrigins: [string, ScenePoint][] = [
      ["left", { x: -25, y: 200 }],
      ["above", { x: 200, y: -25 }],
      ["diagonal top-left", { x: -25, y: -25 }],
      ["right", { x: 425, y: 200 }],
      ["below the corner", { x: 425, y: 425 }],
    ];

    it.each(outsideOrigins)("sees into an unwalled scene from %s", (_label, origin) => {
      const polygon = computeVisionPolygon(origin, [], BOUNDS);
      // The whole open rect is reachable by sightline.
      expect(pointInPolygon({ x: 200, y: 200 }, polygon)).toBe(true);
      expect(pointInPolygon({ x: 10, y: 10 }, polygon)).toBe(true);
      expect(pointInPolygon({ x: 390, y: 390 }, polygon)).toBe(true);
    });

    it("walls still occlude an outside origin's sightlines", () => {
      const origin = { x: -25, y: 200 };
      const segments = [wall("w", 200, 0, 200, 400)];
      // In front of the wall: visible.
      expect(visible(origin, segments, { x: 100, y: 200 })).toBe(true);
      // Behind the wall: hidden.
      expect(visible(origin, segments, { x: 300, y: 200 })).toBe(false);
    });

    it("an origin exactly on the rect edge is not blinded", () => {
      const polygon = computeVisionPolygon({ x: 0, y: 200 }, [], BOUNDS);
      expect(pointInPolygon({ x: 200, y: 200 }, polygon)).toBe(true);
    });
  });
});

// ============================================================================
// S7 — unlimited sight must not have moved by a single vertex
// ============================================================================
// Every hash below was produced by running the PRE-S7 implementation
// (git HEAD fcab3046) over these cases, before the radius parameter existed.
// They are frozen on purpose: S7 refactored the sweep's inner loop to hand the
// ray direction to a distance function so the radius could clamp it, and
// "unlimited sight is untouched" is the promise that made that refactor safe
// to ship. A vertex count or hash that moves here means today's fog is not
// yesterday's fog — fix the product code, never the fixture.
describe("unlimited sight reproduces the pre-S7 polygons exactly", () => {
  const GOLDEN: Record<string, { count: number; hash: string }> = {
    "open scene": { count: 24, hash: "0ca56f2dd3af5a31" },
    "single wall": { count: 30, hash: "1a3629986e9fe1e3" },
    doorway: { count: 36, hash: "a7712904748aa78a" },
    "enclosed room": { count: 48, hash: "de009199f0cb5ff4" },
    "origin outside left": { count: 30, hash: "80ac577834129a62" },
    "origin outside corner": { count: 24, hash: "df05f11377390932" },
    "origin on edge": { count: 24, hash: "b6d75be433a191e7" },
    "many walls": { count: 60, hash: "42844f11636e5e4b" },
  };

  const CASES: [string, ScenePoint, BlockingSegment[]][] = [
    ["open scene", { x: 200, y: 200 }, []],
    ["single wall", { x: 100, y: 200 }, [wall("w", 200, 150, 200, 250)]],
    [
      "doorway",
      { x: 100, y: 200 },
      [wall("top", 200, 0, 200, 180), wall("bottom", 200, 220, 200, 400)],
    ],
    [
      "enclosed room",
      { x: 200, y: 200 },
      [
        wall("n", 150, 150, 250, 150),
        wall("e", 250, 150, 250, 250),
        wall("s", 250, 250, 150, 250),
        wall("w", 150, 250, 150, 150),
      ],
    ],
    ["origin outside left", { x: -25, y: 200 }, [wall("w", 200, 0, 200, 400)]],
    ["origin outside corner", { x: 425, y: 425 }, []],
    ["origin on edge", { x: 0, y: 200 }, []],
    [
      "many walls",
      { x: 137, y: 211 },
      [
        wall("a", 50, 50, 350, 50),
        wall("b", 350, 50, 350, 350),
        wall("c", 350, 350, 50, 350),
        wall("d", 50, 350, 50, 50),
        wall("e", 180, 120, 180, 260),
        wall("f", 240, 90, 300, 200),
      ],
    ],
  ];

  function fingerprint(polygon: ScenePoint[]): { count: number; hash: string } {
    const flat = polygon.flatMap((point) => [point.x, point.y]);
    return {
      count: polygon.length,
      hash: createHash("sha256").update(flat.join(",")).digest("hex").slice(0, 16),
    };
  }

  it.each(CASES)("%s is unchanged with no radius argument", (label, origin, segments) => {
    expect(fingerprint(computeVisionPolygon(origin, segments, BOUNDS))).toEqual(GOLDEN[label]);
  });

  it.each(CASES)("%s is unchanged with an explicit null radius", (label, origin, segments) => {
    expect(fingerprint(computeVisionPolygon(origin, segments, BOUNDS, null))).toEqual(
      GOLDEN[label],
    );
  });

  it("is unchanged when a viewer has no visionRadius set", () => {
    const polygon = computeViewerVisionPolygon({
      origin: { x: 200, y: 200 },
      segments: [],
      bounds: BOUNDS,
      gridSize: 50,
      gridSquareSize: 5,
    });
    expect(fingerprint(polygon)).toEqual(GOLDEN["open scene"]);
  });
});

// ============================================================================
// S7 — the radius itself
// ============================================================================
describe("computeVisionPolygon with a radius", () => {
  const origin = { x: 200, y: 200 };

  function maxReach(polygon: ScenePoint[]): number {
    return Math.max(...polygon.map((p) => Math.hypot(p.x - origin.x, p.y - origin.y)));
  }

  it("stops sight at the radius in open ground", () => {
    const polygon = computeVisionPolygon(origin, [], BOUNDS, { x: 60, y: 60 });

    expect(pointInPolygon({ x: 240, y: 200 }, polygon)).toBe(true); // 40 away
    expect(pointInPolygon({ x: 275, y: 200 }, polygon)).toBe(false); // 75 away
    // Every vertex sits on or inside the circle (a hair of slack for the
    // chord/arc discrepancy at the sampled angles).
    expect(maxReach(polygon)).toBeLessThanOrEqual(60.0001);
  });

  it("traces the arc finely enough to stay round, not polygonal", () => {
    const polygon = computeVisionPolygon(origin, [], BOUNDS, { x: 120, y: 120 });
    // Sample the circle between the traced vertices: a coarse polygon would
    // cut the chord and report these just-inside points as unseen.
    for (let degrees = 0; degrees < 360; degrees += 1) {
      const radians = (degrees * Math.PI) / 180;
      const probe = {
        x: origin.x + Math.cos(radians) * 118,
        y: origin.y + Math.sin(radians) * 118,
      };
      expect(pointInPolygon(probe, polygon)).toBe(true);
    }
  });

  it("still lets walls occlude inside the radius", () => {
    const segments = [wall("w", 240, 150, 240, 250)];
    const polygon = computeVisionPolygon(origin, segments, BOUNDS, { x: 120, y: 120 });

    // Behind the wall (100 away) but well inside the 120 radius.
    expect(pointInPolygon({ x: 300, y: 200 }, polygon)).toBe(false);
    // Past the wall's top end, so beside its shadow — and 94 away, inside.
    expect(pointInPolygon({ x: 250, y: 120 }, polygon)).toBe(true);
    // In front of the wall.
    expect(pointInPolygon({ x: 220, y: 200 }, polygon)).toBe(true);
  });

  it("never reaches further than the walls already allowed", () => {
    const segments = [wall("w", 240, 150, 240, 250)];
    const unlimited = computeVisionPolygon(origin, segments, BOUNDS);
    const limited = computeVisionPolygon(origin, segments, BOUNDS, { x: 120, y: 120 });
    // Radius is a strict narrowing: anything the limited viewer can see, the
    // unlimited one could too.
    for (const probe of [
      { x: 300, y: 120 },
      { x: 220, y: 200 },
      { x: 200, y: 260 },
      { x: 150, y: 150 },
    ]) {
      if (pointInPolygon(probe, limited)) {
        expect(pointInPolygon(probe, unlimited)).toBe(true);
      }
    }
  });

  it("clips to an ellipse when the document is scaled unevenly", () => {
    const polygon = computeVisionPolygon(origin, [], BOUNDS, { x: 100, y: 40 });

    expect(pointInPolygon({ x: 290, y: 200 }, polygon)).toBe(true); // 90 along x
    expect(pointInPolygon({ x: 200, y: 230 }, polygon)).toBe(true); // 30 along y
    expect(pointInPolygon({ x: 200, y: 250 }, polygon)).toBe(false); // 50 along y
  });

  // The sweep drops segments that lie wholly beyond the sight limit, which is
  // what makes a radius cheaper than unlimited sight instead of dearer. It is
  // only sound because such a segment can neither be hit NOR shadow anything
  // inside the limit — everything it hides is further away than it is. These
  // pin that: pruning must change the answer nowhere.
  describe("pruning segments beyond the limit", () => {
    it("gives the same answer as if the far wall had been kept", () => {
      const near = wall("near", 240, 150, 240, 250);
      const far = wall("far", 380, 0, 380, 400); // 180 away, outside a 120 radius
      const withFar = computeVisionPolygon(origin, [near, far], BOUNDS, { x: 120, y: 120 });
      const withoutFar = computeVisionPolygon(origin, [near], BOUNDS, { x: 120, y: 120 });
      expect(withFar).toEqual(withoutFar);
    });

    it("keeps a wall that only partly reaches inside the limit", () => {
      // Its near end is 61 away, inside the 120 radius; the rest runs far
      // outside it.
      const straddling = wall("straddle", 260, 190, 260, 900);
      const polygon = computeVisionPolygon(origin, [straddling], BOUNDS, { x: 120, y: 120 });
      // Behind it and inside the radius: still occluded.
      expect(pointInPolygon({ x: 300, y: 200 }, polygon)).toBe(false);
      // And the wall did not blind everything else.
      expect(pointInPolygon({ x: 200, y: 140 }, polygon)).toBe(true);
    });

    it("keeps a wall that passes near the origin without either endpoint inside", () => {
      // Both endpoints are 500 away, but the segment crosses 20px from the
      // origin — a bounding-box or endpoint test would wrongly drop it.
      const grazing = wall("graze", -300, 220, 700, 220);
      const polygon = computeVisionPolygon(origin, [grazing], BOUNDS, { x: 120, y: 120 });
      expect(pointInPolygon({ x: 200, y: 260 }, polygon)).toBe(false); // behind it
      expect(pointInPolygon({ x: 200, y: 160 }, polygon)).toBe(true); // in front
    });
  });

  it("blinds a viewer whose radius is zero or negative", () => {
    expect(computeVisionPolygon(origin, [], BOUNDS, { x: 0, y: 0 })).toEqual([]);
    expect(computeVisionPolygon(origin, [], BOUNDS, { x: -5, y: -5 })).toEqual([]);
    // Both consumers already treat a degenerate polygon as "sees nothing".
    expect(pointInPolygon(origin, computeVisionPolygon(origin, [], BOUNDS, { x: 0, y: 0 }))).toBe(
      false,
    );
  });

  it("does not blind a viewer standing outside the document rect", () => {
    const polygon = computeVisionPolygon({ x: -25, y: 200 }, [], BOUNDS, { x: 120, y: 120 });
    expect(pointInPolygon({ x: 50, y: 200 }, polygon)).toBe(true);
    expect(pointInPolygon({ x: 200, y: 200 }, polygon)).toBe(false); // 225 away
  });
});

describe("tokenVisionRadius", () => {
  const grid = { gridSize: 50, gridSquareSize: 5 };

  it("converts feet to document units through the grid", () => {
    // 60 ft / 5 ft per square = 12 squares * 50 px = 600 world px.
    expect(tokenVisionRadius({ radiusFeet: 60, ...grid })).toEqual({ x: 600, y: 600 });
  });

  it("divides by the map scale, because the sweep runs in document space", () => {
    const radius = tokenVisionRadius({
      radiusFeet: 60,
      ...grid,
      mapTransform: { x: 0, y: 0, scaleX: 2, scaleY: 2, rotation: 0 },
    });
    expect(radius).toEqual({ x: 300, y: 300 });
  });

  it("becomes an ellipse under a non-uniform scale", () => {
    const radius = tokenVisionRadius({
      radiusFeet: 60,
      ...grid,
      mapTransform: { x: 0, y: 0, scaleX: 2, scaleY: 4, rotation: 0 },
    });
    expect(radius).toEqual({ x: 300, y: 150 });
  });

  it("ignores rotation — a rotated circle is still a circle", () => {
    const upright = tokenVisionRadius({
      radiusFeet: 60,
      ...grid,
      mapTransform: { x: 12, y: 34, scaleX: 2, scaleY: 2, rotation: 0 },
    });
    const turned = tokenVisionRadius({
      radiusFeet: 60,
      ...grid,
      mapTransform: { x: 12, y: 34, scaleX: 2, scaleY: 2, rotation: 37 },
    });
    expect(turned).toEqual(upright);
  });

  it("ignores a negative scale's sign", () => {
    const radius = tokenVisionRadius({
      radiusFeet: 60,
      ...grid,
      mapTransform: { x: 0, y: 0, scaleX: -2, scaleY: 2, rotation: 0 },
    });
    expect(radius).toEqual({ x: 300, y: 300 });
  });

  it("means UNLIMITED for an unset, null or non-finite radius", () => {
    expect(tokenVisionRadius({ ...grid })).toBeNull();
    expect(tokenVisionRadius({ radiusFeet: undefined, ...grid })).toBeNull();
    expect(tokenVisionRadius({ radiusFeet: null, ...grid })).toBeNull();
    expect(tokenVisionRadius({ radiusFeet: Number.NaN, ...grid })).toBeNull();
    expect(tokenVisionRadius({ radiusFeet: Number.POSITIVE_INFINITY, ...grid })).toBeNull();
  });

  it("means BLIND for zero or negative feet", () => {
    expect(tokenVisionRadius({ radiusFeet: 0, ...grid })).toEqual({ x: 0, y: 0 });
    expect(tokenVisionRadius({ radiusFeet: -30, ...grid })).toEqual({ x: 0, y: 0 });
  });

  it("declines to clip when the grid or scale is unusable", () => {
    expect(tokenVisionRadius({ radiusFeet: 60, gridSize: 0, gridSquareSize: 5 })).toBeNull();
    expect(tokenVisionRadius({ radiusFeet: 60, gridSize: 50, gridSquareSize: 0 })).toBeNull();
    expect(
      tokenVisionRadius({ radiusFeet: 60, gridSize: Number.NaN, gridSquareSize: 5 }),
    ).toBeNull();
    expect(
      tokenVisionRadius({
        radiusFeet: 60,
        ...grid,
        mapTransform: { x: 0, y: 0, scaleX: 0, scaleY: 1, rotation: 0 },
      }),
    ).toBeNull();
  });
});

// The units trap this slice exists to avoid: a radius the DM sets in FEET has
// to survive feet -> squares -> world pixels -> document units, and the map
// transform scales the last step. Getting it wrong shows up as vision that is
// exactly the map's scale factor too big or too small — which is invisible at
// scale 1, the default. So measure the polygon back in WORLD space, where the
// answer is a number the DM would recognise.
describe("computeViewerVisionPolygon keeps the radius honest in world units", () => {
  const transforms: [string, SceneTransform | undefined][] = [
    ["no transform", undefined],
    ["identity", { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }],
    ["translated", { x: 137, y: -64, scaleX: 1, scaleY: 1, rotation: 0 }],
    ["scaled 2x", { x: 0, y: 0, scaleX: 2, scaleY: 2, rotation: 0 }],
    ["scaled 0.5x and moved", { x: -80, y: 220, scaleX: 0.5, scaleY: 0.5, rotation: 0 }],
    ["scaled and rotated", { x: 30, y: 40, scaleX: 1.75, scaleY: 1.75, rotation: 30 }],
  ];

  it.each(transforms)("60 ft reads as 600 world px under %s", (_label, mapTransform) => {
    // Deep inside a deliberately huge document, so the RADIUS is what stops
    // the sweep. Nearer an edge the bounds box would clip first and the test
    // would be measuring the scene rect instead of the radius.
    const worldOrigin = { x: 3000, y: 3000 };
    const polygon = computeViewerVisionPolygon({
      origin: worldOrigin,
      radiusFeet: 60,
      segments: [],
      bounds: { width: 20000, height: 20000 },
      gridSize: 50,
      gridSquareSize: 5,
      mapTransform,
    });

    expect(polygon.length).toBeGreaterThan(8);
    const reaches = polygon.map((vertex) => {
      const world = mapTransform ? transformScenePoint(mapTransform, vertex) : vertex;
      return Math.hypot(world.x - worldOrigin.x, world.y - worldOrigin.y);
    });
    // 60 ft = 12 squares = 600 world px, whatever the map has been scaled to.
    for (const reach of reaches) {
      expect(reach).toBeGreaterThan(599);
      expect(reach).toBeLessThan(601);
    }
  });

  it("puts the origin where the inverse transform puts it", () => {
    const mapTransform: SceneTransform = { x: 30, y: 40, scaleX: 2, scaleY: 2, rotation: 15 };
    const worldOrigin = { x: 500, y: 600 };
    const polygon = computeViewerVisionPolygon({
      origin: worldOrigin,
      radiusFeet: 60,
      segments: [],
      bounds: { width: 4000, height: 4000 },
      gridSize: 50,
      gridSquareSize: 5,
      mapTransform,
    });
    expect(pointInPolygon(inverseTransformScenePoint(mapTransform, worldOrigin), polygon)).toBe(
      true,
    );
  });
});

describe("getVisionBlockingSegments", () => {
  it("collects vision-blocking walls and shut doors, skipping open and transparent ones", () => {
    const scene: CompiledScene = {
      schemaVersion: 1,
      sourceDocumentId: "map",
      sourceRevision: 1,
      compiledAt: 1,
      width: 400,
      height: 400,
      walls: [
        { id: "wall-solid", x1: 0, y1: 0, x2: 10, y2: 0, blocksMovement: true, blocksVision: true },
        {
          id: "wall-window",
          x1: 0,
          y1: 10,
          x2: 10,
          y2: 10,
          blocksMovement: true,
          blocksVision: false,
        },
      ],
      doors: [
        {
          id: "door-shut",
          x1: 0,
          y1: 20,
          x2: 10,
          y2: 20,
          state: "closed",
          blocksMovement: true,
          blocksVision: true,
        },
        {
          id: "door-open",
          x1: 0,
          y1: 30,
          x2: 10,
          y2: 30,
          state: "open",
          blocksMovement: true,
          blocksVision: true,
        },
        {
          id: "door-secret",
          x1: 0,
          y1: 40,
          x2: 10,
          y2: 40,
          state: "secret",
          blocksMovement: true,
          blocksVision: true,
        },
      ],
      lights: [],
    };

    expect(getVisionBlockingSegments(scene).map((segment) => segment.id)).toEqual([
      "wall-solid",
      "door-shut",
      "door-secret",
    ]);
  });
});

// ============================================================================
// S7 — coercing a radius that came off disk
// ============================================================================
// Tokens are the one collection both restore paths copy VERBATIM, so this is
// the only hook between a hand-edited file and the vision geometry.
describe("coerceVisionRadius", () => {
  it("keeps a sane radius unchanged", () => {
    expect(coerceVisionRadius(60)).toBe(60);
    expect(coerceVisionRadius(0)).toBe(0);
    expect(coerceVisionRadius(VISION_RADIUS_MAX_FEET)).toBe(VISION_RADIUS_MAX_FEET);
  });

  it("clamps a radius outside the range instead of handing it to the sweep", () => {
    expect(coerceVisionRadius(-40)).toBe(VISION_RADIUS_MIN_FEET);
    expect(coerceVisionRadius(1e12)).toBe(VISION_RADIUS_MAX_FEET);
  });

  it("degrades anything non-numeric to UNLIMITED, which is how fog always worked", () => {
    expect(coerceVisionRadius(undefined)).toBeUndefined();
    expect(coerceVisionRadius(null)).toBeUndefined();
    expect(coerceVisionRadius("60")).toBeUndefined();
    expect(coerceVisionRadius(Number.NaN)).toBeUndefined();
    expect(coerceVisionRadius(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(coerceVisionRadius({})).toBeUndefined();
  });
});

describe("coerceTokenVisionRadii", () => {
  it("keeps a clean token's identity, so nothing churns on load", () => {
    const token = { id: "t", visionRadius: 60 };
    const [out] = coerceTokenVisionRadii([token]);
    expect(out).toBe(token);
  });

  it("keeps an unset token's identity too", () => {
    const token: { id: string; visionRadius?: number } = { id: "t" };
    const [out] = coerceTokenVisionRadii([token]);
    expect(out).toBe(token);
  });

  it("clones and repairs only the poisoned ones", () => {
    const clean = { id: "clean", visionRadius: 30 };
    const poisoned = { id: "poisoned", visionRadius: -99 };
    const [a, b] = coerceTokenVisionRadii([clean, poisoned]);

    expect(a).toBe(clean);
    expect(b).not.toBe(poisoned);
    expect(b!.visionRadius).toBe(0);
    // The original is untouched — the caller may still hold it.
    expect(poisoned.visionRadius).toBe(-99);
  });

  it("DELETES a garbage radius rather than leaving a sentinel", () => {
    const [out] = coerceTokenVisionRadii([{ id: "t", visionRadius: "sixty" as unknown as number }]);
    expect("visionRadius" in out!).toBe(false);
  });

  it("survives a non-array, which is what a hand-edited file can hold", () => {
    expect(coerceTokenVisionRadii({} as unknown as { visionRadius?: number }[])).toEqual([]);
  });
});
