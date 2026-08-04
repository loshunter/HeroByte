// ============================================================================
// DICE NOTATION — the parser is the gate
// ============================================================================
// parseDiceFormula is the ONLY thing standing between a client string and the
// server's roller: the wire validator calls it and the handler calls it, so
// every ceiling is tested here rather than twice, badly, further downstream.

import { describe, expect, it } from "vitest";
import {
  DICE_LIMITS,
  DIE_FACES,
  coerceDiceRollMode,
  coerceDiceVisibility,
  formatDiceTerms,
  parseDiceFormula,
  type DiceTerm,
} from "../dice.js";

/** Terms of a formula that must parse, or the error if it must not. */
function terms(formula: string): DiceTerm[] {
  const result = parseDiceFormula(formula);
  if (!result.ok) throw new Error(`expected "${formula}" to parse, got: ${result.error}`);
  return result.terms;
}

function errorFor(formula: unknown): string {
  const result = parseDiceFormula(formula);
  if (result.ok) throw new Error(`expected "${String(formula)}" to be rejected`);
  return result.error;
}

describe("parseDiceFormula", () => {
  it("reads a bare die as a single die", () => {
    expect(terms("d20")).toEqual([{ kind: "die", die: "d20", qty: 1, sign: 1 }]);
  });

  it("reads an explicit quantity", () => {
    expect(terms("3d6")).toEqual([{ kind: "die", die: "d6", qty: 3, sign: 1 }]);
  });

  it("accepts an uppercase D", () => {
    expect(terms("2D8")).toEqual([{ kind: "die", die: "d8", qty: 2, sign: 1 }]);
  });

  it("ignores whitespace anywhere", () => {
    expect(terms("  2 d 20  +  5 ")).toEqual([
      { kind: "die", die: "d20", qty: 2, sign: 1 },
      { kind: "mod", value: 5 },
    ]);
  });

  it("keeps term order and signs", () => {
    expect(terms("1d20 + 5 - 2")).toEqual([
      { kind: "die", die: "d20", qty: 1, sign: 1 },
      { kind: "mod", value: 5 },
      { kind: "mod", value: -2 },
    ]);
  });

  it("accepts a leading negative modifier", () => {
    expect(terms("-2")).toEqual([{ kind: "mod", value: -2 }]);
  });

  it("accepts a subtracted die — Bane is real notation", () => {
    expect(terms("1d20 - 1d4")).toEqual([
      { kind: "die", die: "d20", qty: 1, sign: 1 },
      { kind: "die", die: "d4", qty: 1, sign: -1 },
    ]);
  });

  it("accepts every die the roller knows", () => {
    for (const die of Object.keys(DIE_FACES)) {
      expect(terms(die)).toEqual([{ kind: "die", die, qty: 1, sign: 1 }]);
    }
  });

  it.each([
    ["", "formula is empty"],
    ["   ", "formula is empty"],
    ["2d7", "unsupported die: d7"],
    ["d0", "unsupported die: d0"],
    ["0d6", "dice quantity must be at least 1"],
    ["2d6+", 'unexpected "+" in formula'],
    ["++5", 'unexpected "+" in formula'],
    ["2d", 'unexpected "d" in formula'],
    // Anything the scanner cannot consume is refused, and the error names the
    // text it stopped on rather than a generic "invalid formula".
    ["d20 drop lowest", 'unexpected "droplowest" in formula'],
    ["1d20;DROP TABLE", 'unexpected ";DROPTABLE" in formula'],
    ["<script>", 'unexpected "<script>" in formula'],
  ])("rejects %j", (formula, expected) => {
    expect(errorFor(formula)).toContain(expected);
  });

  it("rejects a non-string", () => {
    expect(errorFor(undefined)).toBe("formula must be text");
    expect(errorFor(42)).toBe("formula must be text");
    expect(errorFor({ formula: "d20" })).toBe("formula must be text");
  });

  it("rejects a formula longer than the cap", () => {
    expect(errorFor("1".repeat(DICE_LIMITS.FORMULA_MAX + 1))).toContain("exceeds");
  });

  it("rejects a quantity above the per-term cap", () => {
    expect(errorFor(`${DICE_LIMITS.QTY_MAX + 1}d6`)).toContain("quantity exceeds");
  });

  it("rejects more total dice than the roller will throw", () => {
    // Two terms, each individually legal, that together cross the ceiling —
    // a per-term cap alone would admit this.
    const half = DICE_LIMITS.TOTAL_DICE_MAX / 2;
    expect(terms(`${half}d6 + ${half}d6`)).toHaveLength(2);
    expect(errorFor(`${half}d6 + ${half}d6 + 1d6`)).toContain("more than");
  });

  it("rejects a modifier larger than the cap", () => {
    expect(errorFor(`${DICE_LIMITS.MODIFIER_ABS_MAX + 1}`)).toContain("modifier exceeds");
  });

  it("rejects more terms than the cap", () => {
    const tooMany = Array.from({ length: DICE_LIMITS.TERMS_MAX + 1 }, () => "1").join("+");
    expect(errorFor(tooMany)).toContain("more than");
  });
});

describe("formatDiceTerms", () => {
  it("round-trips a formula to canonical notation", () => {
    expect(formatDiceTerms(terms("2d20+5"))).toBe("2d20 + 5");
    // A quantity of one is dropped, so "1d4" and "d4" produce one history line.
    expect(formatDiceTerms(terms("  d20  -  1 d4 "))).toBe("d20 - d4");
    expect(formatDiceTerms(terms("-2"))).toBe("-2");
    expect(formatDiceTerms(terms("1d6"))).toBe("d6");
  });

  it("is stable: formatting a parsed format parses to the same terms", () => {
    const original = terms("3d8 - 2 + 1d4 - 1");
    expect(terms(formatDiceTerms(original))).toEqual(original);
  });
});

describe("coercers", () => {
  it("keeps the two real modes and normalises everything else", () => {
    expect(coerceDiceRollMode("advantage")).toBe("advantage");
    expect(coerceDiceRollMode("disadvantage")).toBe("disadvantage");
    expect(coerceDiceRollMode("normal")).toBe("normal");
    expect(coerceDiceRollMode(undefined)).toBe("normal");
    expect(coerceDiceRollMode("ADVANTAGE")).toBe("normal");
  });

  it("treats absent visibility as public and anything unrecognized as private", () => {
    expect(coerceDiceVisibility(undefined)).toBe("public");
    expect(coerceDiceVisibility(null)).toBe("public");
    expect(coerceDiceVisibility("public")).toBe("public");
    expect(coerceDiceVisibility("dm")).toBe("dm");
    expect(coerceDiceVisibility("self")).toBe("self");
    // A corrupt or forward-dated state file must not be able to promote a
    // secret roll into a broadcast one.
    expect(coerceDiceVisibility("everyone")).toBe("self");
    expect(coerceDiceVisibility(1)).toBe("self");
    expect(coerceDiceVisibility({})).toBe("self");
  });
});
