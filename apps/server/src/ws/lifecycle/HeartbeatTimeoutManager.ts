// ============================================================================
// HEARTBEAT TIMEOUT MANAGER
// ============================================================================
// Manages heartbeat timeout checking and player cleanup
// Single responsibility: Monitor and remove timed-out players

import type { Container } from "../../container.js";

/**
 * Heartbeat timeout manager
 * Periodically checks for players that haven't sent heartbeat
 * and removes them from the game state
 */
export class HeartbeatTimeoutManager {
  private container: Container;
  private timeoutCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_TIMEOUT = 5 * 60 * 1000; // 5 minutes without heartbeat before timeout
  private readonly CHECK_INTERVAL = 30000; // Check every 30 seconds

  constructor(container: Container) {
    this.container = container;
  }

  /**
   * Start periodic check for timed-out players
   * Runs every 30 seconds to identify and remove players who haven't
   * sent a heartbeat within the timeout window (5 minutes)
   */
  start(): void {
    // Check every 30 seconds for timed-out players
    this.timeoutCheckInterval = setInterval(() => {
      this.checkForTimedOutPlayers();
    }, this.CHECK_INTERVAL);
  }

  /**
   * Stop the heartbeat timeout checker
   * Clears the interval to prevent further timeout checks
   */
  stop(): void {
    if (this.timeoutCheckInterval) {
      clearInterval(this.timeoutCheckInterval);
      this.timeoutCheckInterval = null;
    }
  }

  /**
   * Check for and remove players that haven't sent heartbeat
   * Identifies players whose last heartbeat exceeds the timeout threshold
   * and performs complete cleanup of their game state:
   * - Removes player entity
   * - Removes their tokens
   * - Removes from users list
   * - Cleans up WebSocket connection
   * - Clears authentication state
   * - Clears their selections
   * - Broadcasts updated state to remaining clients
   */
  private checkForTimedOutPlayers(): void {
    const state = this.container.roomService.getState();
    const now = Date.now();
    const timedOutPlayers: string[] = [];

    // Find players who haven't sent heartbeat in timeout window
    for (const player of state.players) {
      const lastHeartbeat = player.lastHeartbeat || 0;
      if (now - lastHeartbeat > this.HEARTBEAT_TIMEOUT) {
        timedOutPlayers.push(player.uid);
      }
    }

    // Remove timed out players and their tokens
    if (timedOutPlayers.length > 0) {
      console.log(`Removing ${timedOutPlayers.length} timed-out players:`, timedOutPlayers);

      for (const uid of timedOutPlayers) {
        const socket = this.container.uidToWs.get(uid);
        if (socket && socket.readyState === 1) {
          socket.close(4000, "Heartbeat timeout");
        }
        // Remove player
        state.players = state.players.filter((p) => p.uid !== uid);
        // Remove their token
        state.tokens = state.tokens.filter((t) => t.owner !== uid);
        // Remove from users list
        state.users = state.users.filter((u) => u !== uid);
        // Clean up WebSocket connection map
        this.container.uidToWs.delete(uid);
        this.container.authenticatedUids.delete(uid);
        this.container.authenticatedSessions.delete(uid);
        this.container.selectionService.deselect(state, uid);
      }

      // Broadcast updated state
      this.container.roomService.broadcast(this.container.getAuthenticatedClients());
    }
  }
}
