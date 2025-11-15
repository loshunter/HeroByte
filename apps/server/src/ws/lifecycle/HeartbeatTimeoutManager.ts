// ============================================================================
// HEARTBEAT TIMEOUT MANAGER
// ============================================================================
// Manages heartbeat timeout checking and player cleanup
// Single responsibility: Monitor and remove timed-out players

import type { Container } from "../../container.js";
import type { DisconnectionCleanupManager } from "./DisconnectionCleanupManager.js";

/**
 * Heartbeat timeout manager
 * Periodically checks for players that haven't sent heartbeat
 * and removes them from the game state
 */
export class HeartbeatTimeoutManager {
  private container: Container;
  private cleanupManager: DisconnectionCleanupManager;
  private timeoutCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_TIMEOUT = 5 * 60 * 1000; // 5 minutes without heartbeat before timeout
  private readonly CHECK_INTERVAL = 30000; // Check every 30 seconds

  constructor(container: Container, cleanupManager: DisconnectionCleanupManager) {
    this.container = container;
    this.cleanupManager = cleanupManager;
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
        // Delegate cleanup to DisconnectionCleanupManager
        // Use timeout-specific options: close WebSocket, remove player/tokens
        this.cleanupManager.cleanupPlayer(uid, {
          closeWebSocket: true,
          removePlayer: true,
          removeTokens: true,
        });
      }
    }
  }
}
