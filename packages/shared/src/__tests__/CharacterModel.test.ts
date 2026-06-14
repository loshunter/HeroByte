import { describe, expect, it } from "vitest";
import { CharacterModel } from "../models.js";

describe("CharacterModel", () => {
  const baseCharacter = new CharacterModel(
    "char-1",
    "Ayla",
    42,
    60,
    "pc",
    undefined,
    null,
    null,
    null,
  );

  it("serializes and deserializes correctly", () => {
    const json = baseCharacter.toJSON();
    const fromJson = CharacterModel.fromJSON({
      ...json,
      tokenId: "token-1",
      ownedByPlayerUID: "uid-4",
      tokenImage: "https://example.com/token.png",
      type: "npc",
    });

    expect(fromJson).toBeInstanceOf(CharacterModel);
    expect(fromJson.tokenId).toBe("token-1");
    expect(fromJson.ownedByPlayerUID).toBe("uid-4");
    expect(fromJson.tokenImage).toBe("https://example.com/token.png");
    expect(fromJson.type).toBe("npc");

    const withDefaults = CharacterModel.fromJSON({
      id: "char-default",
      name: "Default",
      hp: 1,
      maxHp: 2,
    } as unknown as Parameters<typeof CharacterModel.fromJSON>[0]);

    expect(withDefaults.type).toBe("pc");
    expect(withDefaults.tokenId).toBeNull();
    expect(withDefaults.ownedByPlayerUID).toBeNull();
    expect(withDefaults.tokenImage).toBeNull();
  });

  it("updates HP with clamping", () => {
    expect(baseCharacter.setHP(80, 80).hp).toBe(80);
    expect(baseCharacter.setHP(-10).hp).toBe(0);
    expect(baseCharacter.setHP(999, 100).hp).toBe(100);
  });

  it("applies damage and healing", () => {
    const damaged = baseCharacter.takeDamage(10);
    expect(damaged.hp).toBe(32);

    const healed = damaged.heal(50);
    expect(healed.hp).toBe(60);
  });

  it("consumes temporary HP before character HP", () => {
    const protectedCharacter = baseCharacter.setTempHP(12);

    const partlyAbsorbed = protectedCharacter.takeDamage(7);
    expect(partlyAbsorbed.tempHp).toBe(5);
    expect(partlyAbsorbed.hp).toBe(42);

    const overflow = protectedCharacter.takeDamage(20);
    expect(overflow.tempHp).toBeUndefined();
    expect(overflow.hp).toBe(34);
  });

  it("links token and claims ownership immutably", () => {
    const linked = baseCharacter.linkToken("token-99");
    expect(linked.tokenId).toBe("token-99");
    expect(baseCharacter.tokenId).toBeNull();

    const claimed = linked.claim("player-7");
    expect(claimed.ownedByPlayerUID).toBe("player-7");
    expect(linked.ownedByPlayerUID).toBeNull();
  });

  it("updates metadata and token images", () => {
    const updated = baseCharacter.update({
      name: "Guardian",
      hp: 55,
      maxHp: 80,
      portrait: "portrait",
      type: "npc",
      tokenImage: " https://img/token.png ",
    });

    expect(updated.name).toBe("Guardian");
    expect(updated.hp).toBe(55);
    expect(updated.maxHp).toBe(80);
    expect(updated.portrait).toBe("portrait");
    expect(updated.type).toBe("npc");
    expect(updated.tokenImage).toBe("https://img/token.png");

    const cleared = updated.setTokenImage(null);
    expect(cleared.tokenImage).toBeNull();
  });

  it("preserves existing metadata when update fields are omitted", () => {
    const original = new CharacterModel(
      "char-2",
      "Borin",
      20,
      30,
      "npc",
      "portrait",
      "token-1",
      "player-1",
      "token-image",
      4,
    );

    const updated = original.update({});

    expect(updated.name).toBe("Borin");
    expect(updated.hp).toBe(20);
    expect(updated.maxHp).toBe(30);
    expect(updated.type).toBe("npc");
    expect(updated.portrait).toBe("portrait");
    expect(updated.tokenImage).toBe("token-image");
    expect(updated.tempHp).toBe(4);
  });

  it("normalizes nullable and blank update fields", () => {
    const withMetadata = new CharacterModel(
      "char-3",
      "Cora",
      20,
      30,
      "pc",
      "portrait",
      null,
      null,
      "token-image",
    );

    const updated = withMetadata.update({
      portrait: null,
      tokenImage: "   ",
      hp: 99,
      maxHp: -1,
      tempHp: 0,
    });

    expect(updated.portrait).toBeUndefined();
    expect(updated.tokenImage).toBeNull();
    expect(updated.hp).toBe(0);
    expect(updated.maxHp).toBe(0);
    expect(updated.tempHp).toBe(0);
  });

  it("trims non-empty token image values", () => {
    const updated = baseCharacter.setTokenImage(" https://example.com/token.png ");

    expect(updated.tokenImage).toBe("https://example.com/token.png");
  });

  it("reports defeat state and HP percentage", () => {
    expect(baseCharacter.isDead()).toBe(false);
    expect(baseCharacter.getHPPercent()).toBeCloseTo(0.7, 5);

    const defeated = baseCharacter.takeDamage(100);
    expect(defeated.isDead()).toBe(true);
    expect(defeated.getHPPercent()).toBe(0);

    const noMaxHp = new CharacterModel("char-zero", "Zero", 0, 0);
    expect(noMaxHp.getHPPercent()).toBe(0);
  });

  it("clears non-positive temporary HP values", () => {
    expect(baseCharacter.setTempHP(6).tempHp).toBe(6);
    expect(baseCharacter.setTempHP(0).tempHp).toBeUndefined();
    expect(baseCharacter.setTempHP(-3).tempHp).toBeUndefined();
  });
});
