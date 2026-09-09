// ============================================================================
// MOVEMENT BUDGET — the charge for a hop, and what a character has left
// ============================================================================
// A keyboard step is one cell; what it COSTS is the table's diagonal rule.
// `measureGridDistance` answers "how far between two points" and is
// path-independent, which is right for a ruler and wrong for a budget:
// Pathfinder charges every SECOND diagonal double, so the price of this hop
// depends on how many diagonals the character has already taken this turn.
// This module keeps that running count. One copy, shared, so the server's
// charge and any client preview cannot disagree.
//
// Charges are in the room's units (feet), from `gridSquareSize` (default 5).

import type { DiagonalRule, MeasurePoint } from "./measurement.js";

/** Feet per turn when the DM has not set a character's speed. */
export const DEFAULT_MOVEMENT_SPEED_FEET = 30;
export const MOVEMENT_SPEED_MIN_FEET = 0;
export const MOVEMENT_SPEED_MAX_FEET = 1000;

export interface MovementChargeInput {
  /** Grid cells (may be fractional; a cell is counted by its rounded index). */
  from: MeasurePoint;
  to: MeasurePoint;
  rule: DiagonalRule;
  /** Feet per grid square (`RoomState.gridSquareSize`, default 5). */
  gridSquareSize: number;
  /** Diagonal steps already taken this turn — Pathfinder's alternation state. */
  diagonalsBefore: number;
}

export interface MovementCharge {
  /** Feet this hop costs. */
  feet: number;
  /** Diagonal steps this hop contains, to add to the running count. */
  diagonals: number;
}

/** One decimal place, the precision the ruler has always shown. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * The cost of moving from one cell to another under the table's rule.
 *
 * A grid rule walks `short` diagonal steps and `long - short` straight ones.
 * 5e charges one square per step. Pathfinder charges the 2nd, 4th, 6th…
 * diagonal OF THE TURN double — so with `d` diagonals already taken, this
 * hop's `short` new ones cost `floor((d + short) / 2) - floor(d / 2)` extra.
 * Euclidean is the straight-line length in squares, to one decimal.
 */
export function movementCharge(input: MovementChargeInput): MovementCharge {
  const feetPerSquare = Number.isFinite(input.gridSquareSize) ? input.gridSquareSize : 5;
  const dx = Math.abs(Math.round(input.to.x) - Math.round(input.from.x));
  const dy = Math.abs(Math.round(input.to.y) - Math.round(input.from.y));

  if (input.rule === "euclidean") {
    const squares = round1(Math.hypot(input.to.x - input.from.x, input.to.y - input.from.y));
    return { feet: round1(squares * feetPerSquare), diagonals: Math.min(dx, dy) };
  }

  const long = Math.max(dx, dy);
  const short = Math.min(dx, dy);
  const before = Math.max(0, Math.floor(input.diagonalsBefore));
  const extra =
    input.rule === "pathfinder" ? Math.floor((before + short) / 2) - Math.floor(before / 2) : 0;
  return { feet: round1((long + extra) * feetPerSquare), diagonals: short };
}

/** What a character has left this turn, from the fields the server keeps. */
export interface MovementBudget {
  speed: number;
  used: number;
  remaining: number;
}

export function movementBudgetFor(character: {
  speed?: number;
  movementUsed?: number;
}): MovementBudget {
  const speed = character.speed ?? DEFAULT_MOVEMENT_SPEED_FEET;
  const used = round1(character.movementUsed ?? 0);
  return { speed, used, remaining: round1(speed - used) };
}
