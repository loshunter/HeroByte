// ============================================================================
// MEASUREMENT — how far apart two points on the table are
// ============================================================================
// ONE implementation of the diagonal rule, for the same reason `dice.ts` owns
// dice notation and `visibility.ts` owns sightlines: the moment a second copy
// of this maths exists, the two halves of the app can disagree about whether
// Grak is in range, and the table stops trusting the number. Every consumer —
// the measure overlay, any future server-side range check — imports from here.
//
// Before this module the client measured Euclidean distance in raw pixels, so
// a two-square diagonal read "2.8 Squares (14 ft)" where 5e says 10 (arc
// defect D11).

import { gridCellToWorldPoint } from "./sceneGeometry.js";

export interface MeasurePoint {
  x: number;
  y: number;
}

/**
 * How a table counts diagonal movement.
 *
 * - `5e` — every square costs the same, diagonal or not (D&D 5e, "Chebyshev").
 *   A 2-square diagonal is 10 ft.
 * - `pathfinder` — diagonals alternate 5-10-5-10 (Pathfinder 1e, D&D 3.5, and
 *   the 5e DMG's optional variant). A 2-square diagonal is 15 ft.
 * - `euclidean` — straight-line distance, fractional squares. What HeroByte
 *   did before this existed; kept because some tables genuinely want it.
 */
export const DIAGONAL_RULES = ["5e", "pathfinder", "euclidean"] as const;
export type DiagonalRule = (typeof DIAGONAL_RULES)[number];

/** Human labels for the three rules, so every surface names them identically. */
export const DIAGONAL_RULE_LABELS: Record<DiagonalRule, string> = {
  "5e": "5e",
  pathfinder: "Pathfinder",
  euclidean: "Euclidean",
};

/**
 * Whitelist-coerce an untrusted value to a diagonal rule. Used everywhere a
 * rule enters from outside the type system — a state file off disk, a session
 * file a client uploaded — so the measurement code only ever branches on the
 * three real rules.
 *
 * Unknown input falls back to `5e`, NOT to the pre-S6 `euclidean` behaviour:
 * the room's grid is measured in squares and feet, and counting a diagonal as
 * 1.4 squares was the defect. A table that wants the old maths says so.
 */
export function coerceDiagonalRule(value: unknown): DiagonalRule {
  return DIAGONAL_RULES.includes(value as never) ? (value as DiagonalRule) : "5e";
}

/**
 * World pixels -> the grid cell containing them. Exact inverse of
 * `gridCellToWorldPoint` for any point inside a cell, including negative
 * coordinates (floor, not truncate: `Math.trunc(-0.5)` would fold cell -1 into
 * cell 0 and make distances across the origin one square short).
 */
export function worldPointToGridCell(gridSize: number, point: MeasurePoint): MeasurePoint {
  return { x: Math.floor(point.x / gridSize), y: Math.floor(point.y / gridSize) };
}

export interface GridDistanceInput {
  /** Where the measurement starts, in WORLD pixels. */
  start: MeasurePoint;
  /** Where it ends, in WORLD pixels. */
  end: MeasurePoint;
  /** World pixels per grid square (`RoomState.gridSize`). */
  gridSize: number;
  /** Feet per grid square (`RoomState.gridSquareSize`, default 5). */
  gridSquareSize: number;
  rule: DiagonalRule;
}

export interface GridDistance {
  /** Distance in grid squares. Whole squares under a grid rule. */
  squares: number;
  /** The same distance in the room's units. */
  feet: number;
  /**
   * The endpoints the line should be DRAWN between. Under a grid rule these
   * are the centres of the two counted cells, so the line a player sees is the
   * one the number describes; under `euclidean` they are the raw points.
   */
  from: MeasurePoint;
  to: MeasurePoint;
}

/** One decimal place, the precision the readout has always shown. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Measure between two world points under the room's diagonal rule.
 *
 * A grid rule COUNTS CELLS — that is what makes "2 squares = 10 ft" true — so
 * both endpoints collapse to the cell that contains them and the answer is a
 * whole number of squares. Euclidean keeps the raw points and reports
 * fractional squares, reproducing the pre-S6 readout exactly.
 *
 * A non-positive or non-finite `gridSize` means there is no grid to count, so
 * the distance is zero rather than Infinity/NaN — this runs inside a render.
 */
export function measureGridDistance(input: GridDistanceInput): GridDistance {
  const { start, end, gridSize, gridSquareSize, rule } = input;
  const feetPerSquare = Number.isFinite(gridSquareSize) ? gridSquareSize : 5;

  if (!Number.isFinite(gridSize) || gridSize <= 0) {
    return { squares: 0, feet: 0, from: start, to: end };
  }

  if (rule === "euclidean") {
    const squares = round1(Math.hypot(end.x - start.x, end.y - start.y) / gridSize);
    // Feet derive from the ROUNDED square count, matching the original
    // readout: at grid 50 / 5 ft, a 141px diagonal has always read
    // "2.8 Squares (14 ft)" and not "14.1".
    return { squares, feet: round1(squares * feetPerSquare), from: start, to: end };
  }

  const fromCell = worldPointToGridCell(gridSize, start);
  const toCell = worldPointToGridCell(gridSize, end);
  const dx = Math.abs(toCell.x - fromCell.x);
  const dy = Math.abs(toCell.y - fromCell.y);
  const long = Math.max(dx, dy);
  const short = Math.min(dx, dy);

  // Both rules walk `short` diagonal steps and `long - short` straight ones.
  // 5e charges one square for every step. Pathfinder charges two for every
  // SECOND diagonal, which is exactly `Math.floor(short / 2)` extra squares.
  const squares = rule === "5e" ? long : long + Math.floor(short / 2);

  return {
    squares,
    feet: round1(squares * feetPerSquare),
    from: gridCellToWorldPoint(gridSize, fromCell),
    to: gridCellToWorldPoint(gridSize, toCell),
  };
}

/**
 * The readout string. Shared so a broadcast measurement reads the same on
 * every screen at the table, character for character.
 */
export function formatMeasurement(distance: GridDistance): string {
  return `${distance.squares} Squares (${distance.feet} ft)`;
}
