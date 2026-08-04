/**
 * Tests for diceLogic — the build/formula bridge
 *
 * This file used to test `rngIntSecure` and `rollBuild`: a CSPRNG and a roll
 * evaluator that lived in the browser, whose output the server stored verbatim
 * (arc defect D2). Both are gone in S5. What is left is the one thing the
 * client still decides — how to say what it wants rolled — and the property
 * that matters about it is that the SERVER's parser accepts every string it
 * produces, which is asserted here against the real shared parser rather than
 * a local approximation of it.
 */

import { describe, it, expect } from "vitest";
import { parseDiceFormula } from "@herobyte/shared";
import { formulaFromBuild, formatRollText } from "../diceLogic";
import type { Build, DieType, RollResult, Token } from "../types";

function die(type: DieType, qty = 1, id = "t"): Token {
  return { kind: "die", die: type, qty, id };
}

function mod(value: number, id = "m"): Token {
  return { kind: "mod", value, id };
}

describe("formulaFromBuild", () => {
  it("renders a single die without a redundant quantity", () => {
    expect(formulaFromBuild([die("d20")])).toBe("d20");
  });

  it("renders an explicit quantity above one", () => {
    expect(formulaFromBuild([die("d6", 3)])).toBe("3d6");
  });

  it("joins dice and modifiers with signed operators", () => {
    expect(formulaFromBuild([die("d20"), mod(5), mod(-2, "m2")])).toBe("d20 + 5 - 2");
  });

  it("renders a leading negative modifier", () => {
    expect(formulaFromBuild([mod(-3)])).toBe("-3");
  });

  it("renders an empty build as an empty string", () => {
    expect(formulaFromBuild([])).toBe("");
  });

  it("clamps a zero or negative quantity the strip can reach", () => {
    // "0d6" is a formula the server refuses; sending the roll the player
    // obviously meant beats failing the request on a stepper edge.
    expect(formulaFromBuild([die("d6", 0)])).toBe("d6");
    expect(formulaFromBuild([die("d6", -2)])).toBe("d6");
  });

  it("truncates a fractional modifier rather than emitting a decimal", () => {
    expect(formulaFromBuild([mod(2.7)])).toBe("2");
  });

  it("produces only formulas the SERVER's parser accepts", () => {
    const builds: Build[] = [
      [die("d4")],
      [die("d100", 2)],
      [die("d20"), mod(5)],
      [die("d20"), mod(-1), die("d6", 4, "t2")],
      [mod(-7)],
      [die("d8", 0)],
      [mod(3.9)],
    ];
    for (const build of builds) {
      const formula = formulaFromBuild(build);
      expect(parseDiceFormula(formula).ok, `"${formula}"`).toBe(true);
    }
  });

  it("round-trips every die type", () => {
    for (const type of ["d4", "d6", "d8", "d10", "d12", "d20", "d100"] as const) {
      expect(formulaFromBuild([die(type, 2)])).toBe(`2${type}`);
    }
  });
});

describe("formatRollText", () => {
  const result = (formula: string, total: number): RollResult => ({
    id: "r",
    formula,
    perDie: [],
    total,
    timestamp: 0,
  });

  it("formats a settled roll for copying", () => {
    expect(formatRollText(result("2d20 + 5", 26))).toBe("2d20 + 5 → 26");
  });

  it("formats a negative total", () => {
    expect(formatRollText(result("d4 - 10", -6))).toBe("d4 - 10 → -6");
  });

  it("formats a zero total", () => {
    expect(formatRollText(result("+0", 0))).toBe("+0 → 0");
  });
});
