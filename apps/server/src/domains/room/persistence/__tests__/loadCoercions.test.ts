/**
 * Field-level coercions for a state file read off disk. The token size joined
 * the whitelist with the library's size default: a hand-edited file must not
 * smuggle a size no validator would accept, and a file written before the
 * field existed must load without inventing one.
 */

import { describe, expect, it } from "vitest";
import { coerceLoadedCharacters, coerceTokenSize } from "../loadCoercions.js";

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
});
