import { describe, expect, it } from "vitest";
import { PlayerModel } from "../models.js";

describe("PlayerModel", () => {
  const basePlayer = new PlayerModel("uid-1", "Hero", undefined, 0.2, 80, 100);

  it("creates from JSON and preserves data", () => {
    const json = basePlayer.toJSON();
    const fromJson = PlayerModel.fromJSON(json);

    expect(fromJson).toBeInstanceOf(PlayerModel);
    expect(fromJson).not.toBe(basePlayer);
    expect(fromJson).toEqual(basePlayer);
    expect(json.statusEffects).toBeUndefined();
  });

  it("tracks DM mode flag consistently", () => {
    const dmPlayer = basePlayer.setDMMode(true);
    expect(dmPlayer.isDM).toBe(true);

    const json = dmPlayer.toJSON();
    expect(json.isDM).toBe(true);

    const restored = PlayerModel.fromJSON(json);
    expect(restored.isDM).toBe(true);
  });

  it("renames immutably", () => {
    const renamed = basePlayer.rename("Champion");

    expect(renamed.name).toBe("Champion");
    expect(basePlayer.name).toBe("Hero");
  });

  it("updates portrait immutably", () => {
    const portrait = "data:image/png;base64,AAA";
    const updated = basePlayer.setPortrait(portrait);

    expect(updated.portrait).toBe(portrait);
    expect(basePlayer.portrait).toBeUndefined();
  });

  it("clamps microphone level between 0 and 1", () => {
    expect(basePlayer.setMicLevel(0.8).micLevel).toBe(0.8);
    expect(basePlayer.setMicLevel(-1).micLevel).toBe(0);
    expect(basePlayer.setMicLevel(5).micLevel).toBe(1);
  });

  it("updates HP values immutably", () => {
    const updated = basePlayer.setHP(60, 120);

    expect(updated.hp).toBe(60);
    expect(updated.maxHp).toBe(120);
    expect(basePlayer.hp).toBe(80);
    expect(basePlayer.maxHp).toBe(100);
  });

  it("takes damage without dropping below zero", () => {
    const damaged = basePlayer.takeDamage(90);

    expect(damaged.hp).toBe(0);
  });

  it("consumes temporary HP before regular HP", () => {
    const protectedPlayer = basePlayer.setTempHP(15);

    const partlyAbsorbed = protectedPlayer.takeDamage(10);
    expect(partlyAbsorbed.tempHp).toBe(5);
    expect(partlyAbsorbed.hp).toBe(80);

    const overflow = protectedPlayer.takeDamage(20);
    expect(overflow.tempHp).toBeUndefined();
    expect(overflow.hp).toBe(75);
  });

  it("heals without exceeding max HP", () => {
    const wounded = basePlayer.takeDamage(30);
    const healed = wounded.heal(50);

    expect(healed.hp).toBe(100); // 50 + 50 = 100, clamped to maxHp
    expect(healed.maxHp).toBe(basePlayer.maxHp);

    const noHpInfo = new PlayerModel("uid-2", "Mystery");
    expect(noHpInfo.heal(5).hp).toBe(5);
  });

  it("reports alive status correctly", () => {
    expect(basePlayer.isAlive()).toBe(true);
    expect(basePlayer.takeDamage(200).isAlive()).toBe(false);
    const noHpInfo = new PlayerModel("uid-2", "Mystery");
    expect(noHpInfo.isAlive()).toBe(true);
  });

  it("returns HP percent when available", () => {
    expect(basePlayer.getHPPercent()).toBeCloseTo(0.8);
    const noHp = new PlayerModel("uid-3", "Ghost");
    expect(noHp.getHPPercent()).toBe(1);
  });

  it("detects speaking state using threshold", () => {
    expect(basePlayer.isSpeaking()).toBe(true);
    expect(basePlayer.isSpeaking(0.25)).toBe(false);
    expect(new PlayerModel("uid-4", "Silent").isSpeaking()).toBe(false);
  });

  it("updates status effects immutably", () => {
    const effects = ["poisoned", "blinded"];

    const updated = basePlayer.setStatusEffects(effects);
    effects.push("stunned");

    expect(updated.statusEffects).toEqual(["poisoned", "blinded"]);
    expect(basePlayer.statusEffects).toEqual([]);
    expect(updated.toJSON().statusEffects).toEqual(["poisoned", "blinded"]);
  });

  it("clears non-positive temporary HP values", () => {
    expect(basePlayer.setTempHP(8).tempHp).toBe(8);
    expect(basePlayer.setTempHP(0).tempHp).toBeUndefined();
    expect(basePlayer.setTempHP(-4).tempHp).toBeUndefined();
  });
});
