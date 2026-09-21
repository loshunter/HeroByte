/**
 * CONNECTION LIFECYCLE MANAGER
 *
 * Manages WebSocket connection lifecycle including creation, state transitions,
 * reconnection logic with exponential backoff, and cleanup.
 *
 * RESPONSIBILITIES:
 * - Create and manage WebSocket connections
 * - Track connection state (CONNECTING, CONNECTED, DISCONNECTED, etc.)
 * - Handle reconnection with exponential backoff (1.5x multiplier, capped at 30s)
 * - Detect connection timeouts (12s)
 * - Manage visibility changes (reconnect when tab becomes visible)
 * - Clean up timers and event listeners
 *
 * DEPENDENCIES:
 * - WebSocket (browser API)
 * - document.addEventListener/removeEventListener (for visibility changes)
 * - window.setTimeout/clearTimeout (for timers)
 *
 * INTEGRATION:
 * - Used by WebSocketService to manage connection lifecycle
 * - Delegates message handling to MessageRouter via onMessage callback
 * - Coordinates with AuthenticationManager via onOpen callback
 * - Coordinates with HeartbeatManager via onOpen callback
 *
 * EXTRACTION CONTEXT:
 * This class was extracted from WebSocketService as part of the SOLID refactoring
 * initiative (Phase 3, Item 5 of 6). It contains zero behavioral changes from
 * the original implementation.
 *
 * Source: apps/client/src/services/websocket.ts
 * - connect() method (lines 124-143)
 * - disconnect() method (lines 148-152)
 * - handleDisconnect() method (lines 248-266)
 * - reconnect() method (lines 268-283)
 * - setupEventHandlers() method (lines 195-224)
 * - handleVisibilityChange() method (lines 325-330)
 * - startConnectTimer() method (lines 332-345)
 * - clearConnectTimer() method (lines 347-352)
 * - setState() method (lines 354-360)
 * - cleanup() method (lines 300-323)
 */

import {
  WS_CLOSE_REPLACED,
  WS_CLOSE_SESSION_CONFLICT,
  type ConnectionClosingReason,
} from "@herobyte/shared";

/**
 * Connection states for WebSocket lifecycle
 */
export enum ConnectionState {
  CONNECTING = "connecting",
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  RECONNECTING = "reconnecting",
  FAILED = "failed",
  /**
   * This session was superseded by a newer connection for the same uid
   * (another tab/window/device took over). Terminal: we do NOT auto-reconnect,
   * because reconnecting would supersede the newer connection and the two
   * contexts would thrash forever. The user reclaims the table with the auth
   * gate's "Reclaim This Tab" button, which calls connect() in place.
   */
  REPLACED = "replaced",
  /**
   * The server turned this connection away: another socket already holds this
   * uid and this one could not prove it is the same session (no matching
   * token). Usually a different browser or device; it can also be this same
   * client racing its own not-yet-closed socket, briefly, after a fast reload
   * or a deploy — that case self-heals on retry. Not terminal the way REPLACED
   * is (close the other and try again), but never auto-retried: retrying as the
   * same uid in a loop is the connection war REPLACED ended. A browser that
   * has lost its key gets a "start a fresh session" way out on the gate
   * (features/auth/freshSession.ts) once a retry in that conflict has failed.
   */
  CONFLICT = "conflict",
}

/**
 * Configuration for ConnectionLifecycleManager
 */
export interface ConnectionLifecycleManagerConfig {
  /** WebSocket server URL (e.g., "ws://localhost:8080") */
  url: string;
  /** Unique identifier for this client */
  uid: string;
  /** Milliseconds between reconnect attempts (default: 2000) */
  reconnectInterval?: number;
  /** Maximum reconnection attempts (0 = infinite, default: 0) */
  maxReconnectAttempts?: number;
  /** Called when connection state changes */
  onStateChange?: (state: ConnectionState) => void;
  /** Called when WebSocket opens successfully */
  onOpen?: () => void;
  /** Called when WebSocket closes */
  onClose?: (event: CloseEvent) => void;
  /** Called when WebSocket encounters an error */
  onError?: (error: Event) => void;
  /** Called when WebSocket receives a message */
  onMessage?: (data: string) => void;
}

/**
 * Manages WebSocket connection lifecycle with automatic reconnection
 *
 * FEATURES:
 * - Automatic reconnection with exponential backoff
 * - Connection timeout detection (12 seconds)
 * - Reconnect when browser tab becomes visible
 * - Proper cleanup of timers and event listeners
 * - State change notifications via callbacks
 *
 * USAGE:
 * ```typescript
 * const manager = new ConnectionLifecycleManager({
 *   url: "ws://localhost:8080",
 *   uid: "user-123",
 *   onStateChange: (state) => console.log("State:", state),
 *   onOpen: () => console.log("Connected"),
 *   onMessage: (data) => handleMessage(data),
 * });
 *
 * manager.connect();
 * ```
 *
 * LIFECYCLE:
 * 1. connect() creates WebSocket and transitions to CONNECTING
 * 2. WebSocket onopen fires -> transitions to CONNECTED
 * 3. WebSocket onclose fires -> triggers handleDisconnect()
 * 4. handleDisconnect() triggers reconnect() with exponential backoff
 * 5. disconnect() cleans up everything and transitions to DISCONNECTED
 *
 * RECONNECTION LOGIC:
 * - Uses exponential backoff: interval * 1.5^(attempts - 1)
 * - Capped at 30 seconds maximum delay
 * - Respects maxReconnectAttempts (0 = infinite)
 * - Resets reconnectAttempts to 0 on successful connection
 *
 * STATE TRANSITIONS:
 * - DISCONNECTED → CONNECTING (via connect())
 * - CONNECTING → CONNECTED (via WebSocket onopen)
 * - CONNECTING → RECONNECTING (via connection timeout or error)
 * - CONNECTED → RECONNECTING (via WebSocket onclose)
 * - RECONNECTING → CONNECTING (via reconnect timer)
 * - RECONNECTING → FAILED (via max attempts exceeded)
 * - CONNECTED → REPLACED / CONFLICT (via the server's `connection-closing`
 *   frame — handleServerClosing() — or, on a direct connection where the
 *   close code survives, via the code in onclose; one transition for both)
 * - Any → DISCONNECTED (via disconnect())
 */
export class ConnectionLifecycleManager {
  private ws: WebSocket | null = null;
  private config: Required<ConnectionLifecycleManagerConfig>;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private connectTimer: number | null = null;
  private handleVisibilityChangeBound: () => void;

  /**
   * Create a new ConnectionLifecycleManager
   *
   * @param config - Configuration options
   */
  constructor(config: ConnectionLifecycleManagerConfig) {
    this.config = {
      reconnectInterval: 2000,
      maxReconnectAttempts: 0, // infinite by default
      onStateChange: () => {},
      onOpen: () => {},
      onClose: () => {},
      onError: () => {},
      onMessage: () => {},
      ...config,
    };

    // Bind visibility change handler to preserve 'this' context
    this.handleVisibilityChangeBound = this.handleVisibilityChange.bind(this);
  }

  // =========================================================================
  // PUBLIC METHODS
  // =========================================================================

  /**
   * Connect to the WebSocket server
   *
   * BEHAVIOR:
   * - If already connected, logs warning and returns early
   * - Sets state to CONNECTING
   * - Creates WebSocket with URL pattern: `${url}?uid=${uid}`
   * - Sets up WebSocket event handlers (onopen, onclose, onerror, onmessage)
   * - Starts connect timer (12 seconds)
   * - Adds visibility change listener
   *
   * ERROR HANDLING:
   * - If WebSocket constructor throws, logs error and triggers handleDisconnect()
   */
  connect(): void {
    if (this.ws) {
      if (this.state === ConnectionState.CONNECTED) {
        console.warn("[WebSocket] Already connected");
        return;
      }
      if (
        this.state === ConnectionState.CONNECTING ||
        this.state === ConnectionState.RECONNECTING
      ) {
        console.warn("[WebSocket] Connection attempt already in progress");
        return;
      }
    }

    this.setState(ConnectionState.CONNECTING);
    const url = `${this.config.url}?uid=${this.config.uid}`;

    try {
      this.ws = new WebSocket(url);
      this.setupEventHandlers();
      this.startConnectTimer();
    } catch (error) {
      console.error("[WebSocket] Connection error:", error);
      this.handleDisconnect();
    }
  }

  /**
   * Disconnect from the WebSocket server
   *
   * BEHAVIOR:
   * - Calls cleanup() to close WebSocket and clear timers
   * - Sets state to DISCONNECTED
   * - Does NOT trigger reconnection
   */
  disconnect(): void {
    this.cleanup();
    this.setState(ConnectionState.DISCONNECTED);
  }

  /**
   * The server announced, in a data frame, that it is closing this socket on
   * purpose — and why. This is THE signal in production: Render's proxy
   * rewrites server-sent close codes to 1005, so the code-driven branches in
   * onclose never fire there (found live 2026-09-20; WS_CLOSE_REPLACED had
   * been inert since July, and two tabs of one browser took the seat from
   * each other every 2 s). Go terminal now, without waiting for the close
   * frame: cleanup() nulls this socket's handlers, so the stripped close that
   * follows is ignored as stale and nothing reconnects.
   *
   * One teardown path for both signals: the same onClose the close event
   * drives is fired here with a synthetic CloseEvent carrying the code the
   * proxy would have stripped, so every consumer of onClose sees the
   * production ending too. A reason this build does not know still ends the
   * session — held as a conflict, never reconnected: "ignore it and keep the
   * connection" is the reconnect war this frame exists to end.
   *
   * Called by WebSocketService when MessageRouter routes the frame. A frame
   * can only arrive on the current socket (a stale socket's handlers are
   * nulled); with no socket open there is nothing to end.
   */
  handleServerClosing(reason: string): void {
    if (this.ws === null) {
      console.warn("[WebSocket] connection-closing with no socket open — ignored:", reason);
      return;
    }
    const known: ConnectionClosingReason = reason === "replaced" ? "replaced" : "conflict";
    if (reason !== known) {
      console.warn(
        `[WebSocket] Unrecognised connection-closing reason "${reason}" — held as a conflict`,
      );
    }
    console.log("[WebSocket] Server is closing this connection:", reason);
    this.clearConnectTimer();
    // The teardown may throw; the session must end regardless, or the stripped
    // close that follows would find live handlers and reconnect into the war.
    try {
      this.config.onClose(
        new CloseEvent("close", {
          code: known === "replaced" ? WS_CLOSE_REPLACED : WS_CLOSE_SESSION_CONFLICT,
          reason: `announced by server: ${reason}`,
          wasClean: true,
        }),
      );
    } finally {
      this.endSession(known);
    }
  }

  /**
   * Get current connection state
   *
   * @returns Current ConnectionState
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if currently connected
   *
   * @returns true if state is CONNECTED, false otherwise
   */
  isConnected(): boolean {
    return this.state === ConnectionState.CONNECTED;
  }

  /**
   * Get current reconnect attempts count
   *
   * @returns Number of reconnection attempts since last successful connection
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /**
   * Get WebSocket instance (for testing and advanced use cases)
   *
   * @returns WebSocket instance or null if not connected
   */
  getWebSocket(): WebSocket | null {
    return this.ws;
  }

  // =========================================================================
  // PRIVATE METHODS
  // =========================================================================

  /**
   * Set up WebSocket event handlers
   *
   * HANDLERS:
   * - onopen: Transition to CONNECTED, reset reconnectAttempts, call onOpen callback
   * - onmessage: Call onMessage callback with event.data
   * - onclose: Call onClose callback, trigger handleDisconnect()
   * - onerror: Log error, call onError callback
   *
   * VISIBILITY:
   * - Adds document visibility change listener to reconnect when tab becomes visible
   */
  private setupEventHandlers(): void {
    const socket = this.ws;
    if (!socket) return;
    const isCurrentSocket = (): boolean => this.ws === socket;

    socket.onopen = () => {
      if (!isCurrentSocket()) {
        console.log("[WebSocket] Ignoring open event for stale socket");
        return;
      }
      console.log("[WebSocket] Connected as", this.config.uid);
      this.clearConnectTimer();
      this.setState(ConnectionState.CONNECTED);
      this.reconnectAttempts = 0;
      this.config.onOpen();
    };

    socket.onmessage = (event) => {
      if (!isCurrentSocket()) {
        return;
      }
      this.config.onMessage(event.data);
    };

    socket.onclose = (event) => {
      if (!isCurrentSocket()) {
        console.log("[WebSocket] Ignoring close event for stale socket");
        return;
      }
      console.log("[WebSocket] Disconnected", event.code, event.reason);
      this.clearConnectTimer();
      // As in handleServerClosing: whatever the teardown does, the close is
      // settled, so a throw can never leave the socket half torn down.
      try {
        this.config.onClose(event);
      } finally {
        this.settleAfterClose(event.code);
      }
    };

    socket.onerror = (error) => {
      if (!isCurrentSocket()) {
        console.log("[WebSocket] Ignoring error event for stale socket");
        return;
      }
      console.error("[WebSocket] Error:", error);
      this.config.onError(error);
    };

    // Handle browser page visibility - reconnect when tab becomes visible
    document.addEventListener("visibilitychange", this.handleVisibilityChangeBound);
  }

  /**
   * What a close event means, by its code. The code is the fallback signal,
   * for direct connections only: in production the proxy rewrites it to 1005
   * and neither terminal branch fires — the `connection-closing` frame the
   * server sends first is what ends the session there (handleServerClosing).
   * Same transitions either way.
   */
  private settleAfterClose(code: number): void {
    // A "replaced by new connection" close means another tab/window/device
    // took over this uid. Reconnecting would supersede that newer connection
    // and the two contexts would 4002 each other forever. Stop here.
    if (code === WS_CLOSE_REPLACED) {
      this.endSession("replaced");
      return;
    }
    // Turned away: the uid's session is live on another socket and this one
    // could not prove it is the same session. Auto-retrying would hammer the
    // server with the same unproven claim; the user decides when to retry.
    if (code === WS_CLOSE_SESSION_CONFLICT) {
      this.endSession("conflict");
      return;
    }
    this.handleDisconnect();
  }

  /**
   * End this session for good (REPLACED) or until the user retries (CONFLICT).
   * One transition for both signals — the `connection-closing` frame and, on
   * a direct connection, the close code — so they can never drift apart.
   * cleanup() removes the visibility listener and closes the socket, so no
   * timer, focus change or late close event can revive the connection.
   */
  private endSession(reason: ConnectionClosingReason): void {
    this.cleanup();
    this.setState(reason === "replaced" ? ConnectionState.REPLACED : ConnectionState.CONFLICT);
  }

  /**
   * Handle disconnection and trigger reconnection logic
   *
   * BEHAVIOR:
   * - Calls cleanup() to close WebSocket and clear timers
   * - Checks if should reconnect based on maxReconnectAttempts
   * - If should reconnect: calls reconnect()
   * - If should NOT reconnect: sets state to FAILED
   *
   * RECONNECTION CRITERIA:
   * - maxReconnectAttempts === 0 (infinite) OR
   * - reconnectAttempts < maxReconnectAttempts
   */
  private handleDisconnect(): void {
    this.cleanup();
    this.clearConnectTimer();

    // Attempt reconnection
    const shouldReconnect =
      this.config.maxReconnectAttempts === 0 ||
      this.reconnectAttempts < this.config.maxReconnectAttempts;

    if (shouldReconnect) {
      this.reconnect();
    } else {
      this.setState(ConnectionState.FAILED);
    }
  }

  /**
   * Reconnect to WebSocket server with exponential backoff
   *
   * BEHAVIOR:
   * - Sets state to RECONNECTING
   * - Increments reconnectAttempts
   * - Calculates delay using exponential backoff: interval * 1.5^(attempts - 1)
   * - Caps delay at 30 seconds
   * - Schedules connect() call after delay
   *
   * EXPONENTIAL BACKOFF FORMULA:
   * delay = min(reconnectInterval * 1.5^(attempts - 1), 30000)
   *
   * EXAMPLES (reconnectInterval = 2000ms):
   * - Attempt 1: 2000 * 1.5^0 = 2000ms (2s)
   * - Attempt 2: 2000 * 1.5^1 = 3000ms (3s)
   * - Attempt 3: 2000 * 1.5^2 = 4500ms (4.5s)
   * - Attempt 4: 2000 * 1.5^3 = 6750ms (6.75s)
   * - Attempt 10: 2000 * 1.5^9 = 30000ms (30s, capped)
   */
  private reconnect(): void {
    this.setState(ConnectionState.RECONNECTING);
    this.reconnectAttempts++;

    // Exponential backoff (cap at 30 seconds)
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1),
      30000,
    );

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Clean up WebSocket connection and timers
   *
   * CLEANUP STEPS:
   * 1. Clear connect timer
   * 2. Clear reconnect timer
   * 3. Set WebSocket event handlers to null
   * 4. Close WebSocket if readyState is OPEN
   * 5. Set WebSocket instance to null
   * 6. Remove visibility change event listener
   *
   * NOTES:
   * - Does NOT change connection state (caller is responsible)
   * - Safe to call multiple times
   * - Safe to call when WebSocket is null
   */
  private cleanup(): void {
    this.clearConnectTimer();

    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;

      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }

      this.ws = null;
    }

    document.removeEventListener("visibilitychange", this.handleVisibilityChangeBound);
  }

  /**
   * Handle document visibility change events
   *
   * BEHAVIOR:
   * - If document becomes visible AND not connected: call connect()
   * - If document becomes hidden: do nothing
   *
   * USE CASE:
   * - User switches to another tab, browser may close WebSocket
   * - User switches back to tab, automatically reconnect
   */
  private handleVisibilityChange(): void {
    // Never revive a superseded or turned-away session on focus: another
    // connection owns this uid, and reconnecting would restart the replace-war
    // (REPLACED) or re-file the same unproven claim (CONFLICT). Unreachable
    // today — cleanup() removes this listener before either state is set —
    // and kept as the second line behind that removal.
    if (this.state === ConnectionState.REPLACED || this.state === ConnectionState.CONFLICT) {
      return;
    }
    if (document.visibilityState === "visible" && !this.isConnected()) {
      console.log("[WebSocket] Tab visible - attempting reconnect");
      this.connect();
    }
  }

  /**
   * Start connection timeout timer (12 seconds)
   *
   * BEHAVIOR:
   * - Clears any existing connect timer
   * - Starts new timer that fires after 12 seconds
   * - If timer fires and WebSocket is still CONNECTING: closes connection
   * - If timer fires and state is CONNECTING/RECONNECTING: calls handleDisconnect()
   *
   * TIMEOUT HANDLING:
   * - If WebSocket.readyState is CONNECTING: close with code 4005
   * - Otherwise, if state is CONNECTING or RECONNECTING: trigger handleDisconnect()
   */
  private startConnectTimer(): void {
    this.clearConnectTimer();
    this.connectTimer = window.setTimeout(() => {
      if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
        console.warn("[WebSocket] Connection handshake timed out");
        this.ws.close(4005, "Connection timeout");
      } else if (
        this.state === ConnectionState.CONNECTING ||
        this.state === ConnectionState.RECONNECTING
      ) {
        this.handleDisconnect();
      }
    }, 12000);
  }

  /**
   * Clear connection timeout timer
   *
   * BEHAVIOR:
   * - If connectTimer is not null: clears timeout and sets to null
   * - Safe to call multiple times
   */
  private clearConnectTimer(): void {
    if (this.connectTimer !== null) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  /**
   * Set connection state and fire callback if state changed
   *
   * BEHAVIOR:
   * - If newState equals current state: does nothing (no callback fired)
   * - If newState differs from current state:
   *   - Updates internal state
   *   - Calls onStateChange callback with new state
   *   - Logs state change to console
   *
   * @param newState - New ConnectionState to transition to
   */
  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.config.onStateChange(newState);
      console.log("[WebSocket] State:", newState);
    }
  }
}
