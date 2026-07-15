// ============================================================================
// RECIPE CONTEXT RESOLVER TESTS
// ============================================================================
// The resolver is the REAL validation gate for generation: server-initiated
// applies bypass the WS zod middleware, so bounds/layer failures must throw
// here, loudly, before any mutation.

import { describe, it, expect } from "vitest";
import { DEFAULT_MAP_LAYERS, type MapDocument, type MapElement } from "@herobyte/shared";
import {
  assertGenerateRequest,
  assertRecipeBudget,
  resolveRecipeContext,
} from "../recipeContext.js";
import { makeIdFactory, MAX_ID_PREFIX_LENGTH, MAX_RECIPE_ELEMENTS } from "../types.js";

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

const BOUNDS = { x: 2, y: 2, cols: 24, rows: 20 };

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

  it("rejects bounds below the 20×20 floor (smaller fits a sealed box, not a dungeon)", () => {
    expect(() => resolveRecipeContext(doc(), { ...BOUNDS, cols: 19 }, "cmd")).toThrow(/at least/);
    expect(() => resolveRecipeContext(doc(), { ...BOUNDS, rows: 19 }, "cmd")).toThrow(/at least/);
    // ...and accepts exactly the floor.
    expect(() =>
      resolveRecipeContext(doc(), { x: 0, y: 0, cols: 20, rows: 20 }, "cmd"),
    ).not.toThrow();
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
    // 2048px doc, size 50: 40 full cells. x=21,cols=20 → right edge 2050 > 2048.
    expect(() => resolveRecipeContext(doc(), { x: 21, y: 0, cols: 20, rows: 20 }, "cmd")).toThrow(
      /inside the map document/,
    );
    // A negative left edge must reject too: x=-1 → left = -50px.
    expect(() => resolveRecipeContext(doc(), { x: -1, y: 0, cols: 20, rows: 20 }, "cmd")).toThrow(
      /inside the map document/,
    );
  });

  it("refuses non-square grids rather than laying square geometry on them", () => {
    for (const type of ["hex-row", "hex-column", "isometric"] as const) {
      const document = doc();
      document.grid.type = type;
      expect(() => resolveRecipeContext(document, BOUNDS, "cmd")).toThrow(/square grids only/);
    }
  });

  it("rejects an id prefix that would mint element ids over the 128-char cap", () => {
    // 128 chars is a legal commandId elsewhere, but `${prefix}:e0` would be 131.
    const tooLong = "x".repeat(MAX_ID_PREFIX_LENGTH + 1);
    expect(() => resolveRecipeContext(doc(), BOUNDS, tooLong)).toThrow(/at most 120/);
    expect(() =>
      resolveRecipeContext(doc(), BOUNDS, "x".repeat(MAX_ID_PREFIX_LENGTH)),
    ).not.toThrow();
  });
});

describe("assertGenerateRequest", () => {
  const params = { theme: "stone", density: "medium", secretDoorChance: 0.15 } as const;

  it("accepts a well-formed request", () => {
    expect(() => assertGenerateRequest(42, params)).not.toThrow();
  });

  it("rejects a NaN seed before it can poison the RNG stream", () => {
    expect(() => assertGenerateRequest(Number.NaN, params)).toThrow(/seed must be an integer/);
    expect(() => assertGenerateRequest(1.5, params)).toThrow(/seed must be an integer/);
  });

  it("rejects an out-of-range secretDoorChance", () => {
    expect(() => assertGenerateRequest(1, { ...params, secretDoorChance: 1.5 })).toThrow(/between/);
    expect(() => assertGenerateRequest(1, { ...params, secretDoorChance: Number.NaN })).toThrow(
      /between/,
    );
  });
});

describe("assertRecipeBudget", () => {
  function element(id: string): MapElement {
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
          { x: 1, y: 0 },
        ],
        blocksMovement: true,
        blocksVision: true,
      },
    };
  }

  it("accepts output at the element cap", () => {
    const elements = Array.from({ length: MAX_RECIPE_ELEMENTS }, (_, i) => element(`e${i}`));
    expect(() => assertRecipeBudget({ cells: [], elements })).not.toThrow();
  });

  it("fails loudly rather than chunking output past the element cap", () => {
    const elements = Array.from({ length: MAX_RECIPE_ELEMENTS + 1 }, (_, i) => element(`e${i}`));
    expect(() => assertRecipeBudget({ cells: [], elements })).toThrow(/element budget/);
  });
});

describe("makeIdFactory", () => {
  it("emits one kind-free counter sequence", () => {
    const next = makeIdFactory("abc");

    expect([next(), next(), next()]).toEqual(["abc:e0", "abc:e1", "abc:e2"]);
  });
});
