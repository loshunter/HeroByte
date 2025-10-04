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

  it("reports defeat state and HP percentage", () => {
    expect(baseCharacter.isDead()).toBe(false);
    expect(baseCharacter.getHPPercent()).toBeCloseTo(0.7, 5);

    const defeated = baseCharacter.takeDamage(100);
    expect(defeated.isDead()).toBe(true);
    expect(defeated.getHPPercent()).toBe(0);
  });
});
