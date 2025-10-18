import { describe, expect, it } from "vitest";
import type { Drawing, SceneObject } from "@shared";
import { splitFreehandDrawing } from "../utils/splitFreehandDrawing";

type DrawingPoint = { x: number; y: number };
type DrawingSceneObject = SceneObject & { type: "drawing" };

function createSceneDrawing(
  points: DrawingPoint[],
  options: {
    drawing?: Partial<Drawing>;
    transform?: Partial<DrawingSceneObject["transform"]>;
  } = {},
): DrawingSceneObject {
  const drawing = {
    id: "drawing-1",
    type: "freehand" as const,
    points,
    color: "#ff00ff",
    width: 1,
    opacity: 0.8,
    filled: false,
    owner: "player-1",
    ...options.drawing,
  };

  return {
    id: `drawing:${drawing.id}`,
    type: "drawing",
    owner: drawing.owner ?? null,
    locked: false,
    zIndex: 1,
    transform: {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      ...options.transform,
    },
    data: { drawing },
  } satisfies DrawingSceneObject;
}

describe("splitFreehandDrawing", () => {
  it("splits a drawing into two segments when erasing the middle", () => {
    const drawing = createSceneDrawing([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 4, y: 0 },
      { x: 6, y: 0 },
      { x: 8, y: 0 },
      { x: 10, y: 0 },
    ]);

    const segments = splitFreehandDrawing(drawing, [{ x: 5, y: 0 }], 1);

    expect(segments).toHaveLength(2);
    expect(segments[0]?.points).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 4, y: 0 },
    ]);
    expect(segments[1]?.points).toEqual([
      { x: 6, y: 0 },
      { x: 8, y: 0 },
      { x: 10, y: 0 },
    ]);
  });

  it("removes the starting portion when the eraser path intersects the beginning", () => {
    const drawing = createSceneDrawing([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 4, y: 0 },
      { x: 6, y: 0 },
    ]);

    const segments = splitFreehandDrawing(drawing, [{ x: 1, y: 0 }], 1);

    expect(segments).toHaveLength(1);
    expect(segments[0]?.points).toEqual([
      { x: 2, y: 0 },
      { x: 4, y: 0 },
      { x: 6, y: 0 },
    ]);
  });

  it("removes the ending portion when the eraser path intersects the end", () => {
    const drawing = createSceneDrawing([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 4, y: 0 },
      { x: 6, y: 0 },
    ]);

    const segments = splitFreehandDrawing(drawing, [{ x: 5.5, y: 0 }], 1);

    expect(segments).toHaveLength(1);
    expect(segments[0]?.points).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 4, y: 0 },
    ]);
  });

  it("returns an empty array when the eraser removes the entire drawing", () => {
    const drawing = createSceneDrawing([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 8, y: 0 },
    ]);

    const segments = splitFreehandDrawing(
      drawing,
      [
        { x: -1, y: 0 },
        { x: 4, y: 0 },
        { x: 9, y: 0 },
      ],
      6,
    );

    expect(segments).toEqual([]);
  });

  it("handles multiple erase passes and returns three segments", () => {
    const drawing = createSceneDrawing([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 4, y: 0 },
      { x: 6, y: 0 },
      { x: 8, y: 0 },
      { x: 10, y: 0 },
      { x: 12, y: 0 },
    ]);

    const segments = splitFreehandDrawing(
      drawing,
      [
        { x: 3, y: 0 },
        { x: 9, y: 0 },
      ],
      1,
    );

    expect(segments).toHaveLength(3);
    expect(segments[0]?.points).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]);
    expect(segments[1]?.points).toEqual([
      { x: 4, y: 0 },
      { x: 6, y: 0 },
      { x: 8, y: 0 },
    ]);
    expect(segments[2]?.points).toEqual([
      { x: 10, y: 0 },
      { x: 12, y: 0 },
    ]);
  });

  it("filters out segments that contain fewer than two points", () => {
    const drawing = createSceneDrawing([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 6, y: 0 },
      { x: 9, y: 0 },
    ]);

    const segments = splitFreehandDrawing(drawing, [{ x: 6, y: 0 }], 2);

    expect(segments.every((segment) => segment.points.length >= 2)).toBe(true);
  });

  it("preserves drawing properties for each segment", () => {
    const drawing = createSceneDrawing(
      [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 6, y: 0 },
        { x: 9, y: 0 },
      ],
      {
        drawing: {
          color: "#abcdef",
          width: 7,
          opacity: 0.5,
          owner: "artist",
          filled: true,
        },
      },
    );

    const segments = splitFreehandDrawing(drawing, [{ x: 4, y: 0 }], 3);

    for (const segment of segments) {
      expect(segment.color).toBe("#abcdef");
      expect(segment.width).toBe(7);
      expect(segment.opacity).toBe(0.5);
      expect(segment.owner).toBe("artist");
      expect(segment.filled).toBe(true);
      expect(segment.type).toBe("freehand");
    }
  });

  it("handles drawings with transforms applied", () => {
    const drawing = createSceneDrawing(
      [
        { x: -4, y: 0 },
        { x: -2, y: 0 },
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 4, y: 0 },
      ],
      {
        transform: { x: 10, y: 10, rotation: 90, scaleX: 1, scaleY: 1 },
      },
    );

    const eraserPath = [{ x: 10, y: 10 }];

    const segments = splitFreehandDrawing(drawing, eraserPath, 1);

    expect(segments).toHaveLength(2);
    expect(segments[0]?.points).toEqual([
      { x: -4, y: 0 },
      { x: -2, y: 0 },
    ]);
    expect(segments[1]?.points).toEqual([
      { x: 2, y: 0 },
      { x: 4, y: 0 },
    ]);
  });

  it("returns the original drawing when eraser path does not intersect", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 4, y: 0 },
    ];
    const drawing = createSceneDrawing(points);

    const segments = splitFreehandDrawing(
      drawing,
      [
        { x: 0, y: 5 },
        { x: 4, y: 5 },
      ],
      2,
    );

    expect(segments).toHaveLength(1);
    expect(segments[0]?.points).toEqual(points);
    expect(segments[0]).not.toBe(drawing.data.drawing);
  });

  it("keeps segments when the eraser path stays just outside the hit radius", () => {
    const drawing = createSceneDrawing([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ]);

    const segments = splitFreehandDrawing(drawing, [{ x: 2.5, y: 3.1 }], 2);

    expect(segments).toHaveLength(1);
    expect(segments[0]?.points).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ]);
  });
});
