/**
 * cleanTag is the client's half of "one spelling per tag" — the server's
 * normalizeTags is the other, and the two have to agree or a tag the DM sees
 * on a chip is not the tag the shelf stores.
 *
 * The TRIM and the lower-case reach a test through CustomTokenForm; the CAP
 * did not, and it is the one that silently changes what the DM typed.
 */

import { describe, expect, it } from "vitest";
import { CUSTOM_TOKEN_LIMITS } from "@herobyte/shared";
import { ANCESTRY_TAGS, KIND_TAGS, cleanTag } from "../customTokenTags";

describe("cleanTag", () => {
  it("trims, lower-cases and caps at TAG_MAX", () => {
    expect(cleanTag("  Villager ")).toBe("villager");
    expect(cleanTag("HALF-ORC")).toBe("half-orc");
    expect(cleanTag("   ")).toBe("");

    // Past the cap the server would refuse the whole message, so the form
    // truncates rather than sending something the wire drops in silence.
    const long = "a".repeat(CUSTOM_TOKEN_LIMITS.TAG_MAX + 10);
    expect(cleanTag(long)).toHaveLength(CUSTOM_TOKEN_LIMITS.TAG_MAX);
    // Trim FIRST, then cap: padding must not eat characters off the word.
    expect(cleanTag(`  ${"b".repeat(CUSTOM_TOKEN_LIMITS.TAG_MAX)}  `)).toBe(
      "b".repeat(CUSTOM_TOKEN_LIMITS.TAG_MAX),
    );
  });

  it("ships only chips the pipeline leaves alone", () => {
    // A chip whose own label does not survive cleanTag would put a different
    // word on the shelf than the one the DM pressed — and the Kind chips'
    // labels are what impliedStance keys on.
    for (const tag of [...KIND_TAGS, ...ANCESTRY_TAGS]) {
      expect(cleanTag(tag), tag).toBe(tag);
    }
  });
});
