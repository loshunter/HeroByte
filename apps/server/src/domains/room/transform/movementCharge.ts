/**
 * The movement budget's CHARGE, applied server-side on every road a PLAYER
 * or DM moves a token by while combat is active — a keyboard step, a drag
 * release, or the legacy `move` message all pay through here, so the number
 * every seat sees is the server's and cannot be edited on a client. A travel
 * warp (placeArrivals) and an NPC token placement are not moves and are
 * deliberately free.
 *
 * Charged under the table's diagonal rule with the character's running
 * diagonal count (Pathfinder alternates 1/2 across the whole turn, not per
 * hop). Out of combat there is no turn to budget, so nothing is charged; the
 * counters reset on the character's turn start and when combat starts/ends
 * (movementBudgetReset.ts).
 */

import { movementCharge } from "@herobyte/shared";
import type { RoomState } from "../model.js";

interface Cell {
  x: number;
  y: number;
}

/** One decimal place, like the ruler and the charge itself. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Above this the number means nothing and JSON would write `null` for Infinity. */
const MOVEMENT_USED_CAP_FEET = 1_000_000_000;

/** @returns true when a character was charged (the table must hear about it). */
export function chargeTokenMove(state: RoomState, tokenId: string, from: Cell, to: Cell): boolean {
  if (!state.combatActive) return false;
  const character = state.characters.find((candidate) => candidate.tokenId === tokenId);
  if (!character) return false;
  const charge = movementCharge({
    from,
    to,
    rule: state.diagonalRule ?? "5e",
    gridSquareSize: state.gridSquareSize ?? 5,
    diagonalsBefore: character.movementDiagonals ?? 0,
  });
  // A move to the cell it is on costs nothing and changes nothing — no
  // snapshot, no save (the legacy road forced both on a 0 ft charge).
  if (charge.feet <= 0) return false;
  character.movementUsed = Math.min(
    MOVEMENT_USED_CAP_FEET,
    round1((character.movementUsed ?? 0) + charge.feet),
  );
  character.movementDiagonals = (character.movementDiagonals ?? 0) + charge.diagonals;
  return true;
}
