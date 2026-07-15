// ============================================================================
// DUNGEON RECIPE — seed + region -> a playable, stocked dungeon
// ============================================================================
// Pure and total: the same (seed, bounds, params, ctx) always yields the same
// rooms, corridors, doors, walls, floor, lights, and keys. That contract is what
// makes Cartridge Codes possible, so nothing here may touch Math.random,
// Date.now, or crypto ids (plan §4.1).

import { createSeededRng } from "@herobyte/shared";
import { generateLayout } from "./dungeonLayout.js";
import { emitGeometry } from "./dungeonGeometry.js";
import { emitStocking } from "./dungeonStocking.js";
import { makeIdFactory } from "./types.js";
import type { CellBounds, DungeonParams, RecipeContext, RecipeOutput } from "./types.js";

/**
 * Stream salts (FROZEN — part of the determinism contract). Each stage draws
 * from its OWN generator so a roll-count change inside one stage can never
 * shift the output of the stages after it.
 */
const GEOMETRY_STREAM = 0x1f123bb5;
const STOCKING_STREAM = 0x6a09e667;

export function dungeonRecipe(
  seed: number,
  bounds: CellBounds,
  params: DungeonParams,
  ctx: RecipeContext,
): RecipeOutput {
  // ONE id counter across every stage: element ids must be unique document-wide,
  // and their kind-free shape is what stops a player fingerprinting a disguised
  // secret door in their wire frames (plan §2.2).
  const nextId = makeIdFactory(ctx.idPrefix);
  const layout = generateLayout(createSeededRng(seed), bounds.cols, bounds.rows, params.density);
  const geometry = emitGeometry(
    layout,
    bounds,
    params,
    ctx,
    createSeededRng(seed ^ GEOMETRY_STREAM),
    nextId,
  );
  const stocking = emitStocking(
    layout,
    bounds,
    ctx,
    createSeededRng(seed ^ STOCKING_STREAM),
    nextId,
  );

  return { cells: geometry.cells, elements: [...geometry.elements, ...stocking] };
}
