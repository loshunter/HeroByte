// ============================================================================
// RECIPES — the shared vocabulary of the generation doors
// ============================================================================
// What a client asks a recipe for (GenerateRequest) and what a cashed node
// remembers about it (RecipeProvenance). Its own sub-module for the same
// reason as atlas.ts: RECIPE_IDS is a runtime value, and a runtime
// `export const` in the barrel erases to an ambient declaration in the built
// d.ts the server resolves at runtime — the barrel RE-EXPORTS from here.
//
// `size` is ADDED per type, never overridden by intersection: an intersection
// keeps a property required unless it is optional in EVERY constituent, so
// `GenerateRequest & { size?: … }` would silently keep it required. The
// provenance's `size` is optional because nodes cashed before it was recorded
// lack it (a cartridge code cannot be shown for those).

/** Preset dimensions; the server's GENERATE_PRESETS maps these to cells. */
export type GenerateSize = "small" | "medium" | "large";

export interface DungeonRecipeParams {
  recipeId: "dungeon";
  theme: "stone" | "wood";
  density: "low" | "medium" | "high";
  // No secretDoorChance — generated dungeons author no secret doors (the
  // recipe's regularity makes them recoverable from a player's own payload).
}

/** Every recipe's parameters, discriminated by `recipeId`. The building recipe joins here. */
export type RecipeParams = DungeonRecipeParams;
export type RecipeId = RecipeParams["recipeId"];

/** What the atlas doors send: a recipe's parameters plus a preset size. */
export type GenerateRequest = RecipeParams & { size: GenerateSize };

/**
 * What a cashed node remembers: the parameters and the seed (a seed plus a
 * reimplemented recipe is a floor-plan oracle — DM-only on the wire), and the
 * size when it was recorded.
 */
export type RecipeProvenance = RecipeParams & { seed: number; size?: GenerateSize };

/**
 * The registry's key set, for validators and pickers to enumerate. Pinned to
 * the RecipeId union in both directions by recipes.test.ts.
 */
export const RECIPE_IDS = ["dungeon"] as const;
