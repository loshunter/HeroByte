import { describe, it, expect } from "vitest";
import { detectRollFlavor } from "../diceJuice";
import type { RollResult } from "../../../components/dice/types";

function makeResult(perDie: RollResult["perDie"]): RollResult {
  return { id: "r", tokens: [], perDie, total: 0, timestamp: 0 };
}

describe("detectRollFlavor", () => {
  it("returns normal for null/empty results", () => {
    expect(detectRollFlavor(null)).toBe("normal");
    expect(detectRollFlavor(makeResult([]))).toBe("normal");
  });

  it("detects a natural 20 on a d20 as crit", () => {
    const result = makeResult([{ tokenId: "a", die: "d20", rolls: [20], subtotal: 20 }]);
    expect(detectRollFlavor(result)).toBe("crit");
  });

  it("detects a natural 1 on a d20 as fumble", () => {
    const result = makeResult([{ tokenId: "a", die: "d20", rolls: [1], subtotal: 1 }]);
    expect(detectRollFlavor(result)).toBe("fumble");
  });

  it("prioritizes crit when both a 20 and a 1 are rolled", () => {
    const result = makeResult([{ tokenId: "a", die: "d20", rolls: [1, 20], subtotal: 21 }]);
    expect(detectRollFlavor(result)).toBe("crit");
  });

  it("ignores 20s and 1s on non-d20 dice", () => {
    const result = makeResult([
      { tokenId: "a", die: "d6", rolls: [1], subtotal: 1 },
      { tokenId: "b", die: "d100", rolls: [20], subtotal: 20 },
    ]);
    expect(detectRollFlavor(result)).toBe("normal");
  });

  it("treats a non-max d20 roll as normal", () => {
    const result = makeResult([{ tokenId: "a", die: "d20", rolls: [14], subtotal: 14 }]);
    expect(detectRollFlavor(result)).toBe("normal");
  });
});
