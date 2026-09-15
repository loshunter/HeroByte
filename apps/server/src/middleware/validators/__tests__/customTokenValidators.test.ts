/**
 * The two messages behind a table's own Library tokens. route() runs AFTER
 * validation, so this suite is the only gate a hostile shape ever meets: the
 * handler hands the name to create-npc later and the URL to every client's
 * image loader, so both are bounded here.
 */

import { describe, expect, it } from "vitest";
import { CUSTOM_TOKEN_LIMITS } from "@herobyte/shared";
import {
  isCustomTokenImageUrl,
  validateAddCustomTokenMessage,
  validateRemoveCustomTokenMessage,
} from "../customTokenValidators.js";

const base = {
  t: "add-custom-token",
  name: "Old Marta",
  imageUrl: "https://i.imgur.com/abc123.png",
};

describe("validateAddCustomTokenMessage", () => {
  it("accepts the minimum, and every optional field at its bound", () => {
    expect(validateAddCustomTokenMessage(base)).toEqual({ valid: true });
    expect(
      validateAddCustomTokenMessage({
        ...base,
        name: "n".repeat(CUSTOM_TOKEN_LIMITS.NAME_MAX),
        description: "d".repeat(CUSTOM_TOKEN_LIMITS.DESCRIPTION_MAX),
        tags: Array.from(
          { length: CUSTOM_TOKEN_LIMITS.TAGS_MAX },
          (_, i) => "t".repeat(CUSTOM_TOKEN_LIMITS.TAG_MAX - 1) + String(i % 10),
        ),
        size: "gargantuan",
      }),
    ).toEqual({ valid: true });
  });

  it("accepts an upload path and the bundled pack's paths as images", () => {
    for (const imageUrl of [
      `/assets/${"a".repeat(64)}`,
      "/tokens/NPC/Enemies/Goblins/goblinClub.png",
      "https://example.com/tok.png?x=1",
    ]) {
      expect(validateAddCustomTokenMessage({ ...base, imageUrl }).valid, imageUrl).toBe(true);
    }
  });

  it("accepts this table's own upload URL, on a table without TLS", () => {
    // What ⬆ UPLOAD actually commits: uploadedAssetUrl() puts the SERVER's
    // origin in front of the hash, and a dev box, an e2e rail and a LAN table
    // all serve that over plain http. The add used to be refused there with
    // nothing shown to the DM.
    const hash = "a".repeat(64);
    for (const imageUrl of [
      `http://localhost:8788/assets/${hash}`,
      `http://192.168.50.226:8787/assets/${hash}`,
      `https://herobyte-server.onrender.com/assets/${hash}`,
    ]) {
      expect(validateAddCustomTokenMessage({ ...base, imageUrl }).valid, imageUrl).toBe(true);
    }
    // Still not a licence for plain http generally: only the exact
    // content-addressed tail, nothing appended, nothing short of 64 hex.
    expect(isCustomTokenImageUrl(`http://localhost:8788/assets/${hash}/../x.png`)).toBe(false);
    expect(isCustomTokenImageUrl(`http://localhost:8788/assets/${hash}?x=1`)).toBe(false);
    expect(isCustomTokenImageUrl("http://localhost:8788/assets/short")).toBe(false);
    expect(isCustomTokenImageUrl("http://localhost:8788/tokens/x.png")).toBe(false);
  });

  it("refuses an image that no client would draw", () => {
    for (const imageUrl of [
      "http://example.com/tok.png",
      "data:image/png;base64,AAAA",
      "javascript:alert(1)",
      "//evil.example/tok.png",
      "tok.png",
      "",
      "https://",
      "https://a b",
      "h".repeat(CUSTOM_TOKEN_LIMITS.URL_MAX + 1),
      42,
    ]) {
      expect(validateAddCustomTokenMessage({ ...base, imageUrl }).valid, String(imageUrl)).toBe(
        false,
      );
    }
    expect(isCustomTokenImageUrl("https://i.imgur.com/x.png")).toBe(true);
    expect(isCustomTokenImageUrl("/x.png")).toBe(true);
    expect(isCustomTokenImageUrl("//x.png")).toBe(false);
  });

  it("holds the thumbnail to exactly the bar the picture meets", () => {
    const thumbUrl = `/assets/${"a".repeat(64)}`;
    expect(validateAddCustomTokenMessage({ ...base, thumbUrl }).valid).toBe(true);
    // Absent is the shipped shape and stays valid.
    expect(validateAddCustomTokenMessage(base).valid).toBe(true);
    for (const bad of [
      "data:image/png;base64,AAAA",
      "javascript:alert(1)",
      "//evil.example/t.png",
      "http://example.com/t.png",
      "",
      7,
      null,
      "h".repeat(CUSTOM_TOKEN_LIMITS.URL_MAX + 1),
    ]) {
      expect(validateAddCustomTokenMessage({ ...base, thumbUrl: bad }).valid, String(bad)).toBe(
        false,
      );
    }
  });

  it("bounds the name, the description, the tags and the size", () => {
    expect(validateAddCustomTokenMessage({ ...base, name: "" }).valid).toBe(false);
    expect(validateAddCustomTokenMessage({ ...base, name: "   " }).valid).toBe(false);
    expect(
      validateAddCustomTokenMessage({ ...base, name: "n".repeat(CUSTOM_TOKEN_LIMITS.NAME_MAX + 1) })
        .valid,
    ).toBe(false);
    expect(
      validateAddCustomTokenMessage({
        ...base,
        description: "d".repeat(CUSTOM_TOKEN_LIMITS.DESCRIPTION_MAX + 1),
      }).valid,
    ).toBe(false);
    expect(validateAddCustomTokenMessage({ ...base, description: 7 }).valid).toBe(false);
    expect(validateAddCustomTokenMessage({ ...base, tags: "monster" }).valid).toBe(false);
    expect(validateAddCustomTokenMessage({ ...base, tags: ["monster", ""] }).valid).toBe(false);
    expect(validateAddCustomTokenMessage({ ...base, tags: ["monster", 3] }).valid).toBe(false);
    expect(
      validateAddCustomTokenMessage({
        ...base,
        tags: Array.from({ length: CUSTOM_TOKEN_LIMITS.TAGS_MAX + 1 }, () => "x"),
      }).valid,
    ).toBe(false);
    expect(
      validateAddCustomTokenMessage({
        ...base,
        tags: ["t".repeat(CUSTOM_TOKEN_LIMITS.TAG_MAX + 1)],
      }).valid,
    ).toBe(false);
    expect(validateAddCustomTokenMessage({ ...base, size: "enormous" }).valid).toBe(false);
  });
});

describe("validateRemoveCustomTokenMessage", () => {
  it("wants a non-empty string id", () => {
    expect(validateRemoveCustomTokenMessage({ t: "remove-custom-token", id: "abc" })).toEqual({
      valid: true,
    });
    for (const id of ["", 3, null, undefined]) {
      expect(validateRemoveCustomTokenMessage({ t: "remove-custom-token", id }).valid).toBe(false);
    }
  });
});
