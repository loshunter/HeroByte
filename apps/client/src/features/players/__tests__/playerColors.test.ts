import { describe, expect, it } from "vitest";
import type { SnapshotCharacter, Token } from "@herobyte/shared";
import { contrastRatio, parseColor } from "@herobyte/shared";
import {
  NAME_GROUND,
  characterColor,
  nameColors,
  playerColor,
  playerColorMap,
  speakingGlow,
} from "../playerColors";

const pc = (id: string, owner: string, extra: Partial<SnapshotCharacter> = {}): SnapshotCharacter =>
  ({
    id,
    name: id,
    type: "pc",
    ownedByPlayerUID: owner,
    tokenId: `t-${id}`,
    ...extra,
  }) as SnapshotCharacter;
const npc = (id: string, extra: Partial<SnapshotCharacter> = {}): SnapshotCharacter =>
  ({ id, name: id, type: "npc", tokenId: `t-${id}`, ...extra }) as SnapshotCharacter;
const token = (id: string, owner: string, color: string): Token =>
  ({ id, owner, x: 0, y: 0, color }) as Token;

describe("playerColor", () => {
  it("reads a party member's colour from their record when fog dropped their token", () => {
    // Bo's token is out of this viewer's sight: not in the payload at all.
    const characters = [pc("bors", "bo", { color: "#8A2BE2" })];
    expect(playerColor("bo", characters, [])).toBe("#8a2be2");
  });

  it("gives the DM their own PC's colour, never an NPC token they placed later", () => {
    const characters = [pc("hero", "dm", { color: "#00aa55" }), npc("goblin")];
    const tokens = [token("t-hero", "dm", "#00aa55"), token("t-goblin", "dm", "#ff0000")];
    expect(playerColor("dm", characters, tokens)).toBe("#00aa55");
    expect(playerColor("dm", [npc("goblin")], tokens)).toBeNull();
  });

  it("uses the first PC's colour for a player with two", () => {
    const characters = [
      pc("first", "ann", { color: "#112233" }),
      pc("second", "ann", { color: "#445566" }),
    ];
    expect(playerColor("ann", characters, [])).toBe("#112233");
  });

  it("takes a later PC only when the earlier ones have no colour yet", () => {
    const characters = [
      pc("first", "ann", { tokenId: undefined }),
      pc("second", "ann", { color: "#445566" }),
    ];
    expect(playerColor("ann", characters, [])).toBe("#445566");
  });

  it("falls back on the one loose token a player with one unlinked PC owns", () => {
    const characters = [pc("old", "ann", { tokenId: undefined })];
    expect(playerColor("ann", characters, [token("loose", "ann", "hsl(120, 70%, 50%)")])).toBe(
      "#26d926",
    );
  });

  it("has no colour for a spectator, an empty uid or an unreadable colour", () => {
    expect(playerColor("nobody", [pc("bors", "bo", { color: "#8a2be2" })], [])).toBeNull();
    expect(playerColor(null, [pc("bors", "bo", { color: "#8a2be2" })], [])).toBeNull();
    expect(playerColor("bo", [pc("bors", "bo", { color: "var(--x)" })], [])).toBeNull();
  });
});

describe("characterColor and playerColorMap", () => {
  it("prefers the record's colour over the token's", () => {
    expect(characterColor({ color: "#111111", tokenId: "t" }, { color: "#222222" })).toBe(
      "#111111",
    );
    expect(characterColor({ tokenId: "t" }, { color: "#222222" })).toBe("#222222");
    expect(characterColor({ tokenId: "t" }, undefined)).toBeNull();
  });

  it("maps every player with a colour and leaves the rest out", () => {
    const characters = [
      pc("bors", "bo", { color: "#8a2be2" }),
      pc("ann", "ann", { tokenId: undefined }),
    ];
    expect([...playerColorMap(["bo", "ann", "cy"], characters, [])]).toEqual([["bo", "#8a2be2"]]);
  });
});

describe("nameColors and speakingGlow", () => {
  it("lifts every name to 4.5:1 on the panel and leaves a readable one alone", () => {
    const names = nameColors(
      new Map([
        ["dark", "#390076"],
        ["light", "#ffc2d3"],
      ]),
    );
    expect(
      contrastRatio(parseColor(names.get("dark")!)!, parseColor(NAME_GROUND)!),
    ).toBeGreaterThanOrEqual(4.5);
    expect(names.get("light")).toBe("#ffc2d3");
  });

  it("glows in the card's colour, lifted for a dark one, and as today for the default green", () => {
    expect(speakingGlow("#5AFFAD")).toBe("rgba(90, 255, 173, 0.35)");
    expect(speakingGlow("#ffc2d3")).toBe("rgba(255, 194, 211, 0.35)");
    expect(speakingGlow("#390076")).not.toBe("rgba(57, 0, 118, 0.35)");
  });
});
