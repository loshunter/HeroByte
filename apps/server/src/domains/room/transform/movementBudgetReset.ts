/**
 * When a movement budget starts over.
 *
 * A character's counters reset when THEIR turn starts — but only once per
 * combat ROUND: `state.combatRound` steps forward when next-turn wraps the
 * order, forward once more when a combatant holding the turn LEAVES the order
 * from its last position (`leaveOrderBudget` below), and back when
 * previous-turn wraps it the other way — to one lap below the newest stamp
 * still in the order and no further: a backward wrap must exactly undo a
 * forward one (the asymmetry is a refill), and below that line `>=` would
 * freeze every budget. A character STAMPED with
 * the current round or a LATER one is not reset again — the stamp is compared
 * with `>=`, never equality: with no floor, a player can walk the round below
 * a stamp with repeated PREV and make an already-spent turn look unstamped,
 * which was a five-click refill (flagged-items review). The stamp is written
 * by the turn start itself, never ahead of it — the one combatant whose turn
 * begins at combat start (Start Combat, the first roll, a resumed travel, a
 * session load) IS
 * stamped, because its turn is starting; unstamped, a PREV then a NEXT wrapped
 * back onto it and refilled a budget it had spent, two clicks by any player:
 * review round 3 found that pre-stamping everyone at combat start made every
 * round-1 turn start a no-op, so a spend made before your first turn stood
 * through it. So a PREV (a correction into a turn already partly spent)
 * refills nothing, and a player who can nudge the order (any player can)
 * cannot refill their own budget by pressing PREV then NEXT.
 *
 * Every character's reset — and the round returns to 1 — when combat starts
 * or ends on ANY road (the buttons, the first initiative value, clear-all, a
 * travel that suspends or resumes a fight, a session load), so a budget never
 * carries from one fight into the next and never ticks outside one. A travel
 * is not a turn boundary: the party arrives fresh.
 *
 * And the DM may zero ONE character's counters at any time
 * (`reset-movement-budget`, ws/handlers/movementBudgetMessages.ts) — the
 * budget is advisory, and that is the DM's lever besides the turn. It leaves
 * the round stamp alone for the reason above.
 */

import { isInInitiativeOrder, resetMovementBudget } from "@herobyte/shared";
import type { Character } from "@herobyte/shared";
import type { RoomState } from "../model.js";

export { resetMovementBudget };

export function currentRound(state: RoomState): number {
  return state.combatRound ?? 1;
}

export function resetAllMovementBudgets(state: RoomState): void {
  state.combatRound = 1;
  for (const character of state.characters) {
    resetMovementBudget(character);
    delete character.movementRound; // stamped by the first turn start, not here
  }
}

/** The character's turn starts: reset, unless this round already did. */
export function startTurnBudget(state: RoomState, character: Character | undefined): void {
  if (!character) return;
  const round = currentRound(state);
  // `>=`, not `===`: previous-turn's floor still allows one lap below the
  // newest stamp, and a stamp AHEAD of the round must not read as unstamped.
  if (character.movementRound !== undefined && character.movementRound >= round) return;
  resetMovementBudget(character, round);
}

/**
 * A character leaves the order — its initiative cleared, or the character
 * deleted. `orderBefore` is the initiative order with it STILL in place, read
 * by the caller before the mutation. If it held the turn, the turn passes to
 * its successor exactly as next-turn would have: the successor's budget
 * starts, and when the departing one was last in the order the round steps
 * once. (A holder that was not in `orderBefore` at all — a loaded file can say
 * so — has no successor to find: the pointer blanks and no lap is counted, the
 * one place this differs from a NEXT.) Blanking the pointer here (or leaving
 * it on a deleted id) used to send
 * the next NEXT to the top of the order with a round counted, so everyone
 * behind the departed combatant lost that round's turn. The round stamp STAYS
 * — startTurnBudget's `>=` refills a returner in a later round, and deleting
 * it handed the leaver a second full turn in the SAME round (clear, re-roll
 * lower, walk on) — and the SPEND stays. Any player may clear their own
 * initiative (a withdrawal is not a claim), and review round 3 showed that
 * zeroing here handed a player a two-click refill: clear, re-roll, walk on. A
 * budget a player can raise is not a budget.
 */
export function leaveOrderBudget(
  state: RoomState,
  character: Character,
  orderBefore: readonly Character[],
): void {
  if (state.currentTurnCharacterId === character.id) {
    const index = orderBefore.findIndex((c) => c.id === character.id);
    const rest = orderBefore.filter((c) => c.id !== character.id);
    if (index === -1 || rest.length === 0) {
      // Held the turn without standing in the order (a loaded file can say
      // so), or nobody is left to act: there is no successor.
      state.currentTurnCharacterId = undefined;
    } else {
      // Removal closes the gap, so `rest[index]` is whoever stood behind it.
      const wraps = index >= rest.length;
      if (wraps) state.combatRound = currentRound(state) + 1;
      const successor = rest[wraps ? 0 : index];
      state.currentTurnCharacterId = successor.id;
      startTurnBudget(state, successor);
    }
  }
}

/**
 * A load door's rule (sceneSuspend has the same one): a turn pointer that does
 * not stand in the order — the session-file merge prefers a LIVE character
 * over the file's, so the saved combatant can arrive without its roll while
 * the file's pointer still names it — is dropped, not left dangling. The next
 * initiative set re-seats it at the top (applyInitiative); a NEXT from a blank
 * pointer also lands on the top. Blank rather than re-seat here because the
 * order's sort lives in CharacterService, and a second copy of it would drift.
 */
export function dropTurnPointerOutsideOrder(state: RoomState): void {
  const holder = state.characters.find((c) => c.id === state.currentTurnCharacterId);
  if (holder && isInInitiativeOrder(holder, state.players)) return;
  state.currentTurnCharacterId = undefined;
}
