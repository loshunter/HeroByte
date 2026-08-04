import { describe, expect, it } from "vitest";
import {
  normalizeHPValues,
  parseHPInput,
  parseMaxHPInput,
  hpBadgeFor,
  coerceMonsterHpDisplay,
} from "../hpUtils.js";

describe("hpUtils", () => {
  describe("normalizeHPValues", () => {
    it("keeps HP and max HP when values are already valid", () => {
      expect(normalizeHPValues(25, 50)).toEqual({ hp: 25, maxHp: 50 });
    });

    it("raises max HP when HP exceeds max HP", () => {
      expect(normalizeHPValues(34, 10)).toEqual({ hp: 34, maxHp: 34 });
    });

    it("clamps HP to zero and max HP to at least one", () => {
      expect(normalizeHPValues(-5, -20)).toEqual({ hp: 0, maxHp: 1 });
    });
  });

  describe("parseHPInput", () => {
    it("parses numeric string and number inputs", () => {
      expect(parseHPInput("42")).toBe(42);
      expect(parseHPInput(17)).toBe(17);
    });

    it("returns default value for invalid HP input", () => {
      expect(parseHPInput("not-a-number")).toBe(0);
      expect(parseHPInput("not-a-number", 7)).toBe(7);
    });
  });

  describe("parseMaxHPInput", () => {
    it("parses positive max HP input", () => {
      expect(parseMaxHPInput("20")).toBe(20);
      expect(parseMaxHPInput(30)).toBe(30);
    });

    it("returns default value for invalid or non-positive max HP input", () => {
      expect(parseMaxHPInput("bad")).toBe(1);
      expect(parseMaxHPInput(0)).toBe(1);
      expect(parseMaxHPInput(-10, 5)).toBe(5);
    });
  });
});

describe("hpBadgeFor (S4 bloodied badge — shared so server filter and player lens agree)", () => {
  it("is bloodied at or below half max (5e), healthy above", () => {
    expect(hpBadgeFor(5, 10)).toBe("bloodied");
    expect(hpBadgeFor(6, 10)).toBe("healthy");
    expect(hpBadgeFor(0, 10)).toBe("bloodied");
    expect(hpBadgeFor(10, 10)).toBe("healthy");
  });

  it("normalizes garbage before judging", () => {
    expect(hpBadgeFor(-5, 10)).toBe("bloodied");
    expect(hpBadgeFor(34, 10)).toBe("healthy"); // maxHp auto-adjusts up to hp
  });
});

describe("coerceMonsterHpDisplay", () => {
  it("passes the three real modes and defaults everything else to exact", () => {
    expect(coerceMonsterHpDisplay("hidden")).toBe("hidden");
    expect(coerceMonsterHpDisplay("bloodied")).toBe("bloodied");
    expect(coerceMonsterHpDisplay("exact")).toBe("exact");
    expect(coerceMonsterHpDisplay("exact-but-evil")).toBe("exact");
    expect(coerceMonsterHpDisplay(undefined)).toBe("exact");
    expect(coerceMonsterHpDisplay(42)).toBe("exact");
  });
});
