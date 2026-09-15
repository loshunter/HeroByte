/**
 * What a kind chip says about where a token stands. A rule with a right
 * answer, so it gets a test that does not have to render a form to reach it.
 */

import { describe, expect, it } from "vitest";
import { impliedStance } from "../customTokenStance";

describe("impliedStance", () => {
  it("reads the kind row: a monster fights, an ally does not, the rest are neither", () => {
    expect(impliedStance(["monster"])).toBe("hostile");
    expect(impliedStance(["boss"])).toBe("hostile");
    expect(impliedStance(["ally"])).toBe("friendly");
    for (const tag of ["npc", "traveler", "villager", "prop"]) {
      expect(impliedStance([tag]), tag).toBe("neutral");
    }
  });

  it("says nothing about an ancestry, or a word the DM invented", () => {
    for (const tag of ["elf", "dwarf", "half-orc", "innkeeper", "", "MONSTER"]) {
      expect(impliedStance([tag]), tag).toBeUndefined();
    }
    expect(impliedStance([])).toBeUndefined();
  });

  it("the last kind word wins, and an ancestry between them changes nothing", () => {
    expect(impliedStance(["monster", "ally"])).toBe("friendly");
    expect(impliedStance(["ally", "monster"])).toBe("hostile");
    expect(impliedStance(["villager", "halfling"])).toBe("neutral");
    expect(impliedStance(["halfling", "human"])).toBeUndefined();
  });
});
