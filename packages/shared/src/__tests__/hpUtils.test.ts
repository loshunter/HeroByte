import { describe, expect, it } from "vitest";
import { normalizeHPValues, parseHPInput, parseMaxHPInput } from "../hpUtils.js";

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
