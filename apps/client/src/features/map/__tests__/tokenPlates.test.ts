// The plate-mapping rules the e2e cannot discriminate on the default table
// (character name and owner name are the same string there) — pinned here.

import { describe, expect, it } from "vitest";
import { hpBadgeFor, type Player, type SnapshotCharacter, type Token } from "@herobyte/shared";
import { buildTokenPlates, movementReadout } from "../tokenPlates";

function token(id: string, owner: string): Token {
  return { id, owner, x: 0, y: 0, color: "red" };
}

function player(uid: string, name: string): Player {
  return { uid, name };
}

function npc(tokenId: string, hp: number, maxHp: number): SnapshotCharacter {
  return { id: `char-${tokenId}`, type: "npc", name: "Goblin 3", tokenId, hp, maxHp };
}

describe("buildTokenPlates — the movement budget", () => {
  const base = { tokens: [token("t1", "p1")], players: [player("p1", "P")] };
  const pc = (extra: Partial<SnapshotCharacter> = {}): SnapshotCharacter => ({
    id: "c1",
    type: "pc",
    name: "Aria",
    tokenId: "t1",
    hp: 10,
    maxHp: 10,
    ...extra,
  });

  it("a PC in the order wears remaining / speed while combat is on — defaults included, on a PLAYER's screen too", () => {
    const plates = buildTokenPlates({
      ...base,
      characters: [pc({ initiative: 12, movementUsed: 10 })],
      monsterHpDisplay: "exact",
      lensRedact: false,
      combatActive: true,
    });
    expect(plates["token:t1"]!.move).toEqual({ speed: 30, used: 10, remaining: 20 });
    // isDM: false is every player's screen: a PC's budget is party knowledge.
    expect(
      buildTokenPlates({
        ...base,
        characters: [pc({ initiative: 3, movementUsed: 10 })],
        monsterHpDisplay: "exact",
        lensRedact: false,
        combatActive: true,
        isDM: false,
      })["token:t1"]!.move,
    ).toEqual({ speed: 30, used: 10, remaining: 20 });
  });

  it("no budget out of combat, and none for a character not in the order", () => {
    const off = buildTokenPlates({
      ...base,
      characters: [pc({ initiative: 12, movementUsed: 10 })],
      monsterHpDisplay: "exact",
      lensRedact: false,
      combatActive: false,
    });
    expect(off["token:t1"]!.move).toBeUndefined();
    const notInOrder = buildTokenPlates({
      ...base,
      characters: [pc({ movementUsed: 10 })],
      monsterHpDisplay: "exact",
      lensRedact: false,
      combatActive: true,
    });
    expect(notInOrder["token:t1"]!.move).toBeUndefined();
  });

  it("an NPC's budget shows on the DM's frame only — never on a player's, never under the lens", () => {
    const monster = (extra: Partial<SnapshotCharacter>) => ({
      ...npc("t1", 7, 7),
      initiative: 9,
      ...extra,
    });
    const dm = buildTokenPlates({
      ...base,
      characters: [monster({ movementUsed: 5, speed: 40 })],
      monsterHpDisplay: "exact",
      lensRedact: false,
      combatActive: true,
      isDM: true,
    });
    expect(dm["token:t1"]!.move).toEqual({ speed: 40, used: 5, remaining: 35 });
    // A monster in a fight always carries a record (reset at combat start,
    // or born into it with movementUsed 0): the DM sees its full budget.
    const fresh = buildTokenPlates({
      ...base,
      characters: [monster({ movementUsed: 0 })],
      monsterHpDisplay: "exact",
      lensRedact: false,
      combatActive: true,
      isDM: true,
    });
    expect(fresh["token:t1"]!.move).toEqual({ speed: 30, used: 0, remaining: 30 });
    // No record at all (the elevation blip: role flipped, snapshot still the
    // player's): nothing, rather than a fabricated default.
    const blip = buildTokenPlates({
      ...base,
      characters: [monster({})],
      monsterHpDisplay: "exact",
      lensRedact: false,
      combatActive: true,
      isDM: true,
    });
    expect(blip["token:t1"]!.move).toBeUndefined();
    // A player's frame never wears one, whatever the record happens to carry.
    const playerFrame = buildTokenPlates({
      ...base,
      characters: [monster({ movementUsed: 5, speed: 40 })],
      monsterHpDisplay: "exact",
      lensRedact: false,
      combatActive: true,
      isDM: false,
    });
    expect(playerFrame["token:t1"]!.move).toBeUndefined();
    // The DM's lens simulates the player.
    const lens = buildTokenPlates({
      ...base,
      characters: [monster({ movementUsed: 5, speed: 40 })],
      monsterHpDisplay: "exact",
      lensRedact: true,
      combatActive: true,
      isDM: true,
    });
    expect(lens["token:t1"]!.move).toBeUndefined();
  });

  it("a DM-owned PC wears a budget once it has ROLLED (a combatant, F3) — and none on the bench", () => {
    const build = (extra: Partial<SnapshotCharacter>) =>
      buildTokenPlates({
        tokens: [token("t1", "dm")],
        players: [{ uid: "dm", name: "The DM", isDM: true } as unknown as Player],
        characters: [pc({ ownedByPlayerUID: "dm", ...extra })],
        monsterHpDisplay: "exact",
        lensRedact: false,
        combatActive: true,
        isDM: true,
      });
    expect(build({ initiative: 12, movementUsed: 5 })["token:t1"]!.move).toEqual({
      speed: 30,
      used: 5,
      remaining: 25,
    });
    // Unrolled: no turn could ever reset it, so no readout (a spend or not).
    expect(build({ movementUsed: 5 })["token:t1"]!.move).toBeUndefined();
    expect(build({})["token:t1"]!.move).toBeUndefined();
  });

  it("a rolled DM-owned PC's budget is drawn on a PLAYER's screen and under the DM's player lens — the type axis", () => {
    const build = (isDM: boolean, lensRedact: boolean) =>
      buildTokenPlates({
        tokens: [token("t1", "dm")],
        players: [{ uid: "dm", name: "The DM", isDM: true } as unknown as Player],
        characters: [pc({ ownedByPlayerUID: "dm", initiative: 12, movementUsed: 5 })],
        monsterHpDisplay: "exact",
        lensRedact,
        combatActive: true,
        isDM,
      });
    const expected = { speed: 30, used: 5, remaining: 25 };
    expect(build(false, false)["token:t1"]!.move).toEqual(expected); // a player's frame
    expect(build(true, true)["token:t1"]!.move).toEqual(expected); // the DM's player lens
  });
});

describe("movementReadout", () => {
  it("reads what is left over what the turn started with", () => {
    expect(movementReadout({ speed: 25, used: 10, remaining: 15 })).toBe("15 / 25 ft");
    expect(movementReadout({ speed: 5, used: 10, remaining: -5 })).toBe("-5 / 5 ft");
  });
});

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
