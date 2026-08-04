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
   * Disconnect players that haven't sent a heartbeat, WITHOUT deleting their
   * game state.
   *
   * This used to pass removePlayer/removeTokens, which made a 5-minute lid
   * close delete the player's tokens — and since NPC tokens are owned by the
   * placing DM's uid, a DM timeout took the monsters with it. Worse, players
   * restored from disk at boot all carry stale heartbeats, so the first sweep
   * after a restart wiped every token the restart had just recovered. Now a
   * timeout is exactly a disconnection: close the socket, drop the user from
   * the roster and auth maps, clear selections, broadcast — the player entity
   * and tokens stay, just like a normal disconnect.
   *
   * Only CONNECTED players (in their room's `users` list) are swept: cleanup
   * removes the uid from `users`, so each zombie is disconnected once rather
   * than re-cleaned (and re-broadcast) every 30 seconds forever — and players
   * loaded from disk, who are never in `users` until they authenticate, are
   * never touched at all.
   */
  private checkForTimedOutPlayers(): void {
    const now = Date.now();
    const timedOutPlayers: string[] = [];

    // Find connected players in ANY room who missed the heartbeat window
    for (const roomId of this.container.roomRegistry.listRooms()) {
      const state = this.container.roomRegistry.get(roomId).getState();
      for (const player of state.players) {
        if (!state.users.includes(player.uid)) continue;
        const lastHeartbeat = player.lastHeartbeat || 0;
        if (now - lastHeartbeat > this.HEARTBEAT_TIMEOUT) {
          timedOutPlayers.push(player.uid);
        }
      }
    }

    if (timedOutPlayers.length > 0) {
      console.log(
        `Disconnecting ${timedOutPlayers.length} timed-out players (state kept):`,
        timedOutPlayers,
      );

      for (const uid of timedOutPlayers) {
        // Same cleanup as a normal disconnect, plus closing the zombie socket.
        // Player entity and tokens deliberately survive.
        this.cleanupManager.cleanupPlayer(uid, {
          closeWebSocket: true,
        });
      }
    }
  }
}
