import { describe, expect, it } from "vitest";
import {
  DIAGONAL_RULES,
  coerceDiagonalRule,
  formatMeasurement,
  measureGridDistance,
  worldPointToGridCell,
  type DiagonalRule,
} from "../measurement.js";
import { gridCellToWorldPoint } from "../sceneGeometry.js";

const GRID = 50; // world px per square
const FEET = 5; // feet per square

/** Centre of cell (cx, cy) in world pixels — where a token sits. */
function cell(cx: number, cy: number) {
  return gridCellToWorldPoint(GRID, { x: cx, y: cy });
}

function measure(from: { x: number; y: number }, to: { x: number; y: number }, rule: DiagonalRule) {
  return measureGridDistance({
    start: from,
    end: to,
    gridSize: GRID,
    gridSquareSize: FEET,
    rule,
  });
}

describe("worldPointToGridCell", () => {
  it("round-trips every cell centre back to its own cell", () => {
    for (const [cx, cy] of [
      [0, 0],
      [3, 7],
      [-1, -1],
      [-4, 2],
    ]) {
      expect(worldPointToGridCell(GRID, gridCellToWorldPoint(GRID, { x: cx, y: cy }))).toEqual({
        x: cx,
        y: cy,
      });
    }
  });

  it("floors rather than truncates, so cells left of the origin are distinct", () => {
    // Math.trunc would fold -0.5 into cell 0 and lose a whole square.
    expect(worldPointToGridCell(GRID, { x: -1, y: -1 })).toEqual({ x: -1, y: -1 });
    expect(worldPointToGridCell(GRID, { x: 1, y: 1 })).toEqual({ x: 0, y: 0 });
  });
});

describe("coerceDiagonalRule", () => {
  it("passes the three real rules through", () => {
    for (const rule of DIAGONAL_RULES) {
      expect(coerceDiagonalRule(rule)).toBe(rule);
    }
  });

  it("falls back to 5e for anything else", () => {
    // Not to "euclidean": the pre-S6 maths is the defect, not the default.
    expect(coerceDiagonalRule("chebyshev")).toBe("5e");
    expect(coerceDiagonalRule(undefined)).toBe("5e");
    expect(coerceDiagonalRule(null)).toBe("5e");
    expect(coerceDiagonalRule(42)).toBe("5e");
    expect(coerceDiagonalRule({ rule: "5e" })).toBe("5e");
  });
});

describe("measureGridDistance — 5e (every square counts the same)", () => {
  it("counts a two-square diagonal as 2 squares / 10 ft — arc defect D11", () => {
    const result = measure(cell(0, 0), cell(2, 2), "5e");
    expect(result.squares).toBe(2);
    expect(result.feet).toBe(10);
  });

  it("counts a straight run as its own length", () => {
    expect(measure(cell(0, 0), cell(4, 0), "5e").squares).toBe(4);
    expect(measure(cell(0, 0), cell(0, 3), "5e").squares).toBe(3);
  });

  it("counts an L-shaped move as the longer leg", () => {
    expect(measure(cell(0, 0), cell(5, 2), "5e").squares).toBe(5);
  });

  it("is zero when both endpoints land in the same cell", () => {
    const result = measure({ x: 10, y: 10 }, { x: 45, y: 45 }, "5e");
    expect(result.squares).toBe(0);
    expect(result.feet).toBe(0);
  });

  it("is symmetric and sign-independent", () => {
    expect(measure(cell(3, 3), cell(0, 0), "5e").squares).toBe(3);
    expect(measure(cell(-2, -2), cell(1, 1), "5e").squares).toBe(3);
  });

  it("scales with the room's feet-per-square", () => {
    const result = measureGridDistance({
      start: cell(0, 0),
      end: cell(3, 0),
      gridSize: GRID,
      gridSquareSize: 10,
      rule: "5e",
    });
    expect(result.feet).toBe(30);
  });
});

describe("measureGridDistance — pathfinder (diagonals alternate 5-10)", () => {
  it("charges the second diagonal double: 2 diagonal squares is 15 ft", () => {
    const result = measure(cell(0, 0), cell(2, 2), "pathfinder");
    expect(result.squares).toBe(3);
    expect(result.feet).toBe(15);
  });

  it("charges the first diagonal single", () => {
    expect(measure(cell(0, 0), cell(1, 1), "pathfinder").squares).toBe(1);
  });

  it("walks the 1-3-4-6 ladder as diagonals accumulate", () => {
    const ladder = [1, 3, 4, 6, 7, 9];
    ladder.forEach((expected, index) => {
      const step = index + 1;
      expect(measure(cell(0, 0), cell(step, step), "pathfinder").squares).toBe(expected);
    });
  });

  it("agrees with 5e when there is no diagonal at all", () => {
    expect(measure(cell(0, 0), cell(6, 0), "pathfinder").squares).toBe(6);
  });

  it("charges only the diagonal part of an L-shaped move", () => {
    // 5 across, 2 down: two diagonal steps (one of them double) + 3 straight.
    expect(measure(cell(0, 0), cell(5, 2), "pathfinder").squares).toBe(6);
  });
});

describe("measureGridDistance — euclidean (the pre-S6 maths, preserved)", () => {
  it("reproduces the old readout for a two-square diagonal exactly", () => {
    // This is the number D11 complains about; it survives as an opt-in.
    const result = measure({ x: 0, y: 0 }, { x: 100, y: 100 }, "euclidean");
    expect(result.squares).toBe(2.8);
    expect(result.feet).toBe(14);
  });

  it("keeps fractional squares for an off-grid drag", () => {
    expect(measure({ x: 0, y: 0 }, { x: 75, y: 0 }, "euclidean").squares).toBe(1.5);
  });

  it("does not snap its endpoints", () => {
    const start = { x: 13, y: 27 };
    const end = { x: 111, y: 4 };
    const result = measure(start, end, "euclidean");
    expect(result.from).toEqual(start);
    expect(result.to).toEqual(end);
  });
});

describe("measureGridDistance — the line that is drawn", () => {
  it("snaps a grid-rule measurement to the centres of the counted cells", () => {
    const result = measure({ x: 12, y: 33 }, { x: 141, y: 108 }, "5e");
    expect(result.from).toEqual(cell(0, 0));
    expect(result.to).toEqual(cell(2, 2));
    // The drawn line and the reported number describe the same two cells.
    expect(result.squares).toBe(2);
  });

  it("snaps identically under pathfinder", () => {
    const result = measure({ x: 12, y: 33 }, { x: 141, y: 108 }, "pathfinder");
    expect(result.from).toEqual(cell(0, 0));
    expect(result.to).toEqual(cell(2, 2));
  });
});

describe("measureGridDistance — degenerate input", () => {
  it("reports zero rather than Infinity when the grid has no size", () => {
    for (const gridSize of [0, -50, Number.NaN, Number.POSITIVE_INFINITY]) {
      for (const rule of DIAGONAL_RULES) {
        const result = measureGridDistance({
          start: { x: 0, y: 0 },
          end: { x: 100, y: 100 },
          gridSize,
          gridSquareSize: FEET,
          rule,
        });
        expect(result.squares).toBe(0);
        expect(result.feet).toBe(0);
      }
    }
  });

  it("falls back to 5 ft per square when the room's value is not a number", () => {
    const result = measureGridDistance({
      start: cell(0, 0),
      end: cell(3, 0),
      gridSize: GRID,
      gridSquareSize: Number.NaN,
      rule: "5e",
    });
    expect(result.feet).toBe(15);
  });
});

describe("formatMeasurement", () => {
  it("renders the readout every screen at the table shows", () => {
    expect(formatMeasurement(measure(cell(0, 0), cell(2, 2), "5e"))).toBe("2 Squares (10 ft)");
    expect(formatMeasurement(measure({ x: 0, y: 0 }, { x: 100, y: 100 }, "euclidean"))).toBe(
      "2.8 Squares (14 ft)",
    );
  });
});
