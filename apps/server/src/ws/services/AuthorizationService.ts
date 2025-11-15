import type { RoomState } from "../../domains/room/model.js";

/**
 * Authorization Service
 *
 * Centralized authorization logic for WebSocket message routing.
 * Extracted from MessageRouter.ts (lines 135-139) to follow Single Responsibility Principle.
 *
 * Responsibilities:
 * - Check if a user has DM (Dungeon Master) privileges
 * - Provide consistent authorization decisions across the application
 *
 * @see apps/server/src/ws/__tests__/characterization/authorization.characterization.test.ts
 */
export class AuthorizationService {
  /**
   * Check if a player has DM privileges
   *
   * @param state - Current room state containing player list
   * @param senderUid - UID of the player to check
   * @returns true if player has isDM flag set, false otherwise
   *
   * @remarks
   * - Returns false if player not found in state.players
   * - Returns false if isDM field is undefined or missing
   * - Uses nullish coalescing (??) to handle undefined/null isDM values
   *
   * Original implementation: apps/server/src/ws/messageRouter.ts:135-139
   */
  isDM(state: RoomState, senderUid: string): boolean {
    const player = state.players.find((p) => p.uid === senderUid);
    return player?.isDM ?? false;
  }

  /**
   * Check if a message type requires DM privileges (router-level early return pattern)
   *
   * @param messageType - The client message type to check
   * @returns true if message type requires DM privileges at router level
   *
   * @remarks
   * These message types use "early return" pattern in messageRouter - they block
   * non-DM users BEFORE calling handlers.
   *
   * Message types with early return (9 total):
   * - create-character (line 274)
   * - create-npc (line 290)
   * - update-npc (line 307)
   * - delete-npc (line 324)
   * - place-npc-token (line 335)
   * - create-prop (line 417)
   * - update-prop (line 436)
   * - delete-prop (line 452)
   * - clear-all-tokens (line 760)
   *
   * NOTE: Other message types may require DM privileges but enforce this INSIDE
   * the handler (not at router level). See characterization tests for details.
   */
  requiresDMPrivileges(messageType: string): boolean {
    const dmOnlyMessageTypes = new Set([
      "create-character",
      "create-npc",
      "update-npc",
      "delete-npc",
      "place-npc-token",
      "create-prop",
      "update-prop",
      "delete-prop",
      "clear-all-tokens",
    ]);

    return dmOnlyMessageTypes.has(messageType);
  }

  /**
   * Check if a user is authorized to perform a DM-only action
   *
   * Convenience method that combines isDM check with message type check.
   *
   * @param state - Current room state
   * @param senderUid - UID of the player attempting the action
   * @param messageType - The message type being attempted
   * @returns true if user is authorized (either not DM-only or user is DM)
   *
   * @example
   * ```typescript
   * if (!authService.isAuthorized(state, senderUid, message.t)) {
   *   console.warn(`Non-DM ${senderUid} attempted ${message.t}`);
   *   return; // Early return
   * }
   * ```
   */
  isAuthorized(state: RoomState, senderUid: string, messageType: string): boolean {
    // If message doesn't require DM privileges, always authorized
    if (!this.requiresDMPrivileges(messageType)) {
      return true;
    }

    // If message requires DM, check if user has DM privileges
    return this.isDM(state, senderUid);
  }
}
