// The recipes vocabulary is mostly TYPES, and the properties that matter are
// type-level: a request must carry a size, a provenance may lack one, and the
// runtime id list must match the union exactly. These pins are checked by the
// package build (tsc typechecks its tests) — the runtime assertions below are
// there so a red line reads as a failure, not a stray directive.

import { describe, expect, it } from "vitest";
import {
  RECIPE_IDS,
  type GenerateRequest,
  type RecipeId,
  type RecipeProvenance,
} from "../recipes.js";

// Both directions: an id in the union but not the list (or the reverse) turns
// one of these `true`s into a type error by name.
type MissingFromList = Exclude<RecipeId, (typeof RECIPE_IDS)[number]>;
type ExtraInList = Exclude<(typeof RECIPE_IDS)[number], RecipeId>;
const noneMissing: [MissingFromList] extends [never] ? true : false = true;
const noneExtra: [ExtraInList] extends [never] ? true : false = true;

describe("recipes — the shared vocabulary", () => {
  it("RECIPE_IDS enumerates exactly the RecipeId union", () => {
    expect(noneMissing && noneExtra).toBe(true);
    expect(RECIPE_IDS).toEqual(["dungeon"]);
  });

  it("size is REQUIRED on a request and OPTIONAL on provenance — added per type, never by intersection", () => {
    const provenanceWithoutSize: RecipeProvenance = {
      recipeId: "dungeon",
      seed: 1,
      theme: "stone",
      density: "low",
    };
    const provenanceWithSize: RecipeProvenance = { ...provenanceWithoutSize, size: "small" };
    // @ts-expect-error — a request without a size is not a request
    const requestWithoutSize: GenerateRequest = {
      recipeId: "dungeon",
      theme: "stone",
      density: "low",
    };
    const request: GenerateRequest = {
      recipeId: "dungeon",
      theme: "stone",
      density: "low",
      size: "medium",
    };

    expect(provenanceWithoutSize.size).toBeUndefined();
    expect(provenanceWithSize.size).toBe("small");
    expect(request.size).toBe("medium");
    expect(requestWithoutSize.recipeId).toBe("dungeon");
  });
});
