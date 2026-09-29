/**
 * set-character-owner: the DM moves a player character — and its token — to
 * another player's seat (U7's Token settings, “ownership where allowed”).
 *
 * DM-only: ownership decides who may move the token, whose fog it lights and
 * whose Party row the character is. Player characters only, by the owner's
 * decision (2026-09-29): handing an NPC to a player would change what fog and
 * HP redaction show them. The new owner must hold a seat at the table. The
 * token follows the character, so the fog, the move permission and the scene
 * graph (rebuilt on the broadcast) all agree with the new seat.
 *
 * Its own module, like movementBudgetMessages.ts: the character handler is at
 * the 350-line guard.
 */

import type { RoomState } from "../../domains/room/model.js";
import type { CharacterMessageResult } from "./CharacterMessageHandler.js";

const NO_CHANGE: CharacterMessageResult = { broadcast: false, save: false };

export function handleSetCharacterOwner(
  state: RoomState,
  characterId: string,
  ownerUid: string,
  senderUid: string,
  isDM: boolean,
): CharacterMessageResult {
  if (!isDM) {
    console.warn(`Player ${senderUid} attempted to change the owner of ${characterId}`);
    return NO_CHANGE;
  }
  const character = state.characters.find((candidate) => candidate.id === characterId);
  if (!character || character.type !== "pc") return NO_CHANGE;
  if (!state.players.some((player) => player.uid === ownerUid)) return NO_CHANGE;
  if (character.ownedByPlayerUID === ownerUid) return NO_CHANGE;

  character.ownedByPlayerUID = ownerUid;
  const token = character.tokenId
    ? state.tokens.find((candidate) => candidate.id === character.tokenId)
    : undefined;
  if (token) token.owner = ownerUid;
  return { broadcast: true, save: true };
}
