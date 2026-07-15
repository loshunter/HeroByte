// ============================================================================
// GENERATION DOMAIN — shared recipe types and budgets
// ============================================================================
// Recipes are PURE functions: (seed, bounds, params, ctx) -> RecipeOutput.
// No Math.random, no Date.now, no crypto ids anywhere in this domain — all
// randomness flows from seeded RNG streams and all element ids from the
// idPrefix counter (see the plan's §2.2: the kind-free id shape is a SECURITY
// property — kind-marked ids would let players fingerprint disguised secret
// doors in their wire frames).

import type { MapElement, MapGridSettings, TerrainPaintCell } from "@herobyte/shared";

/** Target region for a recipe, in document-grid CELLS (integers). */
export interface CellBounds {
  x: number;
  y: number;
  cols: number;
  rows: number;
}

export interface DungeonParams {
  theme: "stone" | "wood";
  density: "low" | "medium" | "high";
  /** Probability 0..1 that a generated door is authored "secret". */
  secretDoorChance: number;
}

/**
 * Everything a recipe needs from the target document, resolved once by
 * `resolveRecipeContext` so the recipe itself never touches a MapDocument.
 */
export interface RecipeContext {
  grid: MapGridSettings;
  layerIds: {
    walls: string;
    lighting: string;
    notes: string;
    objects: string;
  };
  idPrefix: string;
}

/** A recipe's output is exactly a `place-room` command payload. */
export interface RecipeOutput {
  cells: TerrainPaintCell[];
  elements: MapElement[];
}

// ---------------------------------------------------------------------------
// Budgets — the recipe must satisfy these BY CONSTRUCTION (one command = one
// undo step; exceeding a cap fails the generate, never silently chunks).
// ---------------------------------------------------------------------------

/** Mirror of shared MAX_TERRAIN_PAINT_CELLS — one place-room's floor budget. */
export const MAX_RECIPE_CELLS = 16384;
/** The add-elements/place-room zod cap; server-side applies respect it anyway. */
export const MAX_RECIPE_ELEMENTS = 5000;
/** Recipe-internal budget for walls + doors + lights + notes. */
export const MAX_GEOMETRY_ELEMENTS = 1000;
/** Recipe-internal budget for scatter stamps (MAX_POPULATE_STAMPS precedent). */
export const MAX_STAMP_ELEMENTS = 2000;
/** Below this, a room plus its 1-cell margins cannot fit. */
export const MIN_RECIPE_COLS = 8;
export const MIN_RECIPE_ROWS = 8;
/** Mirror of shared MAX_TERRAIN_CELL_MAGNITUDE. */
export const MAX_CELL_MAGNITUDE = 65536;

/**
 * Deterministic element ids: ONE shared counter, no kind letters.
 * `${idPrefix}:e0`, `${idPrefix}:e1`, … in emission order.
 */
export function makeIdFactory(idPrefix: string): () => string {
  let counter = 0;
  return () => `${idPrefix}:e${counter++}`;
}
