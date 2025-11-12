/**
 * Unit tests for dice logic module
 *
 * Tests the core dice rolling logic, including:
 * - Secure random number generation
 * - Building and rolling dice combinations
 * - Formatting roll results
 *
 * Source: apps/client/src/components/dice/diceLogic.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rngIntSecure, rollBuild, formatRollText } from "../diceLogic";
import type { Build, RollResult, DieType } from "../types";

describe("diceLogic", () => {
  describe("rngIntSecure", () => {
    it("should generate numbers within the specified range", () => {
      const results: number[] = [];
      const min = 1;
      const max = 20;

      // Generate 100 random numbers
      for (let i = 0; i < 100; i++) {
        const result = rngIntSecure(min, max);
        results.push(result);
      }

      // All results should be within range
      results.forEach((result) => {
        expect(result).toBeGreaterThanOrEqual(min);
        expect(result).toBeLessThanOrEqual(max);
        expect(Number.isInteger(result)).toBe(true);
      });
    });

    it("should handle single value range", () => {
      const result = rngIntSecure(5, 5);
      expect(result).toBe(5);
    });

    it("should generate different values over multiple calls", () => {
      const results: number[] = [];

      for (let i = 0; i < 50; i++) {
        results.push(rngIntSecure(1, 100));
      }

      // Should have some variation (very unlikely to get all same values)
      const uniqueValues = new Set(results);
      expect(uniqueValues.size).toBeGreaterThan(1);
    });

    it("should work with negative ranges", () => {
      const results: number[] = [];
      for (let i = 0; i < 20; i++) {
        const result = rngIntSecure(-10, -5);
        results.push(result);
        expect(result).toBeGreaterThanOrEqual(-10);
        expect(result).toBeLessThanOrEqual(-5);
      }
    });

    it("should work with ranges crossing zero", () => {
      const results: number[] = [];
      for (let i = 0; i < 20; i++) {
        const result = rngIntSecure(-5, 5);
        results.push(result);
        expect(result).toBeGreaterThanOrEqual(-5);
        expect(result).toBeLessThanOrEqual(5);
      }
    });
  });

  describe("rollBuild", () => {
    beforeEach(() => {
      // Mock Date.now for consistent timestamps in tests
      vi.spyOn(Date, "now").mockReturnValue(1234567890);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should roll a single die", () => {
      const build: Build = [{ kind: "die", die: "d20", qty: 1, id: "token-1" }];

      const result = rollBuild(build);

      expect(result.id).toBeTruthy();
      expect(result.tokens).toEqual(build);
      expect(result.perDie).toHaveLength(1);
      expect(result.perDie[0].tokenId).toBe("token-1");
      expect(result.perDie[0].die).toBe("d20");
      expect(result.perDie[0].rolls).toHaveLength(1);
      expect(result.perDie[0].rolls![0]).toBeGreaterThanOrEqual(1);
      expect(result.perDie[0].rolls![0]).toBeLessThanOrEqual(20);
      expect(result.perDie[0].subtotal).toBe(result.perDie[0].rolls![0]);
      expect(result.total).toBe(result.perDie[0].subtotal);
      expect(result.timestamp).toBe(1234567890);
    });

    it("should roll multiple dice of the same type", () => {
      const build: Build = [{ kind: "die", die: "d6", qty: 3, id: "token-1" }];

      const result = rollBuild(build);

      expect(result.perDie).toHaveLength(1);
      expect(result.perDie[0].rolls).toHaveLength(3);

      // All rolls should be valid d6 values
      result.perDie[0].rolls!.forEach((roll) => {
        expect(roll).toBeGreaterThanOrEqual(1);
        expect(roll).toBeLessThanOrEqual(6);
      });

      // Subtotal should equal sum of rolls
      const sum = result.perDie[0].rolls!.reduce((a, b) => a + b, 0);
      expect(result.perDie[0].subtotal).toBe(sum);
      expect(result.total).toBe(sum);
    });

    it("should handle positive modifier", () => {
      const build: Build = [{ kind: "mod", value: 5, id: "token-1" }];

      const result = rollBuild(build);

      expect(result.perDie).toHaveLength(1);
      expect(result.perDie[0].tokenId).toBe("token-1");
      expect(result.perDie[0].subtotal).toBe(5);
      expect(result.perDie[0].die).toBeUndefined();
      expect(result.perDie[0].rolls).toBeUndefined();
      expect(result.total).toBe(5);
    });

    it("should handle negative modifier", () => {
      const build: Build = [{ kind: "mod", value: -3, id: "token-1" }];

      const result = rollBuild(build);

      expect(result.perDie[0].subtotal).toBe(-3);
      expect(result.total).toBe(-3);
    });

    it("should handle complex build with multiple dice and modifiers", () => {
      const build: Build = [
        { kind: "die", die: "d20", qty: 1, id: "token-1" },
        { kind: "die", die: "d4", qty: 2, id: "token-2" },
        { kind: "mod", value: 3, id: "token-3" },
        { kind: "mod", value: -1, id: "token-4" },
      ];

      const result = rollBuild(build);

      expect(result.perDie).toHaveLength(4);

      // d20
      expect(result.perDie[0].die).toBe("d20");
      expect(result.perDie[0].rolls).toHaveLength(1);
      expect(result.perDie[0].rolls![0]).toBeGreaterThanOrEqual(1);
      expect(result.perDie[0].rolls![0]).toBeLessThanOrEqual(20);

      // 2d4
      expect(result.perDie[1].die).toBe("d4");
      expect(result.perDie[1].rolls).toHaveLength(2);
      result.perDie[1].rolls!.forEach((roll) => {
        expect(roll).toBeGreaterThanOrEqual(1);
        expect(roll).toBeLessThanOrEqual(4);
      });

      // +3 modifier
      expect(result.perDie[2].subtotal).toBe(3);

      // -1 modifier
      expect(result.perDie[3].subtotal).toBe(-1);

      // Total should be sum of all components
      const expectedTotal =
        result.perDie[0].subtotal +
        result.perDie[1].subtotal +
        result.perDie[2].subtotal +
        result.perDie[3].subtotal;
      expect(result.total).toBe(expectedTotal);
    });

    it("should roll all die types correctly", () => {
      const dieTypes: DieType[] = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];
      const maxFaces: Record<DieType, number> = {
        d4: 4,
        d6: 6,
        d8: 8,
        d10: 10,
        d12: 12,
        d20: 20,
        d100: 100,
      };

      dieTypes.forEach((dieType) => {
        const build: Build = [{ kind: "die", die: dieType, qty: 1, id: "token-1" }];
        const result = rollBuild(build);

        expect(result.perDie[0].rolls![0]).toBeGreaterThanOrEqual(1);
        expect(result.perDie[0].rolls![0]).toBeLessThanOrEqual(maxFaces[dieType]);
      });
    });

    it("should handle empty build", () => {
      const build: Build = [];
      const result = rollBuild(build);

      expect(result.perDie).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.timestamp).toBe(1234567890);
    });

    it("should generate unique IDs for each roll", () => {
      const build: Build = [{ kind: "die", die: "d20", qty: 1, id: "token-1" }];

      const result1 = rollBuild(build);
      const result2 = rollBuild(build);

      expect(result1.id).not.toBe(result2.id);
    });
  });

  describe("formatRollText", () => {
    it("should format single die roll", () => {
      const result: RollResult = {
        id: "roll-1",
        tokens: [{ kind: "die", die: "d20", qty: 1, id: "token-1" }],
        perDie: [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        total: 15,
        timestamp: Date.now(),
      };

      const formatted = formatRollText(result);
      expect(formatted).toBe("d20 → 15");
    });

    it("should format multiple dice of same type", () => {
      const result: RollResult = {
        id: "roll-1",
        tokens: [{ kind: "die", die: "d6", qty: 3, id: "token-1" }],
        perDie: [{ tokenId: "token-1", die: "d6", rolls: [4, 2, 5], subtotal: 11 }],
        total: 11,
        timestamp: Date.now(),
      };

      const formatted = formatRollText(result);
      expect(formatted).toBe("3d6 → 11");
    });

    it("should format positive modifier with + sign", () => {
      const result: RollResult = {
        id: "roll-1",
        tokens: [{ kind: "mod", value: 5, id: "token-1" }],
        perDie: [{ tokenId: "token-1", subtotal: 5 }],
        total: 5,
        timestamp: Date.now(),
      };

      const formatted = formatRollText(result);
      expect(formatted).toBe("+5 → 5");
    });

    it("should format negative modifier without extra sign", () => {
      const result: RollResult = {
        id: "roll-1",
        tokens: [{ kind: "mod", value: -3, id: "token-1" }],
        perDie: [{ tokenId: "token-1", subtotal: -3 }],
        total: -3,
        timestamp: Date.now(),
      };

      const formatted = formatRollText(result);
      expect(formatted).toBe("-3 → -3");
    });

    it("should format complex build with dice and modifiers", () => {
      const result: RollResult = {
        id: "roll-1",
        tokens: [
          { kind: "die", die: "d20", qty: 1, id: "token-1" },
          { kind: "die", die: "d6", qty: 2, id: "token-2" },
          { kind: "mod", value: 5, id: "token-3" },
        ],
        perDie: [
          { tokenId: "token-1", die: "d20", rolls: [12], subtotal: 12 },
          { tokenId: "token-2", die: "d6", rolls: [3, 4], subtotal: 7 },
          { tokenId: "token-3", subtotal: 5 },
        ],
        total: 24,
        timestamp: Date.now(),
      };

      const formatted = formatRollText(result);
      expect(formatted).toBe("d20 2d6 +5 → 24");
    });

    it("should format build with negative and positive modifiers", () => {
      const result: RollResult = {
        id: "roll-1",
        tokens: [
          { kind: "die", die: "d20", qty: 1, id: "token-1" },
          { kind: "mod", value: 3, id: "token-2" },
          { kind: "mod", value: -2, id: "token-3" },
        ],
        perDie: [
          { tokenId: "token-1", die: "d20", rolls: [10], subtotal: 10 },
          { tokenId: "token-2", subtotal: 3 },
          { tokenId: "token-3", subtotal: -2 },
        ],
        total: 11,
        timestamp: Date.now(),
      };

      const formatted = formatRollText(result);
      expect(formatted).toBe("d20 +3 -2 → 11");
    });

    it("should format empty build", () => {
      const result: RollResult = {
        id: "roll-1",
        tokens: [],
        perDie: [],
        total: 0,
        timestamp: Date.now(),
      };

      const formatted = formatRollText(result);
      expect(formatted).toBe(" → 0");
    });

    it("should handle all die types", () => {
      const dieTypes: DieType[] = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];

      dieTypes.forEach((dieType) => {
        const result: RollResult = {
          id: "roll-1",
          tokens: [{ kind: "die", die: dieType, qty: 1, id: "token-1" }],
          perDie: [{ tokenId: "token-1", die: dieType, rolls: [5], subtotal: 5 }],
          total: 5,
          timestamp: Date.now(),
        };

        const formatted = formatRollText(result);
        expect(formatted).toBe(`${dieType} → 5`);
      });
    });
  });
});
