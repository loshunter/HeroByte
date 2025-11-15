/**
 * HeartbeatHandler
 *
 * Handles client heartbeat messages to maintain connection health.
 * Updates player lastHeartbeat timestamps to detect timeouts.
 *
 * Extracted from: apps/server/src/ws/messageRouter.ts (lines 829-838)
 * Extraction date: 2025-11-14
 * Refactored: 2025-11-15 (Week 8: Handler Pattern Standardization)
 *
 * @module ws/handlers/HeartbeatHandler
 */

import type {} from "@shared";
import type { RoomState } from "../../domains/room/model.js";

/**
 * Result object returned by heartbeat handler methods
 */
export interface HeartbeatHandlerResult {
  broadcast: boolean;
  save?: boolean;
}

/**
 * Handler for client heartbeat messages
 *
 * **Week 8 Refactoring:**
 * - Changed return type from `boolean` to `{ broadcast: boolean, save?: boolean }`
 * - Now follows the standard RouteResultHandler pattern used by all other handlers
 * - Ensures consistent message handling across the entire messageRouter
 *
 * **Pattern Consistency:**
 * Before Week 8: `if (handler.handleHeartbeat(...)) this.broadcast()`
 * After Week 8: `this.routeResultHandler.handleResult(handler.handleHeartbeat(...))`
 */
export class HeartbeatHandler {
  /**
   * Handle heartbeat message from a client
   *
   * Updates the player's lastHeartbeat timestamp to the current time.
   * This is used to detect client disconnections and timeout inactive players.
   *
   * **Week 8 Change:**
   * Now returns a result object `{ broadcast: true }` instead of `boolean`,
   * following the standard pattern used by all other message handlers.
   *
   * @param state - Room state containing players
   * @param senderUid - UID of the player sending heartbeat
   * @returns Result object indicating broadcast is needed (always true to keep connection alive)
   *
   * @example
   * ```typescript
   * const handler = new HeartbeatHandler();
   * const result = handler.handleHeartbeat(state, "player-123");
   * routeResultHandler.handleResult(result); // Uses RouteResultHandler pattern
   * ```
   */
  handleHeartbeat(state: RoomState, senderUid: string): HeartbeatHandlerResult {
    const player = state.players.find((p) => p.uid === senderUid);
    if (player) {
      player.lastHeartbeat = Date.now();
    }
    console.log(`[DEBUG] Heartbeat received from ${senderUid}`);

    // Always broadcast to keep client connection alive (prevents heartbeat timeout)
    return { broadcast: true };
  }
}
