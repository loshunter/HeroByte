/**
 * set-initiative-modifier: a character's initiative modifier ALONE — what a
 * restored character file carries. `set-initiative` cannot do it: with no
 * value it CLEARS initiative, and with one it ENTERS the order, writes a
 * manual entry to the public roll log, and (after END COMBAT, which keeps
 * initiatives) starts combat again on that character's turn.
 *
 * The DM, or the character's owner — `set-initiative`'s own rule. It writes
 * nothing else: no initiative, no order, no combat, no log line. The value is
 * bounded to the same range as every other path that stores the modifier
 * (initiativeValidators.ts), and it is not a manual entry, so the table's
 * hand-entry setting does not apply: `roll-initiative` carries a modifier from
 * a player at any table already.
 *
 * Its own module, like movementBudgetMessages.ts: the initiative and character
 * handlers are both at the 350-line guard.
 */

import type { RoomState } from "../../domains/room/model.js";
import type { CharacterMessageResult } from "./CharacterMessageHandler.js";

export function handleSetInitiativeModifier(
  state: RoomState,
  characterId: string,
  senderUid: string,
  initiativeModifier: number,
  isDM: boolean,
): CharacterMessageResult {
  const character = state.characters.find((candidate) => candidate.id === characterId);
  if (!character) return { broadcast: false, save: false };
  if (!isDM && character.ownedByPlayerUID !== senderUid) {
    console.warn(`Player ${senderUid} attempted to set the initiative modifier of ${characterId}`);
    return { broadcast: false, save: false };
  }
  if (character.initiativeModifier === initiativeModifier) return { broadcast: false, save: false };
  character.initiativeModifier = initiativeModifier;
  return { broadcast: true, save: true };
}
