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
/**
 * How many objects one `step-object` may carry. A walk sends one message per
 * step for the WHOLE selection (a per-object message tripped the 100/s
 * limiter past ~15 objects and dropped steps at random); the client chunks a
 * larger selection.
 */
export const MAX_STEP_OBJECTS = 64;
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

  // Only Pathfinder reads the running diagonal count, so only Pathfinder
  // writes it — a table that switches rule mid-turn starts alternating from
  // a clean count rather than from hops charged under another rule.
  if (input.rule === "euclidean") {
    const squares = round1(Math.hypot(input.to.x - input.from.x, input.to.y - input.from.y));
    return { feet: round1(squares * feetPerSquare), diagonals: 0 };
  }

  const long = Math.max(dx, dy);
  const short = Math.min(dx, dy);
  const before = Math.max(0, Math.floor(input.diagonalsBefore));
  if (input.rule !== "pathfinder") {
    return { feet: round1(long * feetPerSquare), diagonals: 0 };
  }
  const extra = Math.floor((before + short) / 2) - Math.floor(before / 2);
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

/** A budget starts over: the character's turn began, or combat did. */
export function resetMovementBudget(
  character:
    | { movementUsed?: number; movementDiagonals?: number; movementRound?: number }
    | undefined,
  round?: number,
): void {
  if (!character) return;
  character.movementUsed = 0;
  character.movementDiagonals = 0;
  if (round !== undefined) character.movementRound = round;
}

/**
 * The three budget fields as they may arrive from a FILE (a session load, a
 * restart): every other character field beside them is normalised on the way
 * in, and a hand-edited `movementDiagonals: NaN` would otherwise poison every
 * later charge (`Math.max(0, Math.floor(NaN))` is NaN). Returns the same
 * object when nothing needed fixing.
 */
export function coerceMovementBudgetFields<
  T extends {
    speed?: number;
    movementUsed?: number;
    movementDiagonals?: number;
    movementRound?: number;
  },
>(character: T): T {
  const speed =
    typeof character.speed === "number" && Number.isFinite(character.speed)
      ? Math.min(MOVEMENT_SPEED_MAX_FEET, Math.max(MOVEMENT_SPEED_MIN_FEET, character.speed))
      : undefined;
  const spend = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
  const used = spend(character.movementUsed);
  const diagonals = spend(character.movementDiagonals);
  // A stamp key, compared by equality: any integer, 0 and below included.
  const round = Number.isInteger(character.movementRound) ? character.movementRound : undefined;
  if (
    speed === character.speed &&
    used === character.movementUsed &&
    diagonals === character.movementDiagonals &&
    round === character.movementRound
  ) {
    return character;
  }
  const next = { ...character };
  for (const [key, value] of [
    ["speed", speed],
    ["movementUsed", used],
    ["movementDiagonals", diagonals],
    ["movementRound", round],
  ] as const) {
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  return next;
}
