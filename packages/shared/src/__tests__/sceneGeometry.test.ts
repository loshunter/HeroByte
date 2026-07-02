import { describe, expect, it } from "vitest";
import { findBlockingSegment, segmentsIntersect, type CompiledScene } from "../index.js";

function point(x: number, y: number) {
  return { x, y };
}

describe("segmentsIntersect", () => {
  it("detects a proper crossing", () => {
    expect(segmentsIntersect(point(0, 0), point(10, 10), point(0, 10), point(10, 0))).toBe(true);
  });

  it("rejects parallel segments that never meet", () => {
    expect(segmentsIntersect(point(0, 0), point(10, 0), point(0, 5), point(10, 5))).toBe(false);
  });

  it("rejects segments whose lines cross outside the segments", () => {
    expect(segmentsIntersect(point(0, 0), point(2, 2), point(0, 10), point(10, 0))).toBe(false);
  });

  it("treats an endpoint touching the other segment as an intersection", () => {
    expect(segmentsIntersect(point(0, 0), point(5, 5), point(0, 10), point(10, 0))).toBe(true);
  });

  it("treats collinear overlap as an intersection", () => {
    expect(segmentsIntersect(point(0, 0), point(10, 0), point(5, 0), point(15, 0))).toBe(true);
  });

  it("rejects collinear segments that do not overlap", () => {
    expect(segmentsIntersect(point(0, 0), point(4, 0), point(5, 0), point(15, 0))).toBe(false);
  });
});

describe("findBlockingSegment", () => {
  const scene: CompiledScene = {
    schemaVersion: 1,
    sourceDocumentId: "map",
    sourceRevision: 1,
    compiledAt: 1,
    walls: [
      { id: "wall-1#0", x1: 50, y1: 0, x2: 50, y2: 100, blocksMovement: true, blocksVision: true },
      {
        id: "curtain",
        x1: 150,
        y1: 0,
        x2: 150,
        y2: 100,
        blocksMovement: false,
        blocksVision: true,
      },
    ],
    doors: [
      {
        id: "door-1",
        x1: 50,
        y1: 100,
        x2: 50,
        y2: 150,
        state: "closed",
        blocksMovement: true,
        blocksVision: true,
      },
      {
        id: "door-open",
        x1: 50,
        y1: 150,
        x2: 50,
        y2: 200,
        state: "open",
        blocksMovement: true,
        blocksVision: true,
      },
    ],
    lights: [],
  };

  it("blocks a move that crosses a blocking wall", () => {
    expect(findBlockingSegment(scene, point(25, 50), point(75, 50))?.id).toBe("wall-1#0");
  });

  it("allows a move that crosses a vision-only wall", () => {
    expect(findBlockingSegment(scene, point(125, 50), point(175, 50))).toBeNull();
  });

  it("blocks a move through a closed door but not an open one", () => {
    expect(findBlockingSegment(scene, point(25, 125), point(75, 125))?.id).toBe("door-1");
    expect(findBlockingSegment(scene, point(25, 175), point(75, 175))).toBeNull();
  });

  it("allows movement that stays on one side", () => {
    expect(findBlockingSegment(scene, point(10, 10), point(40, 90))).toBeNull();
  });

  it("applies the live map transform before testing", () => {
    // Map shifted +100 in x and doubled: the wall at doc x=50 now lives at
    // world x=200. The old crossing no longer collides; a new one does.
    const mapTransform = { x: 100, y: 0, scaleX: 2, scaleY: 2, rotation: 0 };
    expect(findBlockingSegment(scene, point(25, 50), point(75, 50), mapTransform)).toBeNull();
    expect(findBlockingSegment(scene, point(150, 50), point(250, 50), mapTransform)?.id).toBe(
      "wall-1#0",
    );
  });
});
