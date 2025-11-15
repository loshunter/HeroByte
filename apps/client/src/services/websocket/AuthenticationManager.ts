/**
 * AuthenticationManager
 *
 * Manages WebSocket authentication state machine and auth event handling.
 *
 * Responsibilities:
 * - Track authentication state (UNAUTHENTICATED, PENDING, AUTHENTICATED, FAILED)
 * - Send authenticate message to server
 * - Handle auth-ok and auth-failed responses
 * - Trigger auth events (pending, success, failure, reset)
 * - Reset auth state on disconnect
 *
 * Single Responsibility Principle:
 * This manager is solely responsible for authentication state and events.
 * It does NOT handle:
 * - WebSocket connection lifecycle (ConnectionLifecycleManager)
 * - Message routing (MessageRouter)
 * - Message queueing (MessageQueueManager)
 * - Heartbeat timing (HeartbeatManager)
 *
 * Extracted from: apps/client/src/services/websocket.ts
 * - authState property (line 78)
 * - authenticate() method (lines 193-203)
 * - handleAuthResponse() method (lines 253-262)
 * - Auth state transitions in connect/disconnect
 */

import type { ServerMessage } from "@shared";

/**
 * Authentication state enum
 */
export enum AuthState {
  UNAUTHENTICATED = "unauthenticated",
  PENDING = "pending",
  AUTHENTICATED = "authenticated",
  FAILED = "failed",
}

/**
 * Authentication event types
 */
export type AuthEvent =
  | { type: "reset" }
  | { type: "pending" }
  | { type: "success" }
  | { type: "failure"; reason?: string };

/**
 * Auth response message types
 */
type AuthResponseMessage =
  | Extract<ServerMessage, { t: "auth-ok" }>
  | Extract<ServerMessage, { t: "auth-failed" }>;

/**
 * Configuration for AuthenticationManager
 */
export interface AuthenticationManagerConfig {
  /**
   * Optional callback for authentication events
   * Called when auth state transitions occur
   */
  onAuthEvent?: (event: AuthEvent) => void;
}

/**
 * AuthenticationManager
 *
 * Manages the authentication state machine for WebSocket connections.
 *
 * State transitions:
 * - UNAUTHENTICATED -> PENDING (authenticate() called)
 * - PENDING -> AUTHENTICATED (auth-ok received)
 * - PENDING -> FAILED (auth-failed received)
 * - Any -> UNAUTHENTICATED (reset() called)
 *
 * @example
 * ```typescript
 * const authManager = new AuthenticationManager({
 *   onAuthEvent: (event) => {
 *     if (event.type === 'success') {
 *       console.log('Authentication successful');
 *     }
 *   }
 * });
 *
 * // Start authentication
 * authManager.authenticate(ws, 'secret-key', 'room-123');
 *
 * // Handle server response
 * authManager.handleAuthResponse({ t: 'auth-ok' });
 *
 * // Check state
 * if (authManager.isAuthenticated()) {
 *   // Send authenticated messages
 * }
 * ```
 */
export class AuthenticationManager {
  private authState: AuthState = AuthState.UNAUTHENTICATED;
  private readonly config: Required<AuthenticationManagerConfig>;

  constructor(config: AuthenticationManagerConfig) {
    this.config = {
      onAuthEvent: () => {},
      ...config,
    };
  }

  /**
   * Attempt to authenticate the current WebSocket session
   *
   * Transitions auth state to PENDING and sends authenticate message to server.
   * Will NOT send if WebSocket is null or not in OPEN state.
   *
   * @param ws - The WebSocket connection (or null if not connected)
   * @param secret - Authentication secret/password
   * @param roomId - Optional room ID to join
   */
  authenticate(ws: WebSocket | null, secret: string, roomId?: string): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("[WebSocket] Cannot authenticate before socket is open");
      return;
    }

    this.authState = AuthState.PENDING;
    this.config.onAuthEvent({ type: "pending" });

    ws.send(JSON.stringify({ t: "authenticate", secret, roomId }));
  }

  /**
   * Reset authentication state to UNAUTHENTICATED
   *
   * Called when disconnecting or when auth needs to be cleared.
   * Emits a 'reset' auth event.
   */
  reset(): void {
    this.authState = AuthState.UNAUTHENTICATED;
    this.config.onAuthEvent({ type: "reset" });
  }

  /**
   * Get current authentication state
   *
   * @returns Current AuthState
   */
  getAuthState(): AuthState {
    return this.authState;
  }

  /**
   * Check if currently authenticated
   *
   * Convenience method that returns true only when state is AUTHENTICATED.
   *
   * @returns True if authenticated, false otherwise
   */
  isAuthenticated(): boolean {
    return this.authState === AuthState.AUTHENTICATED;
  }

  /**
   * Handle authentication response message from server
   *
   * Called by MessageRouter when auth-ok or auth-failed is received.
   * Transitions state and emits appropriate auth event.
   *
   * @param message - The auth response message from server
   */
  handleAuthResponse(message: AuthResponseMessage): void {
    if (message.t === "auth-ok") {
      this.authState = AuthState.AUTHENTICATED;
      this.config.onAuthEvent({ type: "success" });
    } else {
      this.authState = AuthState.FAILED;
      this.config.onAuthEvent({ type: "failure", reason: message.reason });
    }
  }
}
