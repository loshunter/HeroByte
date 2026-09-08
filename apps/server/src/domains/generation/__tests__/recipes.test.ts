// The registry is the ONE dispatch the atlas doors share: exhaustive over
// RECIPE_IDS, guarding params the WS edge never saw, and faithful to the
// recipe it names.

import { describe, expect, it } from "vitest";
import { RECIPE_IDS, createMapDocument } from "@herobyte/shared";
import { buildingRecipe } from "../buildingRecipe.js";
import { dungeonRecipe } from "../dungeonRecipe.js";
import { resolveRecipeContext } from "../recipeContext.js";
import { RECIPES, runRecipe } from "../recipes.js";

const BOUNDS = { x: 0, y: 0, cols: 24, rows: 20 };

function context() {
  const document = createMapDocument({
    id: "doc",
    name: "Doc",
    width: 24 * 50,
    height: 20 * 50,
    timestamp: 1,
  });
  return resolveRecipeContext(document, BOUNDS, "registry-test");
}

describe("the recipe registry", () => {
  it("has exactly one entry per RECIPE_IDS member, each pinned to its own id", () => {
    expect(Object.keys(RECIPES).sort()).toEqual([...RECIPE_IDS].sort());
    for (const id of RECIPE_IDS) {
      expect(RECIPES[id].id).toBe(id);
    }
  });

  it("dispatches to the named recipe with the SAME output as calling it directly", () => {
    const viaRegistry = runRecipe(
      7,
      BOUNDS,
      { recipeId: "dungeon", theme: "wood", density: "low" },
      context(),
    );
    const direct = dungeonRecipe(7, BOUNDS, { theme: "wood", density: "low" }, context());
    expect(viaRegistry).toEqual(direct);
  });

  it("guards params the edge never validated — a server-side caller cannot poison the RNG stream", () => {
    const ctx = context();
    expect(() =>
      runRecipe(7, BOUNDS, { recipeId: "dungeon", theme: "granite", density: "low" } as never, ctx),
    ).toThrow(/theme/);
    expect(() =>
      runRecipe(
        7,
        BOUNDS,
        { recipeId: "dungeon", theme: "stone", density: "packed" } as never,
        ctx,
      ),
    ).toThrow(/density/);
    expect(() =>
      runRecipe(7, BOUNDS, { recipeId: "castle", theme: "stone", density: "low" } as never, ctx),
    ).toThrow();
  });

  it("names the node kind a cashed promise takes", () => {
    expect(RECIPES.dungeon.nodeKind).toBe("dungeon");
    expect(RECIPES.building.nodeKind).toBe("building");
  });

  it("dispatches a BUILDING to the building recipe, and guards its own params", () => {
    const ctx = context();
    const viaRegistry = runRecipe(5, BOUNDS, { recipeId: "building", kind: "shop" }, ctx);
    const direct = buildingRecipe(5, BOUNDS, { recipeId: "building", kind: "shop" }, context());
    expect(viaRegistry).toEqual(direct);

    expect(() =>
      runRecipe(5, BOUNDS, { recipeId: "building", kind: "castle" } as never, ctx),
    ).toThrow(/kind/);
    expect(() =>
      runRecipe(5, BOUNDS, { recipeId: "building", kind: "shop", entrySide: "up" } as never, ctx),
    ).toThrow(/entry side/);
  });

  it("keeps each recipe's params to itself — a dungeon cannot run a building's", () => {
    expect(() =>
      RECIPES.dungeon.assertParams({ recipeId: "building", kind: "shop" } as never),
    ).toThrow(/dungeon recipe cannot run/);
    expect(() =>
      RECIPES.building.assertParams({
        recipeId: "dungeon",
        theme: "stone",
        density: "low",
      } as never),
    ).toThrow(/building recipe cannot run/);
  });
});
