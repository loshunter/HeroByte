/**
 * applyInitiative
 *
 * The one writer of an initiative value, shared by the two paths that produce
 * one: `InitiativeMessageHandler.handleSetInitiative` (entered by hand) and
 * `InitiativeRollHandler.handleRollInitiative` (rolled by the server).
 *
 * It exists as its own module because those two handlers live in separate
 * files — `InitiativeMessageHandler.ts` has no room left under the 350-LOC
 * guard — and a copy in each is exactly how the auto-start rules would drift
 * apart. Behaviour is unchanged from the inline version that preceded it.
 *
 * @module ws/handlers/applyInitiative
 */

import type { RoomState } from "../../domains/room/model.js";
import type { CharacterService } from "../../domains/character/service.js";

/**
 * Store an initiative value and bring combat into a consistent state.
 *
 * @returns true when the value was stored
 */
export function applyInitiative(
  characterService: CharacterService,
  state: RoomState,
  characterId: string,
  initiative: number,
  modifier: number,
): boolean {
  if (!characterService.setInitiative(state, characterId, initiative, modifier)) {
    return false;
  }

  // Auto-start combat if not already active and this is the first initiative roll
  if (!state.combatActive) {
    state.combatActive = true;
    state.currentTurnCharacterId = characterId;
  }
  // If combat is active but no turn is set, set the first character with
  // initiative as current turn
  else if (!state.currentTurnCharacterId) {
    const charactersInOrder = characterService.getCharactersInInitiativeOrder(state);
    if (charactersInOrder.length > 0) {
      state.currentTurnCharacterId = charactersInOrder[0].id;
    }
  }

  return true;
}
