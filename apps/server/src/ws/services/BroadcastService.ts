// ============================================================================
// BROADCAST SERVICE
// ============================================================================
// Manages debounced broadcasting to WebSocket clients
// Extracted from: apps/server/src/ws/messageRouter.ts

/** Trailing debounce: one frame at 60fps. */
const DEBOUNCE_MS = 16;

/**
 * The longest a pending broadcast may wait, counted from its first call. The
 * trailing debounce alone resets on every call, so calls arriving under 16 ms
 * apart (one mic meter at 120 Hz, two at 60 Hz) postponed the room's broadcast
 * for as long as they kept coming, and nobody received any state meanwhile.
 */
const MAX_WAIT_MS = 50;

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
   * Timer capping how long a pending broadcast may wait (MAX_WAIT_MS)
   * Set by the first call of a batch and never reset by later ones
   */
  private broadcastMaxWaitTimer: NodeJS.Timeout | null = null;

  /** The latest callback of the pending batch: the one a flush runs */
  private pendingCallback: (() => void) | null = null;

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
   * - First call: Starts a 16ms timer, and a 50ms cap that later calls never reset
   * - Subsequent calls within 16ms: Reset the 16ms timer
   * - After 16ms of no new calls, or 50ms after the first: Execute the latest callback
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
    this.pendingCallback = callback;

    // Clear any existing timer to reset the debounce window
    if (this.broadcastDebounceTimer) {
      clearTimeout(this.broadcastDebounceTimer);
    }

    // Set a new timer that will execute the broadcast after 16ms
    this.broadcastDebounceTimer = setTimeout(() => this.flush(), DEBOUNCE_MS);

    // The cap starts with the batch and is not reset, so a steady stream of
    // calls still flushes at least every MAX_WAIT_MS
    if (!this.broadcastMaxWaitTimer) {
      this.broadcastMaxWaitTimer = setTimeout(() => this.flush(), MAX_WAIT_MS);
    }
  }

  /** Run the pending batch's latest callback once, whichever timer fired */
  private flush(): void {
    const callback = this.pendingCallback;
    this.cleanup();
    if (callback) {
      this.broadcastImmediate(callback);
    }
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
    if (this.broadcastMaxWaitTimer) {
      clearTimeout(this.broadcastMaxWaitTimer);
      this.broadcastMaxWaitTimer = null;
    }
    this.pendingCallback = null;
  }
}
