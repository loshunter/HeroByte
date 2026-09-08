// ============================================================================
// RECIPE IDS — the seeded permutation every recipe's elements are named by
// ============================================================================
// Extracted from dungeonRecipe so the building recipe shares it rather than
// re-deriving the reasoning. See shuffleIds for why a sequential counter is a
// privacy defect and a permutation is the fix.

import type { MapElement, SeededRng } from "@herobyte/shared";

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
export function shuffleIds(elements: MapElement[], idPrefix: string, rng: SeededRng): MapElement[] {
  const order = elements.map((_, index) => index);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return elements.map((element, index) => ({ ...element, id: `${idPrefix}:e${order[index]}` }));
}
