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

describe("a mimic flip carries a stance, both ways", () => {
  it("revealed turns hostile, disguised turns neutral, ordinary art touches neither", async () => {
    const { useNpcAssetPick } = await import("../../hooks/useNpcAssetPick");
    const { libraryAssetById, packItem } = await import("../tokenCatalog");

    const applied: unknown[] = [];
    const pick = useNpcAssetPick("", (next) => applied.push(next));

    // The guide tells DMs to set the closed chest Neutral so the party sees a
    // prop. 🎭 REVEAL MIMIC is the moment that lie ends — without this the
    // thing with teeth still reads Neutral in gold on every player's card.
    pick(packItem(libraryAssetById("mimicChest")!));
    expect(applied.at(-1)).toMatchObject({ disposition: "hostile" });

    // And 🎭 DISGUISE is the same promise run backwards. It was one-way: the
    // art went back to a closed chest and the card stayed Enemy in red, which
    // is the exact tell the guide's Neutral instruction exists to suppress.
    pick(packItem(libraryAssetById("mimicChestHidden")!));
    expect(applied.at(-1)).toMatchObject({ disposition: "neutral" });

    // Everything else is the DM's: re-skinning an ogre as the baker does not
    // make it friendly.
    pick(packItem(libraryAssetById("goblinClub")!));
    expect(applied.at(-1)).not.toHaveProperty("disposition");
  });
});
