/**
 * InitiativeMessageHandler
 *
 * Handles all initiative and combat-related messages from clients.
 * Manages combat tracker state including initiative rolls, turn order,
 * and combat lifecycle.
 *
 * Extracted from: apps/server/src/ws/messageRouter.ts
 * - set-initiative (lines 318-349)
 * - start-combat (lines 351-366)
 * - end-combat (lines 368-379)
 * - next-turn (lines 382-399)
 * - previous-turn (lines 401-418)
 * - clear-all-initiative (lines 420-426)
 *
 * Extraction date: 2025-11-14
 *
 * @module ws/handlers/InitiativeMessageHandler
 */

import type {} from "@shared";
import type { RoomState } from "../../domains/room/model.js";
import type { CharacterService } from "../../domains/character/service.js";
import type { RoomService } from "../../domains/room/service.js";

/**
 * Result of handling an initiative message
 */
export interface InitiativeMessageResult {
  /** Whether a broadcast is needed */
  broadcast: boolean;
  /** Whether state should be saved */
  save: boolean;
}

/**
 * Handler for initiative and combat-related messages
 */
export class InitiativeMessageHandler {
  private characterService: CharacterService;
  private roomService: RoomService;

  constructor(characterService: CharacterService, roomService: RoomService) {
    this.characterService = characterService;
    this.roomService = roomService;
  }

  /**
   * Handle set-initiative message
   *
   * Sets the initiative value and modifier for a character.
   * Players can only set initiative for their own characters.
   * DMs can set initiative for any character.
   *
   * @param state - Current room state
   * @param characterId - ID of the character
   * @param senderUid - UID of the sender
   * @param initiative - Initiative roll value
   * @param initiativeModifier - Initiative modifier
   * @param isDM - Whether sender is DM
   * @returns Result indicating if broadcast/save is needed
   */
  handleSetInitiative(
    state: RoomState,
    characterId: string,
    senderUid: string,
    initiative: number,
    initiativeModifier: number,
    isDM: boolean,
  ): InitiativeMessageResult {
    // Check if sender owns the character or is DM
    const character = this.characterService.findCharacter(state, characterId);
    if (!character) {
      console.warn(`Character ${characterId} not found`);
      return { broadcast: false, save: false };
    }

    const canModify = isDM || this.characterService.canControlCharacter(character, senderUid);
    if (!canModify) {
      console.warn(`Player ${senderUid} attempted to set initiative for character they don't own`);
      return { broadcast: false, save: false };
    }

    console.log(
      `[Server] Setting initiative for ${character.name} (${characterId}): initiative=${initiative}, modifier=${initiativeModifier}`,
    );

    if (this.characterService.setInitiative(state, characterId, initiative, initiativeModifier)) {
      console.log(`[Server] Broadcasting updated initiative for ${character.name}`);
      return { broadcast: true, save: true };
    }

    return { broadcast: false, save: false };
  }

  /**
   * Handle start-combat message
   *
   * Activates combat mode and sets the first character in initiative order
   * as the current turn. Only DMs can start combat.
   *
   * @param state - Current room state
   * @param senderUid - UID of the sender
   * @param isDM - Whether sender is DM
   * @returns Result indicating if broadcast/save is needed
   */
  handleStartCombat(state: RoomState, senderUid: string, isDM: boolean): InitiativeMessageResult {
    if (!isDM) {
      console.warn(`Non-DM ${senderUid} attempted to start combat`);
      return { broadcast: false, save: false };
    }

    state.combatActive = true;
    // Set first character with initiative as current turn
    const charactersInOrder = this.characterService.getCharactersInInitiativeOrder(state);
    if (charactersInOrder.length > 0) {
      state.currentTurnCharacterId = charactersInOrder[0].id;
    }
    console.log(`Combat started by ${senderUid}`);

    return { broadcast: true, save: true };
  }

  /**
   * Handle end-combat message
   *
   * Deactivates combat mode and clears all initiative values.
   * Only DMs can end combat.
   *
   * @param state - Current room state
   * @param senderUid - UID of the sender
   * @param isDM - Whether sender is DM
   * @returns Result indicating if broadcast/save is needed
   */
  handleEndCombat(state: RoomState, senderUid: string, isDM: boolean): InitiativeMessageResult {
    if (!isDM) {
      console.warn(`Non-DM ${senderUid} attempted to end combat`);
      return { broadcast: false, save: false };
    }

    state.combatActive = false;
    state.currentTurnCharacterId = undefined;
    this.characterService.clearAllInitiative(state);
    console.log(`Combat ended by ${senderUid}`);

    return { broadcast: true, save: true };
  }

  /**
   * Handle next-turn message
   *
   * Advances to the next character in initiative order.
   * Wraps around to the first character if at the end.
   * Only DMs can advance turns.
   *
   * @param state - Current room state
   * @param senderUid - UID of the sender
   * @param isDM - Whether sender is DM
   * @returns Result indicating if broadcast/save is needed
   */
  handleNextTurn(state: RoomState, senderUid: string, isDM: boolean): InitiativeMessageResult {
    if (!isDM) {
      console.warn(`Non-DM ${senderUid} attempted to advance turn`);
      return { broadcast: false, save: false };
    }

    const charactersInOrder = this.characterService.getCharactersInInitiativeOrder(state);
    if (charactersInOrder.length === 0) {
      return { broadcast: false, save: false };
    }

    const currentIndex = charactersInOrder.findIndex((c) => c.id === state.currentTurnCharacterId);
    const nextIndex = (currentIndex + 1) % charactersInOrder.length;
    state.currentTurnCharacterId = charactersInOrder[nextIndex].id;
    console.log(`Turn advanced to ${charactersInOrder[nextIndex].name}`);

    return { broadcast: true, save: true };
  }

  /**
   * Handle previous-turn message
   *
   * Goes back to the previous character in initiative order.
   * Wraps around to the last character if at the beginning.
   * Only DMs can go back turns.
   *
   * @param state - Current room state
   * @param senderUid - UID of the sender
   * @param isDM - Whether sender is DM
   * @returns Result indicating if broadcast/save is needed
   */
  handlePreviousTurn(state: RoomState, senderUid: string, isDM: boolean): InitiativeMessageResult {
    if (!isDM) {
      console.warn(`Non-DM ${senderUid} attempted to go back turn`);
      return { broadcast: false, save: false };
    }

    const charactersInOrder = this.characterService.getCharactersInInitiativeOrder(state);
    if (charactersInOrder.length === 0) {
      return { broadcast: false, save: false };
    }

    const currentIndex = charactersInOrder.findIndex((c) => c.id === state.currentTurnCharacterId);
    const prevIndex = currentIndex <= 0 ? charactersInOrder.length - 1 : currentIndex - 1;
    state.currentTurnCharacterId = charactersInOrder[prevIndex].id;
    console.log(`Turn moved back to ${charactersInOrder[prevIndex].name}`);

    return { broadcast: true, save: true };
  }

  /**
   * Handle clear-all-initiative message
   *
   * Clears initiative values for all characters.
   * Only DMs can clear all initiative.
   *
   * @param state - Current room state
   * @param senderUid - UID of the sender
   * @param isDM - Whether sender is DM
   * @returns Result indicating if broadcast/save is needed
   */
  handleClearAllInitiative(
    state: RoomState,
    senderUid: string,
    isDM: boolean,
  ): InitiativeMessageResult {
    if (!isDM) {
      console.warn(`Non-DM ${senderUid} attempted to clear all initiative`);
      return { broadcast: false, save: false };
    }

    this.characterService.clearAllInitiative(state);

    return { broadcast: true, save: true };
  }
}
