// Imports target the later adoption location, not this ignored preparation directory.
import { describe, expect, it } from "vitest";
import { roomBoundsFromDrag } from "../../map-studio/components/mapStudioWorkspaceUtils";
import {
  describeGenerateRegion,
  generateRegionSizeProblem,
  toGenerateCellBounds,
  type GenerateCellBounds,
  type GenerateRectangle,
  type GenerateRegionDescriptor,
  type GenerateRegionDocument,
} from "../generateRegion";

const simple: GenerateRegionDocument = {
  id: "edge-cases",
  width: 1000,
  height: 600,
  grid: { size: 10, offsetX: 0, offsetY: 0 },
};
const validBounds: GenerateCellBounds = { x: 0, y: 0, cols: 20, rows: 20 };

function overlapArea(a: GenerateRectangle, b: GenerateRectangle): number {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

function expectPartition(document: GenerateRegionDocument, region: GenerateRegionDescriptor) {
  const target = region.rectangle;
  if (!target) throw new Error("This fixture requires a drawable target");
  const page = { x: 0, y: 0, width: document.width, height: document.height };
  const parts = [...region.outside, ...(region.intersection ? [region.intersection] : [])];
  for (const part of parts) {
    expect(Object.values(part).every(Number.isFinite)).toBe(true);
    expect(part.width).toBeGreaterThan(0);
    expect(part.height).toBeGreaterThan(0);
    expect(part.x).toBeGreaterThanOrEqual(target.x);
    expect(part.y).toBeGreaterThanOrEqual(target.y);
    expect(part.x + part.width).toBeLessThanOrEqual(target.x + target.width);
    expect(part.y + part.height).toBeLessThanOrEqual(target.y + target.height);
  }
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) expect(overlapArea(parts[i]!, parts[j]!)).toBe(0);
  }
  for (const part of region.outside) expect(overlapArea(part, page)).toBe(0);
  if (region.intersection) {
    expect(overlapArea(region.intersection, page)).toBe(
      region.intersection.width * region.intersection.height,
    );
  }
  const targetArea = target.width * target.height;
  expect(Number.isFinite(targetArea)).toBe(true);
  expect(parts.reduce((sum, part) => sum + part.width * part.height, 0)).toBe(targetArea);
}

function expectInvalid(document: GenerateRegionDocument, bounds: GenerateCellBounds) {
  const region = describeGenerateRegion(document, bounds);
  expect(region.problem?.code).toBe("invalid-geometry");
  expect(region.rectangle).toBeNull();
  expect(region.intersection).toBeNull();
  expect(region.outside).toEqual([]);
  expect(region.outsideEdges).toEqual([]);
}

describe("Generate region numeric and partition additions", () => {
  it.each([
    [-1 / 1024, -1, -2],
    [0, -0, -1],
    [1 / 1024, -0, -1],
  ])("preserves negative half rounding with pixel delta %s", (delta, x, y) => {
    const bounds = toGenerateCellBounds(
      { x: 45 + delta, y: 39 + delta, width: 1280, height: 1280 },
      { size: 64, offsetX: 77, offsetY: 135 },
    );
    expect(bounds.x).toBe(x);
    expect(bounds.y).toBe(y);
    expect(bounds.cols).toBe(20);
    expect(bounds.rows).toBe(20);
    if (Object.is(x, -0)) expect(JSON.parse(JSON.stringify(bounds)).x).toBe(0);
  });

  it.each([false, true])("retains inclusive pointer endpoints with reversed drag=%s", (reverse) => {
    const start = { x: 13, y: 7 };
    const end = { x: 1357, y: 1287 };
    const drag = reverse ? { start: end, end: start } : { start, end };
    const document = {
      ...simple,
      width: 1421,
      height: 1351,
      grid: { size: 64, offsetX: 77, offsetY: 135 },
    };
    const pixels = roomBoundsFromDrag(drag, document.grid.size);
    expect(pixels).toEqual({ x: 13, y: 7, width: 1408, height: 1344 });
    const cells = toGenerateCellBounds(pixels, document.grid);
    expect(cells).toEqual({ x: -1, y: -2, cols: 22, rows: 21 });
    const region = describeGenerateRegion(document, cells);
    expect(region.rectangle).toEqual(pixels);
    expect(region.problem).toBeNull();
    expectPartition(document, region);
  });

  it("accepts exact left/top edges", () => {
    const region = describeGenerateRegion(simple, validBounds);
    expect(region.rectangle).toEqual({ x: 0, y: 0, width: 200, height: 200 });
    expect(region.problem).toBeNull();
    expect(region.outside).toEqual([]);
    expectPartition(simple, region);
  });

  it.each([
    [-20, 0, "left"],
    [0, -20, "top"],
  ] as const)("keeps touching-from-outside cells (%s,%s) outside", (x, y, edge) => {
    const cells = { ...validBounds, x, y };
    const region = describeGenerateRegion(simple, cells);
    expect(region.rectangle).toEqual({ x: x * 10, y: y * 10, width: 200, height: 200 });
    expect(region.intersection).toBeNull();
    expect(region.outside).toEqual([region.rectangle]);
    expect(region.outsideEdges).toEqual([edge]);
    expect(region.problem?.code).toBe("outside-document");
    expect(region.cells).toEqual(cells);
    expect(region.cells).not.toBe(cells);
    expectPartition(simple, region);
  });

  it("partitions a wholly-left target across top and bottom without invented overlap", () => {
    const region = describeGenerateRegion(simple, { x: -30, y: -3, cols: 20, rows: 70 });
    expect(region.rectangle).toEqual({ x: -300, y: -30, width: 200, height: 700 });
    expect(region.intersection).toBeNull();
    expect(region.outsideEdges).toEqual(["left", "top", "bottom"]);
    expect(region.outside).toEqual([
      { x: -300, y: -30, width: 200, height: 30 },
      { x: -300, y: 600, width: 200, height: 70 },
      { x: -300, y: 0, width: 200, height: 600 },
    ]);
    expect(region.outside.reduce((sum, part) => sum + part.width * part.height, 0)).toBe(140000);
    expect(region.problem?.code).toBe("outside-document");
    expectPartition(simple, region);
  });

  it("handles negative offsets without confusing cells with document pixels", () => {
    const document = { ...simple, grid: { size: 10, offsetX: -13, offsetY: -7 } };
    const inside = describeGenerateRegion(document, { ...validBounds, x: 2, y: 1 });
    expect(inside.rectangle).toEqual({ x: 7, y: 3, width: 200, height: 200 });
    expect(inside.problem).toBeNull();
    expectPartition(document, inside);
    const outside = describeGenerateRegion(document, { ...validBounds, x: 1 });
    expect(outside.rectangle).toEqual({ x: -3, y: -7, width: 200, height: 200 });
    expect(outside.intersection).toEqual({ x: 0, y: 0, width: 197, height: 193 });
    expect(outside.outsideEdges).toEqual(["left", "top"]);
    expect(outside.problem?.code).toBe("outside-document");
    expectPartition(document, outside);
  });

  it.each([
    ["width", 0],
    ["width", -1],
    ["width", Infinity],
    ["height", 0],
    ["height", -1],
    ["height", Infinity],
  ] as const)("rejects document %s=%s", (field, value) => {
    expectInvalid({ ...simple, [field]: value }, validBounds);
  });

  it.each([
    ["size", 0],
    ["size", -1],
    ["size", NaN],
    ["size", Infinity],
    ["offsetX", NaN],
    ["offsetX", Infinity],
    ["offsetX", -Infinity],
    ["offsetY", NaN],
    ["offsetY", Infinity],
    ["offsetY", -Infinity],
  ] as const)("rejects grid %s=%s before exposing drawable geometry", (field, value) => {
    const document = { ...simple, grid: { ...simple.grid, [field]: value } };
    expectInvalid(document, validBounds);
    const converted = toGenerateCellBounds({ x: 0, y: 0, width: 200, height: 200 }, document.grid);
    expectInvalid(document, converted);
  });

  it.each([
    ["x", 0.5],
    ["y", 0.5],
    ["cols", 20.5],
    ["rows", 20.5],
    ["cols", 0],
    ["rows", 0],
    ["cols", -1],
    ["rows", -1],
    ["y", NaN],
  ] as const)("rejects unusable cell %s=%s", (field, value) => {
    expectInvalid(simple, { ...validBounds, [field]: value });
  });

  it("requires the descriptor numeric guard, not the legacy size helper alone", () => {
    const bounds = { ...validBounds, cols: NaN };
    expect(generateRegionSizeProblem(bounds)).toBeNull();
    expectInvalid(simple, bounds);
  });

  it("rejects finite cell endpoints whose extent collapses through precision loss", () => {
    const x = 2 ** 60;
    const document = {
      ...simple,
      width: 2 ** 62,
      grid: { size: 1, offsetX: 0, offsetY: 0 },
    };
    expect(x + 20).toBe(x);
    expectInvalid(document, { ...validBounds, x });
  });

  it.each([
    [32, 512, null],
    [20, 819, null],
    [20, 820, "too-large"],
    [19, 1000, "too-small"],
  ] as const)("uses area and minimum-side limits for %s×%s", (cols, rows, problem) => {
    const document = { ...simple, width: 20000, height: 20000 };
    const region = describeGenerateRegion(document, { x: 0, y: 0, cols, rows });
    expect(region.problem?.code ?? null).toBe(problem);
    expect(region.outside).toEqual([]);
    expectPartition(document, region);
  });

  it("keeps pixel-contained geometry drawable but refuses the server cell-range overflow", () => {
    const document = { ...simple, grid: { size: 1, offsetX: -65536, offsetY: 0 } };
    const bounds = { ...validBounds, x: 65536 };
    const region = describeGenerateRegion(document, bounds);
    expect(region.rectangle).toEqual({ x: 0, y: 0, width: 20, height: 20 });
    expect(region.problem?.code).toBe("outside-terrain-range");
    expect(region.cells).toEqual(bounds);
    expectPartition(document, region);
    // x+cols=65556 exceeds 65536 even though every pixel lies inside the document.
  });
});
