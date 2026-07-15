// ============================================================================
// DUNGEON RECIPE — seed + region -> a playable dungeon, deterministically
// ============================================================================
// Pure and total: the same (seed, bounds, params, ctx) always yields the same
// rooms, corridors, doors, walls, and floor. That contract is what makes
// Cartridge Codes possible, so nothing here may touch Math.random, Date.now, or
// crypto ids (plan §4.1).

import { createSeededRng } from "@herobyte/shared";
import { generateLayout } from "./dungeonLayout.js";
import { emitGeometry } from "./dungeonGeometry.js";
import type { CellBounds, DungeonParams, RecipeContext, RecipeOutput } from "./types.js";

/**
 * Stream salts (FROZEN — part of the determinism contract). Each stage draws
 * from its OWN generator so a roll-count change inside one stage can never
 * shift the output of the stages after it.
 */
const GEOMETRY_STREAM = 0x1f123bb5;

export function dungeonRecipe(
  seed: number,
  bounds: CellBounds,
  params: DungeonParams,
  ctx: RecipeContext,
): RecipeOutput {
  const layout = generateLayout(createSeededRng(seed), bounds.cols, bounds.rows, params.density);
  return emitGeometry(layout, bounds, params, ctx, createSeededRng(seed ^ GEOMETRY_STREAM));
}
