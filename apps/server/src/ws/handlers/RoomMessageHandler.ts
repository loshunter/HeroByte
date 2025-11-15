/**
 * RoomMessageHandler
 *
 * Handles room management messages from clients.
 *
 * Extracted from: apps/server/src/ws/messageRouter.ts
 * - load-session (lines 812-822)
 * - set-room-password (lines 751-792)
 *
 * Note: clear-all-tokens is handled by TokenMessageHandler
 *
 * Extraction date: 2025-11-14
 *
 * @module ws/handlers/RoomMessageHandler
 */

import type { RoomState } from "../../domains/room/model.js";
import type { RoomService } from "../../domains/room/service.js";
import type { AuthService } from "../../domains/auth/service.js";
import type { RoomSnapshot, ServerMessage } from "@shared";
import { getRoomSecret } from "../../config/auth.js";

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
 * Callback to send a control message to a specific client
 */
export type SendControlMessage = (targetUid: string, message: ServerMessage) => void;

/**
 * Handler for room management messages
 */
export class RoomMessageHandler {
  private roomService: RoomService;
  private authService: AuthService;
  private sendControlMessage: SendControlMessage;

  constructor(
    roomService: RoomService,
    authService: AuthService,
    sendControlMessage: SendControlMessage,
  ) {
    this.roomService = roomService;
    this.authService = authService;
    this.sendControlMessage = sendControlMessage;
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
    snapshot: RoomSnapshot,
    isDM: boolean,
  ): RoomMessageResult {
    if (!isDM) {
      console.warn(`Non-DM ${senderUid} attempted to load session`);
      return { broadcast: false, save: false };
    }
    this.roomService.loadSnapshot(snapshot);
    return { broadcast: true, save: true };
  }

  /**
   * Handle set-room-password message
   *
   * Updates the room password.
   * Only DMs can update the room password.
   *
   * @param state - Current room state
   * @param senderUid - UID of the sender
   * @param secret - New password (will be trimmed)
   * @returns Result indicating if broadcast/save is needed (always false for password updates)
   */
  handleSetRoomPassword(
    state: RoomState,
    senderUid: string,
    secret: string | undefined,
  ): RoomMessageResult {
    const sender = state.players.find((p) => p.uid === senderUid);
    const isDM = sender?.isDM ?? false;

    if (!isDM) {
      this.sendControlMessage(senderUid, {
        t: "room-password-update-failed",
        reason: "Only Dungeon Masters can update the room password.",
      });
      return { broadcast: false, save: false };
    }

    const nextSecret = secret?.trim() ?? "";
    const defaultSecret = getRoomSecret();
    const isDefaultPassword = nextSecret === defaultSecret;

    // Allow default password to bypass length validation
    if (!isDefaultPassword && (nextSecret.length < 6 || nextSecret.length > 128)) {
      this.sendControlMessage(senderUid, {
        t: "room-password-update-failed",
        reason: "Password must be between 6 and 128 characters.",
      });
      return { broadcast: false, save: false };
    }

    try {
      const summary = this.authService.update(nextSecret);
      this.sendControlMessage(senderUid, {
        t: "room-password-updated",
        updatedAt: summary.updatedAt,
        source: summary.source,
      });
      console.log(`DM ${senderUid} updated the room password.`);
    } catch (error) {
      console.error("Failed to update room password:", error);
      this.sendControlMessage(senderUid, {
        t: "room-password-update-failed",
        reason: "Unable to update password. Check server logs.",
      });
    }

    return { broadcast: false, save: false };
  }
}
