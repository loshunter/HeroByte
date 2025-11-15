// ============================================================================
// BROADCAST SERVICE
// ============================================================================
// Manages debounced broadcasting to WebSocket clients
// Extracted from: apps/server/src/ws/messageRouter.ts

/**
 * Service responsible for managing debounced broadcasting to WebSocket clients.
 *
 * This service batches rapid state changes into a single broadcast operation
 * using a 16ms debounce delay (one frame at 60fps). This prevents flooding
 * clients with excessive updates during high-frequency operations.
 *
 * **Responsibilities:**
 * - Debounce rapid broadcast calls into a single operation
 * - Provide immediate broadcasting when debouncing is not desired
 * - Manage broadcast timer lifecycle
 *
 * **Single Responsibility Principle (SRP):**
 * This service has ONE clear responsibility: manage the timing of broadcasts.
 * It does NOT handle message routing, authorization, or error handling.
 *
 * @example
 * ```typescript
 * const broadcaster = new BroadcastService();
 *
 * // Debounced broadcast (batches rapid calls)
 * broadcaster.broadcast(() => console.log("Broadcasting state"));
 * broadcaster.broadcast(() => console.log("Broadcasting state")); // Resets timer
 *
 * // Only one broadcast happens after 16ms
 *
 * // Immediate broadcast (no debouncing)
 * broadcaster.broadcastImmediate(() => console.log("Immediate broadcast"));
 * ```
 */
export class BroadcastService {
  /**
   * Timer for debouncing broadcasts
   * Null when no broadcast is pending
   */
  private broadcastDebounceTimer: NodeJS.Timeout | null = null;

  /**
   * Broadcast immediately without debouncing.
   *
   * Use this when you need to send state updates immediately,
   * such as during connection establishment or critical state changes.
   *
   * @param callback - Function to execute the actual broadcast operation
   *
   * @example
   * ```typescript
   * broadcaster.broadcastImmediate(() => {
   *   // Send state to all clients immediately
   *   roomService.broadcast(authorizedClients);
   * });
   * ```
   */
  broadcastImmediate(callback: () => void): void {
    callback();
  }

  /**
   * Broadcast with debouncing to batch rapid state changes.
   *
   * Multiple calls within a 16ms window (one frame at 60fps) will be
   * batched into a single broadcast operation. This prevents flooding
   * clients with excessive updates during high-frequency operations
   * like token dragging or rapid drawing.
   *
   * **Behavior:**
   * - First call: Starts a 16ms timer
   * - Subsequent calls within 16ms: Reset the timer
   * - After 16ms of no new calls: Execute the broadcast
   *
   * @param callback - Function to execute the actual broadcast operation
   *
   * @example
   * ```typescript
   * // These 5 rapid calls will result in only 1 broadcast after 16ms
   * broadcaster.broadcast(() => roomService.broadcast(clients));
   * broadcaster.broadcast(() => roomService.broadcast(clients));
   * broadcaster.broadcast(() => roomService.broadcast(clients));
   * broadcaster.broadcast(() => roomService.broadcast(clients));
   * broadcaster.broadcast(() => roomService.broadcast(clients));
   * ```
   */
  broadcast(callback: () => void): void {
    // Clear any existing timer to reset the debounce window
    if (this.broadcastDebounceTimer) {
      clearTimeout(this.broadcastDebounceTimer);
    }

    // Set a new timer that will execute the broadcast after 16ms
    this.broadcastDebounceTimer = setTimeout(() => {
      this.broadcastDebounceTimer = null;
      this.broadcastImmediate(callback);
    }, 16);
  }

  /**
   * Clean up any pending broadcast timers.
   *
   * Call this during shutdown or cleanup to prevent pending broadcasts
   * from executing after the service is no longer needed.
   *
   * @example
   * ```typescript
   * // During server shutdown
   * broadcaster.cleanup();
   * ```
   */
  cleanup(): void {
    if (this.broadcastDebounceTimer) {
      clearTimeout(this.broadcastDebounceTimer);
      this.broadcastDebounceTimer = null;
    }
  }
}
