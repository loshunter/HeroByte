import { describe, expect, it } from "vitest";
import {
  AREA_TEMPLATE_KINDS,
  MAX_TEMPLATE_FEET,
  MAX_TEMPLATE_SQUARES,
  TEMPLATE_CIRCLE_SEGMENTS,
  buildAreaTemplate,
  coerceAreaTemplate,
  formatAreaTemplate,
  type AreaTemplateKind,
  type TemplatePoint,
} from "../areaTemplates.js";

const GRID = 50;
const FEET = 5;

function build(kind: AreaTemplateKind, origin: TemplatePoint, aim: TemplatePoint) {
  return buildAreaTemplate({ kind, origin, aim, gridSize: GRID, gridSquareSize: FEET });
}

/** Axis-aligned bounding box of a polygon, for size assertions. */
function bounds(points: TemplatePoint[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

describe("buildAreaTemplate — snapping and sizing", () => {
  it("snaps the origin to the nearest half-grid step, so a circle can centre on a token", () => {
    // Cell (2,2)'s centre is (125,125); a drag that starts 6px off still
    // centres on the creature standing there.
    const result = build("circle", { x: 131, y: 119 }, { x: 231, y: 119 });
    expect(result.origin).toEqual({ x: 125, y: 125 });
  });

  it("snaps a square's origin to a grid CORNER so its sides sit on grid lines", () => {
    const result = build("square", { x: 131, y: 119 }, { x: 231, y: 219 });
    expect(result.origin).toEqual({ x: 150, y: 100 });
  });

  it("rounds size to whole squares", () => {
    // 130px is 2.6 squares -> 3 squares -> 15 ft.
    expect(build("circle", { x: 0, y: 0 }, { x: 130, y: 0 }).template.sizeFeet).toBe(15);
    // 110px is 2.2 squares -> 2 squares -> 10 ft.
    expect(build("circle", { x: 0, y: 0 }, { x: 110, y: 0 }).template.sizeFeet).toBe(10);
  });

  it("never produces a zero-size template", () => {
    for (const kind of AREA_TEMPLATE_KINDS) {
      const result = build(kind, { x: 100, y: 100 }, { x: 100, y: 100 });
      expect(result.template.sizeFeet).toBe(FEET);
      expect(result.points.length).toBeGreaterThan(2);
      for (const point of result.points) {
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
      }
    }
  });

  it("caps an absurd drag at MAX_TEMPLATE_SQUARES", () => {
    const result = build("circle", { x: 0, y: 0 }, { x: 1_000_000, y: 0 });
    expect(result.template.sizeFeet).toBe(MAX_TEMPLATE_SQUARES * FEET);
  });

  it("scales feet with the room's square size", () => {
    const result = buildAreaTemplate({
      kind: "circle",
      origin: { x: 0, y: 0 },
      aim: { x: 150, y: 0 },
      gridSize: GRID,
      gridSquareSize: 10,
    });
    expect(result.template.sizeFeet).toBe(30);
  });

  it("returns an empty polygon rather than NaN when there is no grid", () => {
    for (const gridSize of [0, -1, Number.NaN]) {
      const result = buildAreaTemplate({
        kind: "cone",
        origin: { x: 0, y: 0 },
        aim: { x: 100, y: 100 },
        gridSize,
        gridSquareSize: FEET,
      });
      expect(result.points).toEqual([]);
    }
  });
});

describe("buildAreaTemplate — circle", () => {
  it("is a closed polygon of the fixed segment count, centred on the origin", () => {
    const result = build("circle", { x: 100, y: 100 }, { x: 250, y: 100 });
    expect(result.points).toHaveLength(TEMPLATE_CIRCLE_SEGMENTS);
    // Radius 3 squares = 150px, so the box is 300px across, centred at 100,100.
    const box = bounds(result.points);
    expect(box.minX).toBeCloseTo(-50, 6);
    expect(box.maxX).toBeCloseTo(250, 6);
    expect(box.minY).toBeCloseTo(-50, 6);
    expect(box.maxY).toBeCloseTo(250, 6);
  });

  it("puts every vertex exactly one radius from the centre", () => {
    const result = build("circle", { x: 100, y: 100 }, { x: 200, y: 100 });
    for (const point of result.points) {
      expect(Math.hypot(point.x - 100, point.y - 100)).toBeCloseTo(100, 6);
    }
  });

  it("ignores drag direction — a circle is a circle", () => {
    const right = build("circle", { x: 100, y: 100 }, { x: 250, y: 100 });
    const up = build("circle", { x: 100, y: 100 }, { x: 100, y: -50 });
    expect(right.template).toEqual(up.template);
  });
});

describe("buildAreaTemplate — cone", () => {
  it("is a triangle whose far edge is as wide as the cone is long (5e)", () => {
    const result = build("cone", { x: 100, y: 100 }, { x: 250, y: 100 });
    expect(result.points).toHaveLength(3);
    expect(result.points[0]).toEqual({ x: 100, y: 100 });
    // Length 150px pointing +x; the base spans 150px across at x = 250.
    const [, a, b] = result.points;
    expect(a.x).toBeCloseTo(250, 6);
    expect(b.x).toBeCloseTo(250, 6);
    expect(Math.abs(a.y - b.y)).toBeCloseTo(150, 6);
  });

  it("points wherever the drag points", () => {
    const down = build("cone", { x: 100, y: 100 }, { x: 100, y: 250 });
    const [apex, a, b] = down.points;
    expect(apex).toEqual({ x: 100, y: 100 });
    expect(a.y).toBeCloseTo(250, 6);
    expect(b.y).toBeCloseTo(250, 6);
    expect(Math.abs(a.x - b.x)).toBeCloseTo(150, 6);
  });

  it("keeps a 15 ft cone at 15 ft when aimed diagonally", () => {
    const result = build("cone", { x: 100, y: 100 }, { x: 100 + 106, y: 100 + 106 });
    expect(result.template.sizeFeet).toBe(15);
    const apex = result.points[0];
    const midX = (result.points[1].x + result.points[2].x) / 2;
    const midY = (result.points[1].y + result.points[2].y) / 2;
    expect(Math.hypot(midX - apex.x, midY - apex.y)).toBeCloseTo(150, 6);
  });
});

describe("buildAreaTemplate — square (the cube)", () => {
  it("extends from the snapped corner into the quadrant the pointer is in", () => {
    const result = build("square", { x: 100, y: 100 }, { x: 230, y: 180 });
    expect(result.points).toEqual([
      { x: 100, y: 100 },
      { x: 250, y: 100 },
      { x: 250, y: 250 },
      { x: 100, y: 250 },
    ]);
    expect(result.template.sizeFeet).toBe(15);
  });

  it("extends backwards when the pointer is up and left", () => {
    const result = build("square", { x: 100, y: 100 }, { x: 10, y: 40 });
    expect(result.points).toEqual([
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    expect(result.template.sizeFeet).toBe(10);
  });

  it("sizes by the longer side, not the diagonal the pointer travelled", () => {
    // hypot(150,150) is 212px = 4.2 squares; the cube is still 3 squares.
    const result = build("square", { x: 0, y: 0 }, { x: 150, y: 150 });
    expect(result.template.sizeFeet).toBe(15);
    const box = bounds(result.points);
    expect(box.maxX - box.minX).toBe(150);
    expect(box.maxY - box.minY).toBe(150);
  });
});

describe("buildAreaTemplate — line", () => {
  it("is a rectangle one square wide running from origin to tip", () => {
    const result = build("line", { x: 100, y: 100 }, { x: 250, y: 100 });
    expect(result.points).toHaveLength(4);
    const box = bounds(result.points);
    expect(box.maxX - box.minX).toBeCloseTo(150, 6);
    expect(box.maxY - box.minY).toBeCloseTo(GRID, 6);
    expect(result.template.sizeFeet).toBe(15);
  });

  it("stays one square wide at any angle", () => {
    const result = build("line", { x: 100, y: 100 }, { x: 206, y: 206 });
    const [a, , , d] = result.points;
    // First and last vertex are the two corners at the origin end.
    expect(Math.hypot(a.x - d.x, a.y - d.y)).toBeCloseTo(GRID, 6);
  });
});

describe("coerceAreaTemplate", () => {
  it("accepts a well-formed template", () => {
    expect(coerceAreaTemplate({ kind: "cone", sizeFeet: 15 })).toEqual({
      kind: "cone",
      sizeFeet: 15,
    });
  });

  it("rejects anything that is not a real kind with a real size", () => {
    expect(coerceAreaTemplate(undefined)).toBeUndefined();
    expect(coerceAreaTemplate(null)).toBeUndefined();
    expect(coerceAreaTemplate("cone")).toBeUndefined();
    expect(coerceAreaTemplate({ kind: "hypercube", sizeFeet: 15 })).toBeUndefined();
    expect(coerceAreaTemplate({ kind: "cone" })).toBeUndefined();
    expect(coerceAreaTemplate({ kind: "cone", sizeFeet: 0 })).toBeUndefined();
    expect(coerceAreaTemplate({ kind: "cone", sizeFeet: -5 })).toBeUndefined();
    expect(coerceAreaTemplate({ kind: "cone", sizeFeet: Number.NaN })).toBeUndefined();
    expect(coerceAreaTemplate({ kind: "cone", sizeFeet: "15" })).toBeUndefined();
    // The polygon is the truth about coverage, but the LABEL is read by
    // humans: an unbounded size lets a tampered client caption a 5 ft circle
    // "999999 ft circle".
    expect(coerceAreaTemplate({ kind: "cone", sizeFeet: MAX_TEMPLATE_FEET + 1 })).toBeUndefined();
    expect(coerceAreaTemplate({ kind: "cone", sizeFeet: MAX_TEMPLATE_FEET })).toEqual({
      kind: "cone",
      sizeFeet: MAX_TEMPLATE_FEET,
    });
  });

  it("drops extra fields rather than passing them through to state", () => {
    const coerced = coerceAreaTemplate({ kind: "circle", sizeFeet: 20, evil: "payload" });
    expect(coerced).toEqual({ kind: "circle", sizeFeet: 20 });
  });
});

describe("formatAreaTemplate", () => {
  it("names the area the way the readout does", () => {
    expect(formatAreaTemplate({ kind: "cone", sizeFeet: 15 })).toBe("15 ft cone");
    expect(formatAreaTemplate({ kind: "circle", sizeFeet: 20 })).toBe("20 ft circle");
  });

  it("does not print binary floating-point noise on a fractional grid", () => {
    // gridSquareSize may be 0.1 (the validator allows it), and 3 * 0.1 is
    // 0.30000000000000004. Nobody wants to read that on a battlemat.
    const built = buildAreaTemplate({
      kind: "circle",
      origin: { x: 0, y: 0 },
      aim: { x: 150, y: 0 },
      gridSize: GRID,
      gridSquareSize: 0.1,
    });
    expect(formatAreaTemplate(built.template)).toBe("0.3 ft circle");
  });
});
