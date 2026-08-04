// ============================================================================
// THE ROLLER — golden-seed determinism
// ============================================================================
// "The server rolled this" is only a claim unless the roll can be reproduced.
// Every test below drives a SEEDED stream, so the exact faces are pinned: if
// the term order, the advantage rule, or the number of draws per term ever
// changes, these fail with the old and new sequences side by side rather than
// going quietly green on different-but-plausible numbers.

import { describe, expect, it } from "vitest";
import { createSeededRng, parseDiceFormula, type DiceTerm } from "@herobyte/shared";
import { cryptoDiceRng, rollTerms, type DiceRng } from "../dice/roller.js";

/** A deterministic DiceRng over the shared mulberry32 stream. */
function seeded(seed: number): DiceRng {
  const next = createSeededRng(seed);
  return (faces) => 1 + Math.floor(next() * faces);
}

function termsOf(formula: string): DiceTerm[] {
  const parsed = parseDiceFormula(formula);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.terms;
}

function roll(formula: string, mode: "normal" | "advantage" | "disadvantage", seed: number) {
  return rollTerms(termsOf(formula), mode, seeded(seed));
}

describe("rollTerms — determinism", () => {
  it("produces the same faces for the same seed, every time", () => {
    const first = roll("3d6 + 2", "normal", 1234);
    const second = roll("3d6 + 2", "normal", 1234);
    expect(second).toEqual(first);
  });

  it("pins the golden sequence for seed 1234", () => {
    const result = roll("3d6 + 2", "normal", 1234);

    expect(result.formula).toBe("3d6 + 2");
    expect(result.mode).toBe("normal");
    expect(result.breakdown).toEqual([
      { tokenId: "t0", die: "d6", rolls: [2, 1, 1], subtotal: 4 },
      { tokenId: "t1", subtotal: 2 },
    ]);
    expect(result.total).toBe(6);
  });

  it("produces different faces for a different seed", () => {
    expect(roll("3d6", "normal", 1234).breakdown[0]?.rolls).not.toEqual(
      roll("3d6", "normal", 9999).breakdown[0]?.rolls,
    );
  });

  it("draws one number per die, in term order", () => {
    // t0 consumes two draws, so t1's faces are the THIRD and FOURTH of the
    // stream — not a fresh one. Pins that terms share a single sequence.
    const combined = roll("2d20 + 2d20", "normal", 7);
    const alone = roll("4d20", "normal", 7);
    expect([
      ...(combined.breakdown[0]?.rolls ?? []),
      ...(combined.breakdown[1]?.rolls ?? []),
    ]).toEqual(alone.breakdown[0]?.rolls);
  });
});

describe("rollTerms — arithmetic", () => {
  it("sums dice and modifiers into the total", () => {
    const result = roll("2d10 + 7 - 3", "normal", 42);
    const [dice, plus, minus] = result.breakdown;
    expect(plus).toEqual({ tokenId: "t1", subtotal: 7 });
    expect(minus).toEqual({ tokenId: "t2", subtotal: -3 });
    expect(result.total).toBe((dice?.subtotal ?? 0) + 7 - 3);
  });

  it("keeps raw faces but signs the subtotal on a subtracted die", () => {
    const result = roll("1d20 - 1d4", "normal", 5);
    const bane = result.breakdown[1];
    expect(bane?.rolls?.every((face) => face >= 1 && face <= 4)).toBe(true);
    // Faces stay positive — crit detection reads them — and the sign rides on
    // the subtotal.
    expect(bane?.subtotal).toBe(-(bane?.rolls?.[0] ?? 0));
    expect(result.total).toBe((result.breakdown[0]?.subtotal ?? 0) + (bane?.subtotal ?? 0));
  });

  it("never rolls outside a die's faces", () => {
    for (const formula of ["d4", "d6", "d8", "d10", "d12", "d20", "d100"]) {
      const faces = Number(formula.slice(1));
      for (let seed = 0; seed < 40; seed++) {
        const face = roll(formula, "normal", seed).breakdown[0]?.rolls?.[0] ?? 0;
        expect(face).toBeGreaterThanOrEqual(1);
        expect(face).toBeLessThanOrEqual(faces);
      }
    }
  });
});

describe("rollTerms — advantage and disadvantage", () => {
  it("keeps the higher set on advantage and remembers the lower one", () => {
    const result = roll("d20 + 3", "advantage", 1234);

    expect(result.mode).toBe("advantage");
    const d20 = result.breakdown[0];
    expect(d20?.rolls).toBeDefined();
    expect(d20?.dropped).toBeDefined();
    const kept = d20?.rolls?.[0] ?? 0;
    const dropped = d20?.dropped?.[0] ?? 0;
    expect(kept).toBeGreaterThanOrEqual(dropped);
    expect(result.total).toBe(kept + 3);
  });

  it("keeps the lower set on disadvantage", () => {
    const result = roll("d20", "disadvantage", 1234);
    const d20 = result.breakdown[0];
    expect(d20?.rolls?.[0] ?? 0).toBeLessThanOrEqual(d20?.dropped?.[0] ?? 0);
  });

  it("pins advantage and disadvantage to opposite halves of the same pair", () => {
    // Same seed, same two draws — so advantage must keep exactly what
    // disadvantage drops.
    const up = roll("d20", "advantage", 2026).breakdown[0];
    const down = roll("d20", "disadvantage", 2026).breakdown[0];
    expect(up?.rolls).toEqual(down?.dropped);
    expect(up?.dropped).toEqual(down?.rolls);
  });

  it("compares whole sets, not single dice, for a multi-die term", () => {
    const result = roll("2d6", "advantage", 88);
    const term = result.breakdown[0];
    expect(term?.rolls).toHaveLength(2);
    expect(term?.dropped).toHaveLength(2);
    const sum = (values?: number[]) => (values ?? []).reduce((a, b) => a + b, 0);
    expect(sum(term?.rolls)).toBeGreaterThanOrEqual(sum(term?.dropped));
  });

  it("applies to the FIRST die term only", () => {
    const result = roll("d20 + 2d6", "advantage", 3);
    expect(result.breakdown[0]?.dropped).toBeDefined();
    expect(result.breakdown[1]?.dropped).toBeUndefined();
  });

  it("still MAXIMISES the total when the first die term is subtracted", () => {
    // "-1d20 + 50": the higher faces make the total LOWER. Comparing raw sums
    // would keep the worse throw and quietly turn advantage into
    // disadvantage — badged as advantage.
    for (let seed = 0; seed < 60; seed++) {
      const up = roll("-1d20 + 50", "advantage", seed);
      const down = roll("-1d20 + 50", "disadvantage", seed);
      expect(up.total).toBeGreaterThanOrEqual(down.total);
    }

    // And it is the same pair of throws, just opposite halves kept.
    const up = roll("-1d20 + 50", "advantage", 2026).breakdown[0];
    const down = roll("-1d20 + 50", "disadvantage", 2026).breakdown[0];
    expect(up?.rolls).toEqual(down?.dropped);
    expect(up?.dropped).toEqual(down?.rolls);
    // Advantage keeps the LOWER face here, because that is the better outcome.
    expect(up?.rolls?.[0] ?? 0).toBeLessThanOrEqual(up?.dropped?.[0] ?? 0);
  });

  it("reports normal when there is no die to double", () => {
    const result = roll("+5", "advantage", 1);
    expect(result.mode).toBe("normal");
    expect(result.total).toBe(5);
    expect(result.breakdown).toEqual([{ tokenId: "t0", subtotal: 5 }]);
  });

  it("leaves no dropped set on a normal roll", () => {
    expect(roll("2d20", "normal", 11).breakdown[0]?.dropped).toBeUndefined();
  });
});

describe("cryptoDiceRng", () => {
  it("stays inside the faces and eventually covers them", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) {
      const face = cryptoDiceRng(6);
      expect(Number.isInteger(face)).toBe(true);
      expect(face).toBeGreaterThanOrEqual(1);
      expect(face).toBeLessThanOrEqual(6);
      seen.add(face);
    }
    expect(seen.size).toBe(6);
  });

  it("is the default generator", () => {
    // No rng argument: the roll must still be in range, which only holds if
    // rollTerms defaulted to a real generator rather than leaving it undefined.
    const face = rollTerms(termsOf("d20")).breakdown[0]?.rolls?.[0] ?? 0;
    expect(face).toBeGreaterThanOrEqual(1);
    expect(face).toBeLessThanOrEqual(20);
  });
});
