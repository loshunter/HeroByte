// ============================================================================
// DISCONNECTION CLEANUP MANAGER
// ============================================================================
// Centralized cleanup logic for disconnected/timed-out players
// Single responsibility: Clean up player state on disconnection
// Used by: ConnectionHandler (normal disconnect), HeartbeatTimeoutManager (timeout)

import type { WebSocket } from "ws";
import type { RoomService } from "../../domains/room/service.js";
import type { SelectionService } from "../../domains/selection/service.js";

/**
 * Configuration for DisconnectionCleanupManager
 */
export interface DisconnectionCleanupConfig {
  roomService: RoomService;
  selectionService: SelectionService;
  getAuthenticatedClients: () => Set<WebSocket>;
}

/**
 * Options for cleanup behavior
 */
export interface CleanupOptions {
  /**
   * WebSocket reference for race condition check
   * If provided, cleanup only proceeds if this is still the current connection
   */
  ws?: WebSocket;

  /**
   * Close the WebSocket connection (used for timeout)
   * Default: false
   */
  closeWebSocket?: boolean;

  /**
   * Remove player entity from state.players (used for timeout)
   * Default: false
   */
  removePlayer?: boolean;

  /**
   * Remove player tokens from state.tokens (used for timeout)
   * Default: false
   */
  removeTokens?: boolean;
}

/**
 * DisconnectionCleanupManager
 *
 * Centralizes cleanup logic for disconnected/timed-out players.
 * Prevents code duplication between ConnectionHandler and HeartbeatTimeoutManager.
 *
 * RESPONSIBILITIES:
 *
 * Common cleanup (always performed):
 * - Remove from state.users
 * - Clear authenticatedUids
 * - Clear authenticatedSessions
 * - Clear uidToWs
 * - Deselect player selections
 * - Broadcast updated state
 *
 * Optional cleanup (based on options):
 * - Close WebSocket (for timeout)
 * - Remove player entity (for timeout)
 * - Remove player tokens (for timeout)
 *
 * Race condition prevention:
 * - If options.ws is provided, only cleanup if it's still the current connection
 * - Prevents cleanup of replaced connections during reconnection
 *
 * USAGE EXAMPLES:
 *
 * Normal disconnection (ConnectionHandler):
 * ```typescript
 * cleanupManager.cleanupPlayer(uid, { ws });
 * ```
 *
 * Timeout disconnection (HeartbeatTimeoutManager):
 * ```typescript
 * cleanupManager.cleanupPlayer(uid, {
 *   closeWebSocket: true,
 *   removePlayer: true,
 *   removeTokens: true,
 * });
 * ```
 */
export class DisconnectionCleanupManager {
  private config: DisconnectionCleanupConfig;
  private uidToWs: Map<string, WebSocket>;
  private authenticatedUids: Set<string>;
  private authenticatedSessions: Map<string, { roomId: string; authedAt: number }>;

  constructor(
    config: DisconnectionCleanupConfig,
    uidToWs: Map<string, WebSocket>,
    authenticatedUids: Set<string>,
    authenticatedSessions: Map<string, { roomId: string; authedAt: number }>,
  ) {
    this.config = config;
    this.uidToWs = uidToWs;
    this.authenticatedUids = authenticatedUids;
    this.authenticatedSessions = authenticatedSessions;
  }

  /**
   * Clean up all state for a disconnected player
   *
   * Performs cleanup in this order:
   * 1. Race condition check (if ws provided)
   * 2. Close WebSocket (if closeWebSocket option)
   * 3. Remove player entity (if removePlayer option)
   * 4. Remove player tokens (if removeTokens option)
   * 5. Common cleanup (users, auth state, selections)
   * 6. Broadcast updated state
   *
   * @param uid - Player UID to clean up
   * @param options - Cleanup options
   */
  cleanupPlayer(uid: string, options: CleanupOptions = {}): void {
    const state = this.config.roomService.getState();

    // Race condition check: only clean up if this socket is still current
    // This prevents cleanup when an old connection closes during reconnection
    if (options.ws) {
      const currentWs = this.uidToWs.get(uid);
      if (currentWs !== options.ws) {
        console.log(`[WebSocket] Ignoring close event for replaced connection: ${uid}`);
        return;
      }
    }

    // Optional: Close WebSocket (for timeout scenarios)
    // Only close if socket is still open (readyState = 1)
    if (options.closeWebSocket) {
      const socket = this.uidToWs.get(uid);
      if (socket && socket.readyState === 1) {
        socket.close(4000, "Heartbeat timeout");
      }
    }

    // Optional: Remove player entity (for timeout scenarios)
    // Normal disconnection preserves player data for reconnection
    if (options.removePlayer) {
      state.players = state.players.filter((p) => p.uid !== uid);
    }

    // Optional: Remove player tokens (for timeout scenarios)
    // Normal disconnection preserves tokens for reconnection
    if (options.removeTokens) {
      state.tokens = state.tokens.filter((t) => t.owner !== uid);
    }

    // Common cleanup (always performed)
    // Remove user from active users list
    state.users = state.users.filter((u) => u !== uid);

    // Clear WebSocket connection mapping
    this.uidToWs.delete(uid);

    // Clear authentication state
    this.authenticatedUids.delete(uid);
    this.authenticatedSessions.delete(uid);

    // Deselect any objects the player had selected
    this.config.selectionService.deselect(state, uid);

    // Broadcast updated state to all authenticated clients
    this.config.roomService.broadcast(this.config.getAuthenticatedClients(), undefined, {
      reason: "disconnection-cleanup",
    });
  }
}
