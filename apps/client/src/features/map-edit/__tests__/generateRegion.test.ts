import { describe, expect, it } from "vitest";
import {
  describeGenerateRegion,
  generateRegionSizeProblem,
  toGenerateCellBounds,
  type GenerateCellBounds,
  type GenerateRegionDocument,
} from "../generateRegion";

const asymmetric: GenerateRegionDocument = {
  id: "doc-A",
  width: 1613,
  height: 1671,
  grid: { size: 64, offsetX: 13, offsetY: 7 },
};
const cells = { x: 3, y: 5, cols: 22, rows: 21 };
const simple: GenerateRegionDocument = {
  id: "simple",
  width: 1000,
  height: 600,
  grid: { size: 10, offsetX: 0, offsetY: 0 },
};

describe("Generate normalized document region", () => {
  it("preserves rounded conversion and previews the normalized rectangle, not the raw drag", () => {
    const input = { x: 205.1, y: 326.9, width: 1407.9, height: 1344.1 };
    const normalized = toGenerateCellBounds(input, asymmetric.grid);
    expect(normalized).toEqual(cells);
    expect(describeGenerateRegion(asymmetric, normalized)).toEqual({
      documentId: "doc-A",
      cells,
      rectangle: { x: 205, y: 327, width: 1408, height: 1344 },
      intersection: { x: 205, y: 327, width: 1408, height: 1344 },
      outside: [],
      outsideEdges: [],
      problem: null,
    });
    expect(input).toEqual({ x: 205.1, y: 326.9, width: 1407.9, height: 1344.1 });
  });

  it("accepts legal negative cell coordinates with asymmetric positive offsets", () => {
    const doc = {
      ...asymmetric,
      width: 1421,
      height: 1351,
      grid: { size: 64, offsetX: 77, offsetY: 135 },
    };
    const region = describeGenerateRegion(doc, { x: -1, y: -2, cols: 22, rows: 21 });
    expect(region.rectangle).toEqual({ x: 13, y: 7, width: 1408, height: 1344 });
    expect(region.intersection).toEqual(region.rectangle);
    expect(region.outside).toEqual([]);
    expect(region.problem).toBeNull();
  });

  it.each([
    ["width", 1612, { x: 1612, y: 327, width: 1, height: 1344 }, "right"],
    ["height", 1670, { x: 205, y: 1670, width: 1408, height: 1 }, "bottom"],
  ] as const)(
    "revalidates a one-pixel %s change without clipping the aimed cells",
    (field, size, outside, edge) => {
      const region = describeGenerateRegion({ ...asymmetric, [field]: size }, cells);
      expect(region.cells).toEqual(cells);
      expect(region.rectangle).toEqual({ x: 205, y: 327, width: 1408, height: 1344 });
      expect(region.outside).toEqual([outside]);
      expect(region.outsideEdges).toEqual([edge]);
      expect(region.problem).toEqual({
        code: "outside-document",
        reason: `Generate region must lie fully inside the map document (outside: ${edge}).`,
      });
    },
  );

  it("partitions four crossed edges with each corner counted exactly once", () => {
    const bounds = { x: -2, y: -3, cols: 105, rows: 70 };
    const region = describeGenerateRegion(simple, bounds);
    expect(region.rectangle).toEqual({ x: -20, y: -30, width: 1050, height: 700 });
    expect(region.intersection).toEqual({ x: 0, y: 0, width: 1000, height: 600 });
    expect(region.outsideEdges).toEqual(["left", "top", "right", "bottom"]);
    expect(region.outside).toEqual([
      { x: -20, y: -30, width: 1050, height: 30 },
      { x: -20, y: 600, width: 1050, height: 70 },
      { x: -20, y: 0, width: 20, height: 600 },
      { x: 1000, y: 0, width: 30, height: 600 },
    ]);
    expect(region.outside.reduce((sum, part) => sum + part.width * part.height, 0)).toBe(135000);
    expect(region.cells).toEqual(bounds);
    expect(region.problem?.code).toBe("outside-document");
  });

  it("counts positive offsets when the cell dimensions alone look like an exact fit", () => {
    const doc = { ...simple, height: 1000, grid: { size: 50, offsetX: 13, offsetY: 7 } };
    const region = describeGenerateRegion(doc, { x: 0, y: 0, cols: 20, rows: 20 });
    expect(region.intersection).toEqual({ x: 13, y: 7, width: 987, height: 993 });
    expect(region.outsideEdges).toEqual(["right", "bottom"]);
    expect(region.outside).toEqual([
      { x: 13, y: 1000, width: 1000, height: 7 },
      { x: 1000, y: 7, width: 13, height: 993 },
    ]);
  });

  it.each([
    [-30, -40, ["left", "top"]],
    [-30, 2, ["left"]],
    [101, 2, ["right"]],
    [101, 70, ["right", "bottom"]],
  ] as const)("keeps the complete wholly outside target at cells (%i,%i)", (x, y, edges) => {
    const region = describeGenerateRegion(simple, { x, y, cols: 20, rows: 20 });
    expect(region.rectangle).toEqual({ x: x * 10, y: y * 10, width: 200, height: 200 });
    expect(region.intersection).toBeNull();
    expect(region.outside).toEqual([region.rectangle]);
    expect(region.outsideEdges).toEqual(edges);
    expect(region.problem?.code).toBe("outside-document");
  });

  it("retains the exact size limits, null behavior, and minimum-before-area reason", () => {
    expect(generateRegionSizeProblem(null)).toBeNull();
    expect(generateRegionSizeProblem({ x: 0, y: 0, cols: 20, rows: 20 })).toBeNull();
    expect(generateRegionSizeProblem({ x: 0, y: 0, cols: 128, rows: 128 })).toBeNull();
    expect(generateRegionSizeProblem({ x: 0, y: 0, cols: 19, rows: 1000 })).toBe(
      "Drag at least 20×20 cells — a dungeon needs room for rooms AND the halls between them.",
    );
    expect(generateRegionSizeProblem({ x: 0, y: 0, cols: 129, rows: 128 })).toBe(
      "That area is too big (max 16384 cells) — drag a smaller region.",
    );
    const small = describeGenerateRegion(simple, { x: -1, y: 0, cols: 19, rows: 20 });
    expect(small.problem?.code).toBe("too-small");
    expect(small.outside).toEqual([{ x: -10, y: 0, width: 10, height: 200 }]);
  });

  it.each([
    [{ ...simple, grid: { ...simple.grid, size: 0 } }, cells],
    [{ ...simple, width: Number.NaN }, cells],
    [{ ...simple, grid: { ...simple.grid, size: Number.MAX_VALUE } }, cells],
    [simple, { ...cells, x: Number.POSITIVE_INFINITY }],
  ] satisfies [GenerateRegionDocument, GenerateCellBounds][])(
    "refuses unusable numeric geometry without inventing a drawable rectangle",
    (doc, bounds) => {
      const region = describeGenerateRegion(doc, bounds);
      expect(region.problem?.code).toBe("invalid-geometry");
      expect(region.rectangle).toBeNull();
      expect(region.intersection).toBeNull();
      expect(region.outside).toEqual([]);
    },
  );
});
