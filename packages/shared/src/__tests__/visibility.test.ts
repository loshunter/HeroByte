import { describe, expect, it } from "vitest";
import {
  computeVisionPolygon,
  getVisionBlockingSegments,
  pointInPolygon,
  type BlockingSegment,
  type CompiledScene,
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
