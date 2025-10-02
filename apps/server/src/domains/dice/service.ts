// ============================================================================
// DICE DOMAIN - SERVICE
// ============================================================================
// Handles dice rolling and roll history

import type { DiceRoll } from "@shared";
import type { RoomState } from "../room/model.js";

/**
 * Dice service - manages dice rolls and history
 */
export class DiceService {
  private readonly MAX_ROLLS = 100;

  /**
   * Add a dice roll to history
   */
  addRoll(state: RoomState, roll: DiceRoll): void {
    state.diceRolls.push(roll);

    // Keep only last MAX_ROLLS
    if (state.diceRolls.length > this.MAX_ROLLS) {
      state.diceRolls = state.diceRolls.slice(-this.MAX_ROLLS);
    }
  }

  /**
   * Clear all dice roll history
   */
  clearHistory(state: RoomState): void {
    state.diceRolls = [];
  }

  /**
   * Get roll history
   */
  getHistory(state: RoomState): DiceRoll[] {
    return state.diceRolls;
  }
}
