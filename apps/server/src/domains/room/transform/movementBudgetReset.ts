/**
 * When a movement budget starts over.
 *
 * A character's counters reset when THEIR turn starts — but only once per
 * combat ROUND: `state.combatRound` steps forward when next-turn wraps the
 * order and back when previous-turn wraps it the other way, and a character
 * stamped with the current round is not reset again. So a PREV (a correction
 * into a turn already partly spent) refills nothing, and a player who can
 * nudge the order (any player can) cannot refill their own budget by
 * pressing PREV then NEXT.
 *
 * Every character's reset — and the round returns to 1 — when combat starts
 * or ends on ANY road (the buttons, the first initiative value, clear-all, a
 * travel that suspends or resumes a fight), so a budget never carries from
 * one fight into the next and never ticks outside one. A travel is not a
 * turn boundary: the party arrives fresh.
 */

import { resetMovementBudget } from "@herobyte/shared";
import type { Character } from "@herobyte/shared";
import type { RoomState } from "../model.js";

export { resetMovementBudget };

export function currentRound(state: RoomState): number {
  return state.combatRound ?? 1;
}

export function resetAllMovementBudgets(state: RoomState): void {
  state.combatRound = 1;
  for (const character of state.characters) resetMovementBudget(character, 1);
}

/** The character's turn starts: reset, unless this round already did. */
export function startTurnBudget(state: RoomState, character: Character | undefined): void {
  if (!character) return;
  const round = currentRound(state);
  if (character.movementRound === round) return;
  resetMovementBudget(character, round);
}

/**
 * A character leaves the order (its initiative cleared): a turn pointer left
 * on it would send next-turn to whoever sorts first, and a spend nobody can
 * reset would follow it back in — so both go (the clear-all rule, per head).
 */
export function leaveOrderBudget(state: RoomState, character: Character): void {
  if (state.currentTurnCharacterId === character.id) state.currentTurnCharacterId = undefined;
  resetMovementBudget(character);
  delete character.movementRound;
}
