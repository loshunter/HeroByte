// ============================================================================
// RECIPE REGISTRY — every atlas generation door dispatches through here
// ============================================================================
// One entry per RecipeId (the shared union): the node kind a cashed promise
// takes, the params guard the WS edge cannot provide for server-side callers
// (assertGenerateRequest checks only the seed), and the pure run. The mapped
// type makes the registry EXHAUSTIVE at compile time — a RecipeId without an
// entry, or an entry for an id outside the union, is a tsc error.
//
// The live-map `map-studio-generate` door still calls dungeonRecipe directly:
// its handler sits at the LOC ceiling, and the picker follow-up (plan §7)
// extracts its generate case first.

import type { AtlasNodeKind, RecipeId, RecipeParams } from "@herobyte/shared";
import { dungeonRecipe } from "./dungeonRecipe.js";
import type { CellBounds, RecipeContext, RecipeOutput } from "./types.js";

export interface Recipe<P extends RecipeParams> {
  id: P["recipeId"];
  /** The kind a promise cashed by this recipe takes. */
  nodeKind: AtlasNodeKind;
  /** Throws a plain-English error for params the recipe cannot run. */
  assertParams(params: RecipeParams): void;
  run(seed: number, bounds: CellBounds, params: P, ctx: RecipeContext): RecipeOutput;
}

type RecipeFor<K extends RecipeId> = Recipe<Extract<RecipeParams, { recipeId: K }>>;

const DUNGEON_THEMES: ReadonlySet<string> = new Set(["stone", "wood"]);
const DUNGEON_DENSITIES: ReadonlySet<string> = new Set(["low", "medium", "high"]);

const dungeon: RecipeFor<"dungeon"> = {
  id: "dungeon",
  nodeKind: "dungeon",
  assertParams(params) {
    const recipeId: string = params.recipeId;
    if (recipeId !== "dungeon") {
      throw new Error(`The dungeon recipe cannot run "${recipeId}" parameters`);
    }
    if (!DUNGEON_THEMES.has(params.theme)) {
      throw new Error("Dungeon theme must be stone or wood");
    }
    if (!DUNGEON_DENSITIES.has(params.density)) {
      throw new Error("Dungeon density must be low, medium or high");
    }
  },
  run: (seed, bounds, params, ctx) =>
    dungeonRecipe(seed, bounds, { theme: params.theme, density: params.density }, ctx),
};

export const RECIPES: { readonly [K in RecipeId]: RecipeFor<K> } = { dungeon };

/** Dispatch by `recipeId`: the guard, then the pure run. */
export function runRecipe(
  seed: number,
  bounds: CellBounds,
  params: RecipeParams,
  ctx: RecipeContext,
): RecipeOutput {
  // The registry pins each entry to its own params type; the dispatch widens
  // once, here, after the discriminant chose the entry.
  const recipe = RECIPES[params.recipeId] as Recipe<RecipeParams>;
  recipe.assertParams(params);
  return recipe.run(seed, bounds, params, ctx);
}
