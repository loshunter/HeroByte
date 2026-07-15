// ============================================================================
// RECIPE CONTEXT RESOLVER TESTS
// ============================================================================
// The resolver is the REAL validation gate for generation: server-initiated
// applies bypass the WS zod middleware, so bounds/layer failures must throw
// here, loudly, before any mutation.

import { describe, it, expect } from "vitest";
import { DEFAULT_MAP_LAYERS, type MapDocument } from "@herobyte/shared";
import { resolveRecipeContext } from "../recipeContext.js";
import { makeIdFactory } from "../types.js";

function doc(overrides: Partial<MapDocument> = {}): MapDocument {
  return {
    schemaVersion: 1,
    id: "doc-1",
    name: "Test",
    width: 2048,
    height: 2048,
    grid: {
      type: "square",
      size: 50,
      squareSize: 5,
      offsetX: 0,
      offsetY: 0,
      visible: true,
      snap: true,
    },
    layers: DEFAULT_MAP_LAYERS.map((layer) => ({ ...layer })),
    elements: [],
    revision: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

const BOUNDS = { x: 2, y: 2, cols: 10, rows: 8 };

describe("resolveRecipeContext", () => {
  it("resolves the four layer ids by kind from the default layers", () => {
    const ctx = resolveRecipeContext(doc(), BOUNDS, "cmd");

    expect(ctx.layerIds).toEqual({
      walls: "walls",
      lighting: "lighting",
      notes: "notes",
      objects: "objects",
    });
    expect(ctx.grid.size).toBe(50);
    expect(ctx.idPrefix).toBe("cmd");
  });

  it("skips a locked layer in favor of a later unlocked one of the same kind", () => {
    const document = doc();
    const walls = document.layers.find((layer) => layer.kind === "walls")!;
    walls.locked = true;
    document.layers.push({ ...walls, id: "walls-2", locked: false });

    expect(resolveRecipeContext(document, BOUNDS, "cmd").layerIds.walls).toBe("walls-2");
  });

  it("names the kind when every layer of it is locked", () => {
    const document = doc();
    document.layers.find((layer) => layer.kind === "walls")!.locked = true;

    expect(() => resolveRecipeContext(document, BOUNDS, "cmd")).toThrow(/walls.*locked/);
  });

  it("names the kind when the document has no layer of it", () => {
    const document = doc({ layers: DEFAULT_MAP_LAYERS.filter((l) => l.kind !== "notes") });

    expect(() => resolveRecipeContext(document, BOUNDS, "cmd")).toThrow(/"notes".*none/);
  });

  it("rejects non-integer bounds", () => {
    expect(() => resolveRecipeContext(doc(), { ...BOUNDS, x: 1.5 }, "cmd")).toThrow(/integer/);
  });

  it("rejects bounds below the 8×8 floor", () => {
    expect(() => resolveRecipeContext(doc(), { ...BOUNDS, cols: 7 }, "cmd")).toThrow(/at least/);
    expect(() => resolveRecipeContext(doc(), { ...BOUNDS, rows: 7 }, "cmd")).toThrow(/at least/);
  });

  it("accepts exactly 16384 cells and rejects 16385+", () => {
    // 128×128 = 16384 fits a 6400×6400px doc at size 50 with origin 0.
    const big = doc({ width: 6500, height: 6500 });
    expect(() =>
      resolveRecipeContext(big, { x: 0, y: 0, cols: 128, rows: 128 }, "cmd"),
    ).not.toThrow();
    expect(() => resolveRecipeContext(big, { x: 0, y: 0, cols: 128, rows: 129 }, "cmd")).toThrow(
      /16384/,
    );
  });

  it("rejects a region that leaves the document in pixels (grid offset counted)", () => {
    // 2048px doc, size 50: 40 full cells; x=33,cols=8 → right edge 2050px > 2048.
    expect(() => resolveRecipeContext(doc(), { x: 33, y: 0, cols: 8, rows: 8 }, "cmd")).toThrow(
      /inside the map document/,
    );
    // Same region fits once the offset is negative... but negative left edge
    // must also reject: x=-1 → left = -50px.
    expect(() => resolveRecipeContext(doc(), { x: -1, y: 0, cols: 8, rows: 8 }, "cmd")).toThrow(
      /inside the map document/,
    );
  });
});

describe("makeIdFactory", () => {
  it("emits one kind-free counter sequence", () => {
    const next = makeIdFactory("abc");

    expect([next(), next(), next()]).toEqual(["abc:e0", "abc:e1", "abc:e2"]);
  });
});
