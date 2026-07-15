// ============================================================================
// DUNGEON RECIPE — seed + region -> a playable, stocked dungeon
// ============================================================================
// Pure and total: the same (seed, bounds, params, ctx) always yields the same
// rooms, corridors, doors, walls, floor, lights, and keys. That contract is what
// makes Cartridge Codes possible, so nothing here may touch Math.random,
// Date.now, or crypto ids (plan §4.1).

import { createSeededRng, type MapElement, type SeededRng } from "@herobyte/shared";
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
const ID_STREAM = 0x85ebca6b;

export function dungeonRecipe(
  seed: number,
  bounds: CellBounds,
  params: DungeonParams,
  ctx: RecipeContext,
): RecipeOutput {
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

  return {
    cells: geometry.cells,
    elements: shuffleIds(
      [...geometry.elements, ...stocking],
      ctx.idPrefix,
      createSeededRng(seed ^ ID_STREAM),
    ),
  };
}

/**
 * Re-mint every element id from a SEEDED PERMUTATION of 0..n-1.
 *
 * Plan §2.2 made the id shape kind-free so a player could not fingerprint a
 * disguised secret door — but the emission ORDER is kind-grouped (walls, then
 * doors, then stocking), so a sequential counter made the ORDINAL the kind tag:
 * every wall's number fell below every door's, and a disguised secret door
 * arrived in the player's wall list carrying a door-range number. A gate
 * reproduced it at 27/32 recall with zero false positives.
 *
 * Permuting breaks the ordinal's correlation with kind outright. It also makes
 * the id GAPS meaningless — a player sees an arbitrary subset of the numbers
 * either way, so a missing ordinal no longer implies anything was hidden.
 *
 * Deterministic: seeded Fisher-Yates on its own frozen stream, so it cannot
 * shift the other stages.
 */
function shuffleIds(elements: MapElement[], idPrefix: string, rng: SeededRng): MapElement[] {
  const order = elements.map((_, index) => index);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return elements.map((element, index) => ({ ...element, id: `${idPrefix}:e${order[index]}` }));
}
