/**
 * RoomMessageHandler
 *
 * Handles session loading message from clients.
 *
 * Extracted from: apps/server/src/ws/messageRouter.ts
 * - load-session (lines 812-822)
 *
 * Note: set-room-password is NOT extracted (too complex with auth/validation)
 * Note: clear-all-tokens is handled by TokenMessageHandler
 *
 * Extraction date: 2025-11-14
 *
 * @module ws/handlers/RoomMessageHandler
 */

import type { RoomState } from "../model.js";
import type { RoomService } from "../../domains/room/service.js";

/**
 * Result of handling a room message
 */
export interface RoomMessageResult {
  /** Whether a broadcast is needed */
  broadcast: boolean;
  /** Whether state should be saved */
  save: boolean;
}

/**
 * Handler for room management messages
 */
export class RoomMessageHandler {
  private roomService: RoomService;

  constructor(roomService: RoomService) {
    this.roomService = roomService;
  }

  /**
   * Handle load-session message
   *
   * Loads a session snapshot.
   * Only DMs can load sessions.
   *
   * @param state - Current room state
   * @param senderUid - UID of the sender
   * @param snapshot - Session snapshot data
   * @param isDM - Whether sender is DM
   * @returns Result indicating if broadcast/save is needed
   */
  handleLoadSession(
    state: RoomState,
    senderUid: string,
    snapshot: any,
    isDM: boolean,
  ): RoomMessageResult {
    if (!isDM) {
      console.warn(`Non-DM ${senderUid} attempted to load session`);
      return { broadcast: false, save: false };
    }
    this.roomService.loadSnapshot(snapshot);
    return { broadcast: true, save: true };
  }
}
