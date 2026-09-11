/**
 * reset-movement-budget: the DM zeroes a character's spend outside a turn
 * boundary — a mis-press, a re-adjudication, a spell that restores movement.
 * The budget is ADVISORY (the owner's call: "it's a VTT, not an RPG game"),
 * so this is the DM's one lever besides the turn itself.
 *
 * DM-only by construction, like set-character-speed: a budget a player could
 * raise is not a budget. The per-round stamp is NOT touched — a stamp written
 * ahead of its event is a no-op at the event (review round 3 of the arc), so
 * the character's next turn start still resets it like anyone else's. A
 * character with nothing spent is a no-op: no broadcast, no save. It does not
 * check `combatActive` — defensive only: every ordinary road out of combat
 * already zeroes every budget (end-combat, clear-all, travel, a session load,
 * and nothing is charged outside a fight), so out of combat a spend exists
 * only if a state file carried one in — and every client control is gated
 * on combat, so that branch is reachable only by a hand-sent message.
 *
 * Its own module rather than a CharacterMessageHandler method: that file has
 * seven lines of headroom under the 350-line guard (342 today) and this,
 * with its docblock, is ~40.
 */

import { resetMovementBudget } from "../../domains/room/transform/movementBudgetReset.js";
import type { RoomState } from "../../domains/room/model.js";
import type { CharacterMessageResult } from "./CharacterMessageHandler.js";

export function handleResetMovementBudget(
  state: RoomState,
  characterId: string,
  senderUid: string,
  isDM: boolean,
): CharacterMessageResult {
  if (!isDM) {
    console.warn(`Player ${senderUid} attempted to reset the movement budget of ${characterId}`);
    return { broadcast: false, save: false };
  }
  const character = state.characters.find((candidate) => candidate.id === characterId);
  if (!character) return { broadcast: false, save: false };
  const spent = (character.movementUsed ?? 0) !== 0 || (character.movementDiagonals ?? 0) !== 0;
  if (!spent) return { broadcast: false, save: false };
  resetMovementBudget(character);
  return { broadcast: true, save: true };
}
