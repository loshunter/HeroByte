/**
 * PlayerMessageHandler
 *
 * Handles all player-related messages from clients.
 * Manages player profile updates (portrait, name), microphone level,
 * HP, and status effects.
 *
 * Extracted from: apps/server/src/ws/messageRouter.ts
 * - portrait (lines 190-195)
 * - rename (lines 197-202)
 * - mic-level (lines 204-208)
 * - set-hp (lines 210-215)
 * - set-status-effects (lines 217-222)
 * - toggle-dm (lines 224-228) - DEPRECATED
 *
 * Extraction date: 2025-11-14
 *
 * @module ws/handlers/PlayerMessageHandler
 */

import type { RoomState } from "@shared";
import type { PlayerService } from "../../domains/player/service.js";
import type { RoomService } from "../../domains/room/service.js";

/**
 * Result of handling a player message
 */
export interface PlayerMessageResult {
  /** Whether a broadcast is needed */
  broadcast: boolean;
  /** Whether state should be saved */
  save: boolean;
}

/**
 * Handler for player-related messages
 */
export class PlayerMessageHandler {
  private playerService: PlayerService;
  private roomService: RoomService;

  constructor(playerService: PlayerService, roomService: RoomService) {
    this.playerService = playerService;
    this.roomService = roomService;
  }

  /**
   * Handle portrait message
   *
   * Sets the player's portrait image.
   *
   * @param state - Room state
   * @param senderUid - UID of player setting portrait
   * @param data - Portrait image data (base64 or URL)
   * @returns Result indicating broadcast/save needs
   */
  handlePortrait(state: RoomState, senderUid: string, data: string): PlayerMessageResult {
    const updated = this.playerService.setPortrait(state, senderUid, data);
    return { broadcast: updated, save: updated };
  }

  /**
   * Handle rename message
   *
   * Renames the player.
   *
   * @param state - Room state
   * @param senderUid - UID of player renaming themselves
   * @param name - New player name
   * @returns Result indicating broadcast/save needs
   */
  handleRename(state: RoomState, senderUid: string, name: string): PlayerMessageResult {
    const updated = this.playerService.rename(state, senderUid, name);
    return { broadcast: updated, save: updated };
  }

  /**
   * Handle mic-level message
   *
   * Sets the player's microphone level (for voice chat visualization).
   * This is ephemeral and does not need to be saved.
   *
   * @param state - Room state
   * @param senderUid - UID of player setting mic level
   * @param level - Microphone level (0-100)
   * @returns Result indicating broadcast/save needs
   */
  handleMicLevel(state: RoomState, senderUid: string, level: number): PlayerMessageResult {
    const updated = this.playerService.setMicLevel(state, senderUid, level);
    return { broadcast: updated, save: false };
  }

  /**
   * Handle set-hp message
   *
   * Sets the player's HP and max HP.
   *
   * @param state - Room state
   * @param senderUid - UID of player setting HP
   * @param hp - Current HP
   * @param maxHp - Maximum HP
   * @returns Result indicating broadcast/save needs
   */
  handleSetHP(state: RoomState, senderUid: string, hp: number, maxHp: number): PlayerMessageResult {
    const updated = this.playerService.setHP(state, senderUid, hp, maxHp);
    return { broadcast: updated, save: updated };
  }

  /**
   * Handle set-status-effects message
   *
   * Sets the player's status effects (e.g., Poisoned, Blinded).
   *
   * @param state - Room state
   * @param senderUid - UID of player setting status effects
   * @param effects - Array of status effect names
   * @returns Result indicating broadcast/save needs
   */
  handleSetStatusEffects(
    state: RoomState,
    senderUid: string,
    effects: string[],
  ): PlayerMessageResult {
    const updated = this.playerService.setStatusEffects(state, senderUid, effects);
    return { broadcast: updated, save: updated };
  }

  /**
   * Handle toggle-dm message (DEPRECATED)
   *
   * This action is replaced by the elevate-to-dm flow.
   * Kept for backwards compatibility but should not be used.
   *
   * @param senderUid - UID of player sending the message
   * @returns Result indicating no action taken
   */
  handleToggleDM(senderUid: string): PlayerMessageResult {
    console.warn(`toggle-dm message from ${senderUid} ignored - use elevate-to-dm instead`);
    return { broadcast: false, save: false };
  }
}
