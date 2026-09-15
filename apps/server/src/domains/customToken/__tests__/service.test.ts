/**
 * The custom token service: one spelling per tag, a cap on the shelf, and a
 * removal that reports whether anything was there.
 */

import { describe, expect, it } from "vitest";
import { CUSTOM_TOKEN_LIMITS } from "@herobyte/shared";
import { SNAPSHOT_LIMITS } from "../../../middleware/validators/sessionValidators.js";
import { createEmptyRoomState } from "../../room/model.js";
import { CustomTokenService, normalizeTags } from "../service.js";

describe("normalizeTags", () => {
  it("trims, lower-cases, deduplicates, drops empties and caps the list", () => {
    expect(normalizeTags([" Monster ", "monster", "", "  ", "NPC", "Half-Orc"])).toEqual([
      "monster",
      "npc",
      "half-orc",
    ]);
    const many = Array.from({ length: CUSTOM_TOKEN_LIMITS.TAGS_MAX + 5 }, (_, i) => `t${i}`);
    expect(normalizeTags(many)).toHaveLength(CUSTOM_TOKEN_LIMITS.TAGS_MAX);
    expect(normalizeTags(undefined)).toEqual([]);
  });
});

describe("CustomTokenService", () => {
  it("adds a token with a minted id, normalised tags and a default size", () => {
    const state = createEmptyRoomState();
    const service = new CustomTokenService();
    const token = service.add(
      state,
      { name: "  Old Marta ", imageUrl: " https://i.imgur.com/x.png ", tags: ["NPC", "npc"] },
      "dm-1",
    );
    expect(token).not.toBeNull();
    expect(token!.id).toMatch(/[0-9a-f-]{36}/);
    expect(token!.name).toBe("Old Marta");
    expect(token!.imageUrl).toBe("https://i.imgur.com/x.png");
    expect(token!.tags).toEqual(["npc"]);
    expect(token!.size).toBe("medium");
    expect(token!.addedBy).toBe("dm-1");
    expect("description" in token!).toBe(false);
    expect(state.customTokens).toEqual([token]);
  });

  it("keeps a description and an explicit size", () => {
    const state = createEmptyRoomState();
    const token = new CustomTokenService().add(
      state,
      { name: "Ogre", imageUrl: "https://x/o.png", description: " Big. ", size: "large" },
      "dm-1",
    );
    expect(token?.description).toBe("Big.");
    expect(token?.size).toBe("large");
  });

  it("refuses past the cap, which is the snapshot limit", () => {
    expect(CUSTOM_TOKEN_LIMITS.COUNT_MAX).toBe(SNAPSHOT_LIMITS.customTokens);
    const state = createEmptyRoomState();
    const service = new CustomTokenService();
    for (let i = 0; i < CUSTOM_TOKEN_LIMITS.COUNT_MAX; i++) {
      expect(
        service.add(state, { name: `t${i}`, imageUrl: "https://x/t.png" }, "dm"),
      ).not.toBeNull();
    }
    expect(service.add(state, { name: "one more", imageUrl: "https://x/t.png" }, "dm")).toBeNull();
    expect(state.customTokens).toHaveLength(CUSTOM_TOKEN_LIMITS.COUNT_MAX);
  });

  it("removes by id and says whether it did", () => {
    const state = createEmptyRoomState();
    const service = new CustomTokenService();
    const a = service.add(state, { name: "a", imageUrl: "https://x/a.png" }, "dm")!;
    const b = service.add(state, { name: "b", imageUrl: "https://x/b.png" }, "dm")!;
    expect(service.remove(state, a.id)).toBe(true);
    expect(state.customTokens.map((t) => t.id)).toEqual([b.id]);
    expect(service.remove(state, "nope")).toBe(false);
  });
});
