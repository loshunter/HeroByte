/**
 * DiceMessageHandler
 *
 * Handles all dice rolling messages from clients.
 * Manages dice rolls and roll history.
 *
 * Extracted from: apps/server/src/ws/messageRouter.ts
 * - dice-roll (lines 735-738)
 * - clear-roll-history (lines 740-744)
 *
 * Extraction date: 2025-11-14
 *
 * @module ws/handlers/DiceMessageHandler
 */

import type { RoomState } from "../../domains/room/model.js";
import type { DiceRoll } from "@shared";
import type { DiceService } from "../../domains/dice/service.js";

/**
 * Result of handling a dice message
 */
export interface DiceMessageResult {
  /** Whether a broadcast is needed */
  broadcast: boolean;
  /** Whether state should be saved */
  save: boolean;
}

/**
 * Handler for dice-related messages
 */
export class DiceMessageHandler {
  private diceService: DiceService;

  constructor(diceService: DiceService) {
    this.diceService = diceService;
  }

  /**
   * Handle dice-roll message
   *
   * Adds a dice roll to the roll history.
   *
   * @param state - Current room state
   * @param roll - Dice roll data
   * @returns Result indicating if broadcast/save is needed
   */
  handleDiceRoll(state: RoomState, roll: DiceRoll): DiceMessageResult {
    this.diceService.addRoll(state, roll);
    return { broadcast: true, save: false };
  }

  /**
   * Handle clear-roll-history message
   *
   * Clears all dice rolls from the history.
   *
   * @param state - Current room state
   * @returns Result indicating if broadcast/save is needed
   */
  handleClearRollHistory(state: RoomState): DiceMessageResult {
    this.diceService.clearHistory(state);
    return { broadcast: true, save: false };
  }
}
