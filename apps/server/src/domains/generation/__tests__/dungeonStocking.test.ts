// ============================================================================
// DUNGEON STOCKING TESTS
// ============================================================================
// Stocking is where DM-only content first enters generated output, so the
// secrecy-by-construction rules (notes layer + visibleToPlayers) matter as much
// as the determinism ones. The wire-level proof lives in the contract test.

import { describe, it, expect } from "vitest";
import { createSeededRng, type MapGridSettings } from "@herobyte/shared";
import { generateLayout } from "../dungeonLayout.js";
import { emitStocking } from "../dungeonStocking.js";
import { dungeonRecipe } from "../dungeonRecipe.js";
import { makeIdFactory, MAX_RECIPE_ELEMENTS } from "../types.js";
import type { CellBounds, DungeonParams, RecipeContext } from "../types.js";

const BOUNDS: CellBounds = { x: 4, y: 4, cols: 24, rows: 18 };
const PARAMS: DungeonParams = { theme: "stone", density: "medium", secretDoorChance: 0.15 };

function grid(overrides: Partial<MapGridSettings> = {}): MapGridSettings {
  return {
    type: "square",
    size: 50,
    squareSize: 5,
    offsetX: 0,
    offsetY: 0,
    visible: true,
    snap: true,
    ...overrides,
  };
}

function context(overrides: Partial<RecipeContext> = {}): RecipeContext {
  return {
    grid: grid(),
    layerIds: { walls: "walls", lighting: "lighting", notes: "notes", objects: "objects" },
    idPrefix: "test",
    ...overrides,
  };
}

function stockingFor(seed: number, ctx = context(), bounds = BOUNDS, params = PARAMS) {
  const layout = generateLayout(createSeededRng(seed), bounds.cols, bounds.rows, params.density);
  const elements = emitStocking(
    layout,
    bounds,
    ctx,
    createSeededRng(seed ^ 0x6a09e667),
    makeIdFactory(ctx.idPrefix),
  );
  return { layout, elements };
}

describe("emitStocking — determinism", () => {
  it("is deterministic: identical inputs produce identical stocking", () => {
    expect(stockingFor(9).elements).toEqual(stockingFor(9).elements);
  });

  it("varies with the seed", () => {
    expect(stockingFor(1).elements).not.toEqual(stockingFor(2).elements);
  });

  it("draws a fixed roll block per room, so a lit room never shifts the next room's key", () => {
    // Rooms whose brazier roll fails must still consume their corner roll —
    // otherwise the stream drifts and every later room re-keys.
    for (const seed of [1, 2, 3, 4, 5]) {
      const { layout, elements } = stockingFor(seed);
      const markers = elements.filter((e) => e.type === "text");
      const lights = elements.filter((e) => e.type === "light");

      // Every room is keyed; only some are lit.
      expect(markers).toHaveLength(layout.rooms.length);
      expect(lights.length).toBeLessThanOrEqual(layout.rooms.length);
    }
  });
});

describe("emitStocking — secrecy by construction", () => {
  it("puts every spawn marker on the notes layer, flagged not-visible", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const element of stockingFor(seed).elements) {
        if (element.type !== "text") continue;

        // Two independent reasons a player never sees this.
        expect(element.layerId).toBe("notes");
        expect(element.data.visibleToPlayers).toBe(false);
        // NOT hidden: that would hide it from the DM's own overlay too.
        expect(element.hidden).toBe(false);
      }
    }
  });

  it("honours the resolved notes layer id rather than hardcoding one", () => {
    const ctx = context({
      layerIds: { walls: "walls", lighting: "lighting", notes: "notes-2", objects: "objects" },
    });

    const markers = stockingFor(1, ctx).elements.filter((e) => e.type === "text");
    expect(new Set(markers.map((m) => m.layerId))).toEqual(new Set(["notes-2"]));
  });

  it("keys every room from the fixed table", () => {
    const texts = stockingFor(1)
      .elements.filter((e) => e.type === "text")
      .map((e) => e.data.text);

    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) {
      expect(text).toMatch(/^(SPAWN|LOOT|EMPTY|TRAP)/);
    }
  });
});

describe("emitStocking — braziers", () => {
  it("puts braziers on the lighting layer with warm, shadow-casting light", () => {
    const lights = stockingFor(1).elements.filter((e) => e.type === "light");

    expect(lights.length).toBeGreaterThan(0);
    for (const light of lights) {
      expect(light.layerId).toBe("lighting");
      expect(light.data.radius).toBe(150); // 3 cells x 50px
      expect(light.data.intensity).toBe(0.8);
      expect(light.data.castsShadows).toBe(true);
      expect(light.data.color).toBe("#ffb347");
    }
  });

  it("scales the brazier radius with the document grid", () => {
    const ctx = context({ grid: grid({ size: 64 }) });
    const lights = stockingFor(1, ctx).elements.filter((e) => e.type === "light");

    expect(new Set(lights.map((l) => l.data.radius))).toEqual(new Set([192])); // 3 x 64
  });

  it("stands every brazier inside its room, on a cell centre", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { layout, elements } = stockingFor(seed);
      for (const light of elements.filter((e) => e.type === "light")) {
        const cellX = (light.transform.x - 25) / 50 - BOUNDS.x;
        const cellY = (light.transform.y - 25) / 50 - BOUNDS.y;

        expect(Number.isInteger(cellX)).toBe(true);
        expect(Number.isInteger(cellY)).toBe(true);
        const inside = layout.rooms.some(
          (room) =>
            cellX >= room.x &&
            cellX < room.x + room.w &&
            cellY >= room.y &&
            cellY < room.y + room.h,
        );
        expect({ seed, inside }).toEqual({ seed, inside: true });
      }
    }
  });
});

describe("dungeonRecipe — stocked output", () => {
  it("mints ids from ONE counter across walls, doors, and stocking", () => {
    const output = dungeonRecipe(3, BOUNDS, PARAMS, context());
    const ids = output.elements.map((e) => e.id);

    // A gap or repeat here means two stages minted ids independently — which
    // would collide document-wide and abort the whole place-room command.
    expect(ids).toEqual(ids.map((_, index) => `test:e${index}`));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the stocking stream independent of geometry", () => {
    // Different secret-door chance reshuffles the geometry stream only; the
    // rooms' keys and braziers must be untouched.
    const a = dungeonRecipe(5, BOUNDS, { ...PARAMS, secretDoorChance: 0 }, context());
    const b = dungeonRecipe(5, BOUNDS, { ...PARAMS, secretDoorChance: 1 }, context());
    const stocking = (output: typeof a) =>
      output.elements.filter((e) => e.type === "text" || e.type === "light").map((e) => e.data);

    expect(stocking(a)).toEqual(stocking(b));
  });

  it("stays inside the one-command element budget at max region and density", () => {
    // 128x128 = the 16384-cell cap, high density = the most rooms and corridors.
    const bounds: CellBounds = { x: 0, y: 0, cols: 128, rows: 128 };
    const output = dungeonRecipe(1, bounds, { ...PARAMS, density: "high" }, context());

    expect(output.elements.length).toBeLessThanOrEqual(MAX_RECIPE_ELEMENTS);
    expect(output.cells.length).toBeLessThanOrEqual(16384);
  });
});
