/**
 * HeartbeatManager - Manages heartbeat timing and timeout detection
 *
 * RESPONSIBILITIES:
 * 1. Send heartbeat messages at regular intervals
 * 2. Track last message time (any message counts as "alive")
 * 3. Detect heartbeat timeout (no message in 2x interval)
 * 4. Trigger timeout callback when timeout detected
 * 5. Only send heartbeats when authenticated
 * 6. Only timeout when authenticated
 * 7. Clean up timers on stop
 *
 * EXTRACTED FROM: apps/client/src/services/websocket.ts
 * - startHeartbeat() (lines 278-304)
 * - stopHeartbeat() (lines 306-311)
 * - lastPongTime tracking (line 78, line 224)
 * - heartbeatTimer management (line 76)
 *
 * INTEGRATION:
 * - start() called in onopen handler
 * - stop() called in cleanup()
 * - recordMessage() called in handleMessage()
 * - checkHeartbeat() called in heartbeat timer interval
 *
 * ============================================================================
 * Part of Phase 2, Item 4 - CLIENT_WEBSOCKET_PLAN.md
 * ============================================================================
 */

import { AuthState } from "./AuthenticationManager";

/**
 * Configuration for HeartbeatManager
 */
export interface HeartbeatManagerConfig {
  /**
   * Interval in milliseconds between heartbeat messages
   * Default: 25000 (25 seconds, matches server)
   */
  heartbeatInterval: number;

  /**
   * Callback invoked when heartbeat timeout is detected
   * (no message received in 2x heartbeat interval)
   */
  onTimeout: () => void;

  /**
   * Callback to get the current authentication state
   * Used to determine if heartbeat should be sent or timeout should be checked
   */
  getAuthState?: () => AuthState;
}

/**
 * Manages WebSocket heartbeat timing and timeout detection
 *
 * The HeartbeatManager is responsible for:
 * - Sending periodic heartbeat messages to keep the connection alive
 * - Tracking when messages are received (any message resets timeout)
 * - Detecting when the connection has timed out (no message in 2x interval)
 * - Only operating when authenticated (no heartbeat/timeout when unauthenticated)
 *
 * @example
 * ```typescript
 * const heartbeat = new HeartbeatManager({
 *   heartbeatInterval: 25000,
 *   onTimeout: () => reconnect()
 * });
 *
 * // When WebSocket connects
 * heartbeat.start(ws);
 *
 * // When any message received
 * heartbeat.recordMessage();
 *
 * // In heartbeat interval callback
 * heartbeat.checkHeartbeat(authState);
 *
 * // When disconnecting
 * heartbeat.stop();
 * ```
 */
export class HeartbeatManager {
  private config: HeartbeatManagerConfig;
  private heartbeatTimer: number | null = null;
  private lastPongTime: number = Date.now();
  private ws: WebSocket | null = null;

  constructor(config: HeartbeatManagerConfig) {
    this.config = config;
  }

  /**
   * Start the heartbeat timer
   *
   * This should be called when the WebSocket connection is established.
   * Resets the last message time and starts the heartbeat interval.
   *
   * If getAuthState callback is provided in config, the interval will
   * automatically call checkHeartbeat(). Otherwise, the caller must
   * call checkHeartbeat() manually.
   *
   * @param ws - The WebSocket instance to use for sending heartbeats
   */
  start(ws: WebSocket): void {
    this.stop(); // Stop any existing timer
    this.ws = ws;
    this.lastPongTime = Date.now();

    this.heartbeatTimer = window.setInterval(() => {
      // Only auto-call checkHeartbeat if getAuthState callback is provided
      if (this.config.getAuthState) {
        const authState = this.config.getAuthState();
        this.checkHeartbeat(authState);
      }
      // Otherwise, the interval just ticks and the caller must call checkHeartbeat() manually
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop the heartbeat timer
   *
   * This should be called when the WebSocket connection is closed
   * or when cleaning up the connection.
   */
  stop(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.ws = null;
  }

  /**
   * Record that a message was received
   *
   * This should be called whenever ANY message is received from the server.
   * Any message counts as proof that the connection is alive, so this
   * resets the timeout timer.
   */
  recordMessage(): void {
    this.lastPongTime = Date.now();
  }

  /**
   * Get the time in milliseconds since the last message was received
   *
   * @returns Time in milliseconds since last message
   */
  getTimeSinceLastMessage(): number {
    return Date.now() - this.lastPongTime;
  }

  /**
   * Check for heartbeat timeout and send heartbeat if needed
   *
   * This should be called periodically (typically in the heartbeat interval).
   * It performs two checks:
   * 1. Timeout detection: If authenticated and no message in 2x interval, trigger timeout
   * 2. Heartbeat send: If authenticated and WebSocket is open, send heartbeat
   *
   * @param authState - Current authentication state
   */
  checkHeartbeat(authState: AuthState): void {
    const timeSinceLastMessage = this.getTimeSinceLastMessage();

    // Check for timeout (only when authenticated)
    if (
      authState === AuthState.AUTHENTICATED &&
      timeSinceLastMessage > this.config.heartbeatInterval * 2
    ) {
      console.warn("[HeartbeatManager] Heartbeat timeout - triggering reconnect");
      this.config.onTimeout();
      return;
    }

    // Send heartbeat message (only when authenticated and WebSocket is open)
    if (authState === AuthState.AUTHENTICATED && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ t: "heartbeat" }));
    }
  }
}
