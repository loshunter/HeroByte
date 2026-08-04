// The plate-mapping rules the e2e cannot discriminate on the default table
// (character name and owner name are the same string there) — pinned here.

import { describe, expect, it } from "vitest";
import { hpBadgeFor, type Player, type SnapshotCharacter, type Token } from "@herobyte/shared";
import { buildTokenPlates } from "../tokenPlates";

function token(id: string, owner: string): Token {
  return { id, owner, x: 0, y: 0, color: "red" };
}

function player(uid: string, name: string): Player {
  return { uid, name };
}

function npc(tokenId: string, hp: number, maxHp: number): SnapshotCharacter {
  return { id: `char-${tokenId}`, type: "npc", name: "Goblin 3", tokenId, hp, maxHp };
}

describe("buildTokenPlates", () => {
  it("a linked token wears the CHARACTER's name — never token.owner's", () => {
    // NPC tokens are owned by the placing DM; owner-naming would caption
    // every monster with the DM's name (the commit-headline bug).
    const plates = buildTokenPlates({
      characters: [npc("t1", 10, 20)],
      tokens: [token("t1", "dm-uid")],
      players: [player("dm-uid", "The DM")],
      monsterHpDisplay: "exact",
      lensRedact: false,
    });
    expect(plates["token:t1"]).toMatchObject({ name: "Goblin 3", hp: 10, maxHp: 20 });
  });

  it("only an UNLINKED token falls back to its owner player's name", () => {
    const plates = buildTokenPlates({
      characters: [],
      tokens: [token("t2", "p1")],
      players: [player("p1", "Aria's Player")],
      monsterHpDisplay: "exact",
      lensRedact: false,
    });
    expect(plates["token:t2"]).toEqual({ name: "Aria's Player" });
  });

  it("a token with no character and no known owner gets no plate", () => {
    const plates = buildTokenPlates({
      characters: [],
      tokens: [token("t3", "ghost")],
      players: [],
      monsterHpDisplay: "exact",
      lensRedact: false,
    });
    expect(plates["token:t3"]).toBeUndefined();
  });

  it("the player lens redacts NPCs with the SAME badge the server computes", () => {
    const plates = buildTokenPlates({
      characters: [npc("t4", 5, 20)],
      tokens: [],
      players: [],
      monsterHpDisplay: "bloodied",
      lensRedact: true,
    });
    expect(plates["token:t4"]).toEqual({
      name: "Goblin 3",
      hp: undefined,
      maxHp: undefined,
      hpBadge: hpBadgeFor(5, 20), // "bloodied" — one shared function, no drift
    });
  });

  it("the lens hides everything in hidden mode, and never touches PCs", () => {
    const pc: SnapshotCharacter = {
      id: "char-pc",
      type: "pc",
      name: "Aria",
      tokenId: "t5",
      hp: 3,
      maxHp: 30,
    };
    const plates = buildTokenPlates({
      characters: [pc, npc("t6", 5, 20)],
      tokens: [],
      players: [],
      monsterHpDisplay: "hidden",
      lensRedact: true,
    });
    expect(plates["token:t5"]).toMatchObject({ hp: 3, maxHp: 30 }); // PC untouched
    expect(plates["token:t6"]).toMatchObject({ hp: undefined, hpBadge: undefined });
  });

  it("without the lens, DM data passes through whatever the mode", () => {
    const plates = buildTokenPlates({
      characters: [npc("t7", 5, 20)],
      tokens: [],
      players: [],
      monsterHpDisplay: "hidden",
      lensRedact: false,
    });
    expect(plates["token:t7"]).toMatchObject({ hp: 5, maxHp: 20 });
  });
});
