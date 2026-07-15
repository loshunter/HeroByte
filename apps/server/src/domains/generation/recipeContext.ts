// ============================================================================
// RECIPE CONTEXT RESOLVER
// ============================================================================
// Bridges a MapDocument to the pure recipe world: resolves the four layer ids
// the recipes emit onto and validates the target bounds. Server-initiated
// generate bypasses the WS zod middleware, so the checks here are the REAL
// gate — a bad bounds/layer setup must fail loudly before any mutation.

import type { MapDocument, MapLayer, MapLayerKind } from "@herobyte/shared";
import {
  MAX_CELL_MAGNITUDE,
  MAX_ID_PREFIX_LENGTH,
  MAX_RECIPE_CELLS,
  MAX_RECIPE_ELEMENTS,
  MIN_RECIPE_COLS,
  MIN_RECIPE_ROWS,
  type CellBounds,
  type DungeonParams,
  type RecipeContext,
  type RecipeOutput,
} from "./types.js";

/**
 * Resolve the context a recipe runs against, or throw a plain-English error
 * (surfaced to the DM verbatim via map-studio-error).
 */
export function resolveRecipeContext(
  document: MapDocument,
  bounds: CellBounds,
  idPrefix: string,
): RecipeContext {
  validateIdPrefix(idPrefix);
  validateGrid(document);
  validateBounds(document, bounds);
  return {
    grid: document.grid,
    layerIds: {
      walls: requireUnlockedLayer(document, "walls").id,
      lighting: requireUnlockedLayer(document, "lighting").id,
      notes: requireUnlockedLayer(document, "notes").id,
      objects: requireUnlockedLayer(document, "objects").id,
    },
    idPrefix,
  };
}

/**
 * Validate the recipe inputs the RecipeContext doesn't carry. The WS edge zod
 * already covers these for client messages; this is the gate for any
 * server-side caller that bypasses it (a future Atlas auto-generation), and it
 * stops a NaN seed from silently poisoning the RNG stream.
 */
export function assertGenerateRequest(seed: number, params: DungeonParams): void {
  if (!Number.isInteger(seed)) {
    throw new Error("Generate seed must be an integer");
  }
  if (
    !Number.isFinite(params.secretDoorChance) ||
    params.secretDoorChance < 0 ||
    params.secretDoorChance > 1
  ) {
    throw new Error("Generate secretDoorChance must be between 0 and 1");
  }
}

/**
 * The one-command budget: a recipe that would exceed a cap FAILS loudly rather
 * than silently chunking into several commands (which would cost the DM more
 * than one undo). The cell cap is enforced upstream by the bounds check; this
 * catches the element side, which no shared code caps.
 */
export function assertRecipeBudget(output: RecipeOutput): void {
  if (output.elements.length > MAX_RECIPE_ELEMENTS) {
    throw new Error(
      `Generated map exceeds the ${MAX_RECIPE_ELEMENTS}-element budget for one command — generate a smaller region`,
    );
  }
  if (output.cells.length > MAX_RECIPE_CELLS) {
    throw new Error(
      `Generated map exceeds the ${MAX_RECIPE_CELLS}-cell budget for one command — generate a smaller region`,
    );
  }
}

/**
 * Element ids are `${idPrefix}:e<n>`, and the element-id contract caps ids at
 * 128 chars — a document whose generated ids overflow that would export but
 * never re-import. Cap the prefix with headroom for the suffix.
 */
function validateIdPrefix(idPrefix: string): void {
  if (!idPrefix.trim()) {
    throw new Error("Generate needs a command id to derive element ids from");
  }
  if (idPrefix.length > MAX_ID_PREFIX_LENGTH) {
    throw new Error(`Generate command id must be at most ${MAX_ID_PREFIX_LENGTH} characters`);
  }
}

/**
 * Recipes lay geometry out on a SQUARE cell lattice (`cell * size + offset`).
 * Hex and isometric documents would silently receive rooms that don't line up
 * with the visible grid, so refuse rather than generate garbage. (Square-only
 * matches the live room/hallway tools, which force a square lattice too.)
 */
function validateGrid(document: MapDocument): void {
  if (document.grid.type !== "square") {
    throw new Error(
      `Generate supports square grids only — this map uses a ${document.grid.type} grid`,
    );
  }
  if (!Number.isFinite(document.grid.size) || document.grid.size <= 0) {
    throw new Error("Generate needs a positive grid size");
  }
}

/** First unlocked layer of the kind — recipes never target locked layers. */
function requireUnlockedLayer(document: MapDocument, kind: MapLayerKind): MapLayer {
  const layer = document.layers.find((candidate) => candidate.kind === kind && !candidate.locked);
  if (!layer) {
    const locked = document.layers.some((candidate) => candidate.kind === kind);
    throw new Error(
      locked
        ? `Generate needs an unlocked "${kind}" layer, but every ${kind} layer is locked`
        : `Generate needs a "${kind}" layer, but the document has none`,
    );
  }
  return layer;
}

function validateBounds(document: MapDocument, bounds: CellBounds): void {
  const { x, y, cols, rows } = bounds;
  for (const [label, value] of Object.entries({ x, y, cols, rows })) {
    if (!Number.isInteger(value)) {
      throw new Error(`Generate bounds ${label} must be an integer cell value`);
    }
  }
  if (cols < MIN_RECIPE_COLS || rows < MIN_RECIPE_ROWS) {
    throw new Error(
      `Generate region must be at least ${MIN_RECIPE_COLS}×${MIN_RECIPE_ROWS} cells — anything smaller fits one sealed room, not a dungeon`,
    );
  }
  if (cols * rows > MAX_RECIPE_CELLS) {
    throw new Error(`Generate region exceeds ${MAX_RECIPE_CELLS} cells — drag a smaller area`);
  }
  const extremes = [x, y, x + cols, y + rows];
  if (extremes.some((cell) => Math.abs(cell) > MAX_CELL_MAGNITUDE)) {
    throw new Error("Generate region lies outside the paintable terrain range");
  }
  // The region must sit inside the document in PIXELS (walls/doors/lights are
  // px elements; sanitizeElement and the compile assume in-document geometry).
  const { size, offsetX, offsetY } = document.grid;
  const left = x * size + offsetX;
  const top = y * size + offsetY;
  const right = (x + cols) * size + offsetX;
  const bottom = (y + rows) * size + offsetY;
  if (left < 0 || top < 0 || right > document.width || bottom > document.height) {
    throw new Error("Generate region must lie fully inside the map document");
  }
}
