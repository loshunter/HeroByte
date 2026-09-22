// ============================================================================
// DELETE CHARACTER — one road out for a PC or an NPC, the turn included
// ============================================================================
// Both delete handlers (`delete-player-character` for a player or the DM,
// `delete-npc` for the DM) and the DM's `remove-player` sweep take the same
// three steps — drop the character, its linked token, any selection of that
// token — and none of them used to touch the turn. A deleted combatant that
// held the turn left `currentTurnCharacterId` pointing at nothing, and the
// next NEXT landed on the top of the order with a round counted: everyone
// behind the departed one lost that round's turn. `leaveOrderBudget`
// (movementBudgetReset.ts) is the rule; this reads the order BEFORE the
// character goes so the rule can find its successor.

import type { Character } from "@herobyte/shared";
import type { RoomState } from "../../domains/room/model.js";
import type { CharacterService } from "../../domains/character/service.js";
import type { TokenService } from "../../domains/token/service.js";
import type { SelectionService } from "../../domains/selection/service.js";
import { leaveOrderBudget } from "../../domains/room/transform/movementBudgetReset.js";

export interface DeleteCharacterDeps {
  characterService: CharacterService;
  tokenService: TokenService;
  selectionService: SelectionService;
}

/**
 * Remove a character with its linked token and any selection of that token,
 * passing the turn to its successor if it held one.
 *
 * @returns the removed character, or undefined when there was none
 */
export function deleteCharacterKeepingTurn(
  deps: DeleteCharacterDeps,
  state: RoomState,
  characterId: string,
): Character | undefined {
  const orderBefore = deps.characterService.getCharactersInInitiativeOrder(state);
  const removed = deps.characterService.deleteCharacter(state, characterId);
  if (!removed) return undefined;
  if (removed.tokenId) {
    deps.tokenService.forceDeleteToken(state, removed.tokenId);
    deps.selectionService.removeObject(state, removed.tokenId);
  }
  leaveOrderBudget(state, removed, orderBefore);
  return removed;
}
