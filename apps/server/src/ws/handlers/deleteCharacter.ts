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
import {
  isTokenLocked,
  isTokenLockedAnywhere,
  type LockRefusal,
} from "../../domains/room/locking/pieceLock.js";

export interface DeleteCharacterDeps {
  characterService: CharacterService;
  tokenService: TokenService;
  selectionService: SelectionService;
}

/**
 * A character whose token is locked is deleted by no one, the DM included, until the
 * token is unlocked: the delete would take the locked token with it — on the table, or
 * parked with another map, where it would be dropped when the party came back. The
 * refusal the delete handlers return, or undefined when the character may go.
 */
export function lockedTokenRefusal(state: RoomState, characterId: string): LockRefusal | undefined {
  const tokenId = state.characters.find((c) => c.id === characterId)?.tokenId;
  return tokenId && isTokenLockedAnywhere(state, tokenId)
    ? { ids: [`token:${tokenId}`] }
    : undefined;
}

/**
 * Remove a character with its linked token and any selection of that token,
 * passing the turn to its successor if it held one. A locked token is never
 * deleted: by default the whole delete is refused (callers check
 * lockedTokenRefusal first); `keepLockedToken` (REMOVE's sweep) removes the
 * character and leaves its locked token on the map.
 *
 * @returns the removed character, or undefined when there was none (or it was refused)
 */
export function deleteCharacterKeepingTurn(
  deps: DeleteCharacterDeps,
  state: RoomState,
  characterId: string,
  options: { keepLockedToken?: boolean } = {},
): Character | undefined {
  if (!options.keepLockedToken && lockedTokenRefusal(state, characterId)) return undefined;
  const orderBefore = deps.characterService.getCharactersInInitiativeOrder(state);
  const removed = deps.characterService.deleteCharacter(state, characterId);
  if (!removed) return undefined;
  if (removed.tokenId && !isTokenLocked(state, removed.tokenId)) {
    deps.tokenService.forceDeleteToken(state, removed.tokenId);
    deps.selectionService.removeObject(state, removed.tokenId);
  }
  leaveOrderBudget(state, removed, orderBefore);
  return removed;
}
