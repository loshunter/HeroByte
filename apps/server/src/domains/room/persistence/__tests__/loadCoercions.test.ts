/**
 * Field-level coercions for a state file read off disk. The token size joined
 * the whitelist with the library's size default: a hand-edited file must not
 * smuggle a size no validator would accept, and a file written before the
 * field existed must load without inventing one.
 */

import { describe, expect, it } from "vitest";
import { CUSTOM_TOKEN_LIMITS } from "@herobyte/shared";
import { coerceCustomTokens, coerceLoadedCharacters, coerceTokenSize } from "../loadCoercions.js";

describe("coerceCustomTokens", () => {
  const good = {
    id: "ct-1",
    name: "Old Marta",
    imageUrl: "https://i.imgur.com/x.png",
    description: "Innkeeper.",
    tags: ["npc", "villager"],
    size: "small",
    addedBy: "dm",
    addedAt: 5,
  };

  it("keeps a well-formed entry as it is", () => {
    expect(coerceCustomTokens([good])).toEqual([good]);
  });

  it("drops entries missing an id, a name or an image, and non-objects", () => {
    expect(
      coerceCustomTokens([
        { ...good, id: "" },
        { ...good, name: 3 },
        { ...good, imageUrl: undefined },
        null,
        "x",
        good,
      ]),
    ).toEqual([good]);
    expect(coerceCustomTokens(undefined)).toEqual([]);
    expect(coerceCustomTokens({ id: "ct-1" })).toEqual([]);
  });

  it("repairs the fields with a domain rather than trusting the file", () => {
    const [token] = coerceCustomTokens([
      { id: "ct-2", name: "Ogre", imageUrl: "https://x/o.png", tags: ["big", 3], size: "enormous" },
    ]);
    expect(token).toEqual({
      id: "ct-2",
      name: "Ogre",
      imageUrl: "https://x/o.png",
      tags: ["big"],
      size: "medium",
      addedBy: "",
      addedAt: 0,
    });
  });

  it("keeps a valid stance on a shelf token and drops every other shape of one", () => {
    expect(coerceCustomTokens([{ ...good, disposition: "friendly" }])[0]).toMatchObject({
      disposition: "friendly",
    });
    // "enemy" is the card's LABEL, not the stored word — a hand-edited file's
    // likeliest mistake, and one that must not become a value the wire refuses.
    for (const bad of ["enemy", "", 3, null, {}]) {
      const [token] = coerceCustomTokens([{ ...good, disposition: bad }]);
      expect(token, String(bad)).not.toHaveProperty("disposition");
    }
  });

  it("keeps a string thumbnail and drops every other shape of one", () => {
    const thumbUrl = `/assets/${"a".repeat(64)}`;
    expect(coerceCustomTokens([{ ...good, thumbUrl }])[0]).toMatchObject({ thumbUrl });
    for (const bad of [7, "", null, {}, ["x"]]) {
      const [token] = coerceCustomTokens([{ ...good, thumbUrl: bad }]);
      expect(token, String(bad)).not.toHaveProperty("thumbUrl");
    }
  });

  it("holds BOTH pictures to the wire's rule, because both leave this process", () => {
    // A pick turns imageUrl into an NPC's tokenImage and broadcasts it to
    // every player's image loader; thumbUrl rides the picker's grid the same
    // way. Every address below is one add-custom-token refuses, and the door
    // used to take any non-empty string at all.
    const refused = [
      "data:text/html,<script>alert(1)</script>",
      "javascript:alert(1)",
      "http://attacker.example/x.png",
      "//attacker.example/x.png",
      "cat.png",
      `https://cdn.example.com/${"a".repeat(CUSTOM_TOKEN_LIMITS.URL_MAX)}.png`,
    ];
    for (const bad of refused) {
      expect(coerceCustomTokens([{ ...good, imageUrl: bad }]), bad).toEqual([]);
      const [token] = coerceCustomTokens([{ ...good, thumbUrl: bad }]);
      expect(token, bad).not.toHaveProperty("thumbUrl");
    }
    // The three shapes the wire DOES take, so nothing on a real shelf is lost.
    for (const okUrl of [
      "https://i.imgur.com/x.png",
      "/tokens/NPC/Enemies/Goblins/goblinClub.png",
      `http://localhost:8788/assets/${"a".repeat(64)}`,
    ]) {
      expect(coerceCustomTokens([{ ...good, imageUrl: okUrl }])[0], okUrl).toMatchObject({
        imageUrl: okUrl,
      });
    }
  });

  it("bounds the text fields the wire bounds, rather than the collection limit alone", () => {
    const long = (n: number) => "a".repeat(n);
    // A name past NAME_MAX is an entry the wire never would have seated.
    expect(coerceCustomTokens([{ ...good, name: long(CUSTOM_TOKEN_LIMITS.NAME_MAX + 1) }])).toEqual(
      [],
    );
    const [token] = coerceCustomTokens([
      {
        ...good,
        description: long(CUSTOM_TOKEN_LIMITS.DESCRIPTION_MAX + 1),
        tags: [long(CUSTOM_TOKEN_LIMITS.TAG_MAX + 1), "npc", ...Array(20).fill("filler")],
      },
    ]);
    // The blurb is optional, so an over-long one loses the field, not the token.
    expect(token).not.toHaveProperty("description");
    expect(token.tags).toHaveLength(CUSTOM_TOKEN_LIMITS.TAGS_MAX);
    expect(token.tags).not.toContain(long(CUSTOM_TOKEN_LIMITS.TAG_MAX + 1));
    expect(token.tags[0]).toBe("npc");
  });
});

describe("coerceTokenSize", () => {
  it("keeps every rung of the ladder and nothing else", () => {
    for (const size of ["tiny", "small", "medium", "large", "huge", "gargantuan"]) {
      expect(coerceTokenSize(size)).toBe(size);
    }
    for (const bad of ["enormous", "", 2, null, undefined, { size: "large" }, ["large"]]) {
      expect(coerceTokenSize(bad), JSON.stringify(bad)).toBeUndefined();
    }
  });
});

describe("coerceLoadedCharacters — tokenSize", () => {
  const base = { id: "c1", type: "npc", name: "Ogre", hp: 59, maxHp: 59 };

  it("keeps a size on the ladder", () => {
    const [ogre] = coerceLoadedCharacters([{ ...base, tokenSize: "large" }]);
    expect(ogre?.tokenSize).toBe("large");
  });

  it("drops a size off the ladder without leaving the key behind", () => {
    const [ogre] = coerceLoadedCharacters([{ ...base, tokenSize: "enormous" }]);
    expect(ogre).toBeDefined();
    expect("tokenSize" in ogre!).toBe(false);
  });

  it("a file from before the field loads as it always did", () => {
    const [ogre] = coerceLoadedCharacters([base]);
    expect("tokenSize" in ogre!).toBe(false);
    expect(ogre?.type).toBe("npc");
  });

  it("the same rule for a stance: on the list or gone", () => {
    expect(coerceLoadedCharacters([{ ...base, disposition: "neutral" }])[0]?.disposition).toBe(
      "neutral",
    );
    for (const bad of ["enemy", "", 3, null]) {
      const [ogre] = coerceLoadedCharacters([{ ...base, disposition: bad }]);
      expect("disposition" in ogre!, String(bad)).toBe(false);
    }
    expect("disposition" in coerceLoadedCharacters([base])[0]!).toBe(false);
  });
});
