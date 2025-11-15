/**
 * HeartbeatHandler
 *
 * Handles client heartbeat messages to maintain connection health.
 * Updates player lastHeartbeat timestamps to detect timeouts.
 *
 * Extracted from: apps/server/src/ws/messageRouter.ts (lines 829-838)
 * Extraction date: 2025-11-14
 *
 * @module ws/handlers/HeartbeatHandler
 */

import type { RoomState } from "@shared";

/**
 * Handler for client heartbeat messages
 */
export class HeartbeatHandler {
  /**
   * Handle heartbeat message from a client
   *
   * Updates the player's lastHeartbeat timestamp to the current time.
   * This is used to detect client disconnections and timeout inactive players.
   *
   * @param state - Room state containing players
   * @param senderUid - UID of the player sending heartbeat
   * @returns true if broadcast is needed (always true to keep connection alive)
   *
   * @example
   * ```typescript
   * const handler = new HeartbeatHandler();
   * const needsBroadcast = handler.handleHeartbeat(state, "player-123");
   * if (needsBroadcast) {
   *   broadcast();
   * }
   * ```
   */
  handleHeartbeat(state: RoomState, senderUid: string): boolean {
    const player = state.players.find((p) => p.uid === senderUid);
    if (player) {
      player.lastHeartbeat = Date.now();
    }
    console.log(`[DEBUG] Heartbeat received from ${senderUid}`);

    // Always broadcast to keep client connection alive (prevents heartbeat timeout)
    return true;
  }
}
