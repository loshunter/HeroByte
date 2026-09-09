// The per-hop charge under each diagonal rule, with Pathfinder's alternation
// carried across hops — the one thing a path-independent ruler cannot do.

import { describe, expect, it } from "vitest";
import { measureGridDistance } from "../measurement.js";
import {
  DEFAULT_MOVEMENT_SPEED_FEET,
  MOVEMENT_SPEED_MAX_FEET,
  coerceMovementBudgetFields,
  movementBudgetFor,
  movementCharge,
  resetMovementBudget,
} from "../movementBudget.js";

const cell = (x: number, y: number) => ({ x, y });

describe("movementCharge", () => {
  it("a straight cell is one square under every rule", () => {
    for (const rule of ["5e", "pathfinder", "euclidean"] as const) {
      expect(
        movementCharge({
          from: cell(3, 4),
          to: cell(4, 4),
          rule,
          gridSquareSize: 5,
          diagonalsBefore: 0,
        }),
      ).toEqual({ feet: 5, diagonals: 0 });
    }
  });

  it("5e: a diagonal is one square, always — and it counts no diagonals (only Pathfinder reads them)", () => {
    for (const before of [0, 1, 7]) {
      expect(
        movementCharge({
          from: cell(3, 4),
          to: cell(4, 5),
          rule: "5e",
          gridSquareSize: 5,
          diagonalsBefore: before,
        }),
      ).toEqual({ feet: 5, diagonals: 0 });
    }
  });

  it("pathfinder: the 2nd, 4th, 6th diagonal OF THE TURN costs double — across hops", () => {
    const hop = (before: number) =>
      movementCharge({
        from: cell(0, 0),
        to: cell(1, 1),
        rule: "pathfinder",
        gridSquareSize: 5,
        diagonalsBefore: before,
      }).feet;
    expect([0, 1, 2, 3, 4, 5].map(hop)).toEqual([5, 10, 5, 10, 5, 10]);
    // A 3-diagonal hop from a clean slate: 1 + 2 + 1 = 4 squares.
    expect(
      movementCharge({
        from: cell(0, 0),
        to: cell(3, 3),
        rule: "pathfinder",
        gridSquareSize: 5,
        diagonalsBefore: 0,
      }),
    ).toEqual({ feet: 20, diagonals: 3 });
    // The same hop after one diagonal already taken: 2 + 1 + 2 = 5 squares.
    expect(
      movementCharge({
        from: cell(0, 0),
        to: cell(3, 3),
        rule: "pathfinder",
        gridSquareSize: 5,
        diagonalsBefore: 1,
      }),
    ).toEqual({ feet: 25, diagonals: 3 });
  });

  it("euclidean: the straight line to one decimal — a diagonal cell is 1.4 squares", () => {
    expect(
      movementCharge({
        from: cell(0, 0),
        to: cell(1, 1),
        rule: "euclidean",
        gridSquareSize: 5,
        diagonalsBefore: 0,
      }),
    ).toEqual({ feet: 7, diagonals: 0 });
    expect(
      movementCharge({
        from: cell(0, 0),
        to: cell(3, 4),
        rule: "euclidean",
        gridSquareSize: 5,
        diagonalsBefore: 0,
      }),
    ).toEqual({ feet: 25, diagonals: 0 });
  });

  it("agrees with the ruler for a single hop from a clean slate, under every rule", () => {
    // The budget must never disagree with the number the ruler shows for the
    // same two cells — the arc prompt's "5e/Pathfinder/Euclidean tables will
    // disagree with the ruler the DM set" trap.
    const gridSize = 50;
    for (const rule of ["5e", "pathfinder", "euclidean"] as const) {
      for (const [to] of [[cell(7, 4)], [cell(5, 7)], [cell(6, 8)]] as const) {
        const ruler = measureGridDistance({
          start: { x: 3 * gridSize + 25, y: 4 * gridSize + 25 },
          end: { x: to.x * gridSize + 25, y: to.y * gridSize + 25 },
          gridSize,
          gridSquareSize: 5,
          rule,
        });
        const charge = movementCharge({
          from: cell(3, 4),
          to,
          rule,
          gridSquareSize: 5,
          diagonalsBefore: 0,
        });
        expect(charge.feet, `${rule} to ${to.x},${to.y}`).toBe(ruler.feet);
      }
    }
  });

  it("euclidean measures RAW positions like the ruler, not rounded cells", () => {
    // A token dragged with Snap off sits at a fractional cell; the ruler
    // reports the raw line, so the budget must too (1.5 squares, not 2).
    expect(
      movementCharge({
        from: cell(0.5, 0),
        to: cell(2, 0),
        rule: "euclidean",
        gridSquareSize: 5,
        diagonalsBefore: 0,
      }),
    ).toEqual({ feet: 7.5, diagonals: 0 });
  });

  it("counts cells by their rounded index and honours the room's feet per square", () => {
    expect(
      movementCharge({
        from: cell(16.97, 14.6),
        to: cell(18, 15),
        rule: "5e",
        gridSquareSize: 10,
        diagonalsBefore: 0,
      }),
    ).toEqual({ feet: 10, diagonals: 0 });
    expect(
      movementCharge({
        from: cell(0, 0),
        to: cell(2, 0),
        rule: "5e",
        gridSquareSize: Number.NaN,
        diagonalsBefore: 0,
      }),
    ).toEqual({ feet: 10, diagonals: 0 });
  });
});

describe("coerceMovementBudgetFields — the file roads", () => {
  it("returns the same object when every field is sane or absent", () => {
    const sane = { speed: 25, movementUsed: 10, movementDiagonals: 1 };
    expect(coerceMovementBudgetFields(sane)).toBe(sane);
    const absent: { name: string; speed?: number } = { name: "x" };
    expect(coerceMovementBudgetFields(absent)).toBe(absent);
  });

  it("drops NaN / negative / non-number spend fields and clamps speed to the shared bounds", () => {
    expect(
      coerceMovementBudgetFields({
        speed: 1e9,
        movementUsed: Number.NaN,
        movementDiagonals: -3 as number,
      }),
    ).toStrictEqual({ speed: MOVEMENT_SPEED_MAX_FEET });
    expect(
      coerceMovementBudgetFields({
        speed: "fast" as unknown as number,
        movementUsed: "3" as unknown as number,
        movementDiagonals: null as unknown as number,
      }),
    ).toStrictEqual({});
    expect(coerceMovementBudgetFields({ speed: -5 })).toStrictEqual({ speed: 0 });
    // Infinity passes `>= 0`; only the finiteness check catches it.
    expect(
      coerceMovementBudgetFields({ movementUsed: Number.POSITIVE_INFINITY, movementDiagonals: 1 }),
    ).toStrictEqual({ movementDiagonals: 1 });
    expect(
      coerceMovementBudgetFields({ movementRound: Number.NaN, movementDiagonals: 1 }),
    ).toStrictEqual({ movementDiagonals: 1 });
  });
});

describe("resetMovementBudget", () => {
  it("zeroes both counters, stamps the round when given one, and tolerates a missing character", () => {
    const character = { movementUsed: 20, movementDiagonals: 3 };
    resetMovementBudget(character);
    expect(character).toStrictEqual({ movementUsed: 0, movementDiagonals: 0 });
    resetMovementBudget(character, 3);
    expect(character).toStrictEqual({ movementUsed: 0, movementDiagonals: 0, movementRound: 3 });
    expect(() => resetMovementBudget(undefined)).not.toThrow();
  });
});

describe("movementBudgetFor", () => {
  it("defaults speed, treats a missing used as zero, and reports the remainder", () => {
    expect(movementBudgetFor({})).toEqual({
      speed: DEFAULT_MOVEMENT_SPEED_FEET,
      used: 0,
      remaining: DEFAULT_MOVEMENT_SPEED_FEET,
    });
    expect(movementBudgetFor({ speed: 25, movementUsed: 30 })).toEqual({
      speed: 25,
      used: 30,
      remaining: -5,
    });
    expect(movementBudgetFor({ speed: 30, movementUsed: 7.1 + 7.1 })).toEqual({
      speed: 30,
      used: 14.2,
      remaining: 15.8,
    });
  });
});
