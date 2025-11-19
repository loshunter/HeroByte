/**
 * ============================================================================
 * WEBSOCKET SERVICE - ORCHESTRATOR
 * ============================================================================
 *
 * Orchestrates WebSocket functionality through five specialized managers,
 * following SOLID principles for clean separation of concerns.
 *
 * ARCHITECTURE:
 *
 * This service delegates all responsibilities to focused managers:
 *
 * 1. ConnectionLifecycleManager - Connection state, reconnection, timeouts
 * 2. AuthenticationManager - Auth state machine, auth events
 * 3. MessageQueueManager - Outbound message queueing and sending
 * 4. HeartbeatManager - Keepalive timing, timeout detection
 * 5. MessageRouter - Inbound message parsing and routing
 *
 * DESIGN PRINCIPLES:
 *
 * - Single Responsibility: Each manager has one focused purpose
 * - Open/Closed: Extensible via callbacks without modification
 * - Dependency Inversion: Managers depend on abstractions (callbacks)
 * - Interface Segregation: Minimal, focused manager interfaces
 * - Liskov Substitution: Managers are independently replaceable
 *
 * LIFECYCLE:
 *
 * 1. Construction: All managers initialized with config and callbacks
 * 2. connect(): Triggers ConnectionLifecycleManager.connect()
 * 3. WebSocket opens → handleOpen() → starts HeartbeatManager
 * 4. Message received → handleMessage() → routes to MessageRouter → callbacks
 * 5. Auth success → flushMessageQueue() via MessageQueueManager
 * 6. disconnect(): Stops heartbeat, resets auth, closes connection
 *
 * BEST PRACTICES:
 *
 * This implementation follows WebSocket best practices from:
 * - https://medium.com/@voodooengineering/websocket-integration-checklist
 * - https://ably.com/topic/websocket-architecture
 *
 * REFACTORING HISTORY:
 *
 * Extracted from monolithic WebSocketService (512 LOC → 238 LOC, 54% reduction)
 * as part of Phase 15 SOLID Refactor Initiative.
 *
 * See: docs/refactoring/CLIENT_WEBSOCKET_PLAN.md
 */

import type { RoomSnapshot, ClientMessage, ServerMessage } from "@shared";
import type { SignalData } from "simple-peer";
import { MessageRouter } from "./websocket/MessageRouter";
import {
  AuthenticationManager,
  AuthState,
  type AuthEvent,
} from "./websocket/AuthenticationManager";
import { MessageQueueManager } from "./websocket/MessageQueueManager";
import { HeartbeatManager } from "./websocket/HeartbeatManager";
import {
  ConnectionLifecycleManager,
  ConnectionState,
} from "./websocket/ConnectionLifecycleManager";
import { ServerWarmupManager } from "./websocket/ServerWarmupManager";

type MessageHandler = (snapshot: RoomSnapshot) => void;
type RtcSignalHandler = (from: string, signal: SignalData) => void;
type ConnectionStateHandler = (state: ConnectionState) => void;

// Auth response and control message types extracted to MessageRouter
type AuthResponseMessage =
  | Extract<ServerMessage, { t: "auth-ok" }>
  | Extract<ServerMessage, { t: "auth-failed" }>;

type ControlMessage =
  | Extract<ServerMessage, { t: "room-password-updated" }>
  | Extract<ServerMessage, { t: "room-password-update-failed" }>
  | Extract<ServerMessage, { t: "dm-status" }>
  | Extract<ServerMessage, { t: "dm-elevation-failed" }>
  | Extract<ServerMessage, { t: "dm-password-updated" }>
  | Extract<ServerMessage, { t: "dm-password-update-failed" }>;

// Re-export for backward compatibility
export { AuthState, type AuthEvent, ConnectionState };

interface WebSocketServiceConfig {
  url: string;
  uid: string;
  onMessage: MessageHandler;
  onRtcSignal?: RtcSignalHandler;
  onStateChange?: ConnectionStateHandler;
  onAuthEvent?: (event: AuthEvent) => void;
  onControlMessage?: (message: ControlMessage) => void;
  reconnectInterval?: number; // ms between reconnect attempts
  maxReconnectAttempts?: number; // 0 = infinite
  heartbeatInterval?: number; // ms between heartbeats
}

/**
 * WebSocket service orchestrator
 *
 * ORCHESTRATION PATTERN:
 *
 * This class coordinates five specialized managers using the orchestrator pattern:
 * - Maintains no business logic itself (pure delegation)
 * - Wires up manager callbacks for inter-manager communication
 * - Provides stable public API for backward compatibility
 * - Handles manager initialization order
 *
 * FEATURES PROVIDED BY MANAGERS:
 *
 * - Automatic reconnection with exponential backoff (ConnectionLifecycleManager)
 * - Heartbeat to detect broken connections (HeartbeatManager)
 * - Connection state management (ConnectionLifecycleManager)
 * - Message queueing during disconnection (MessageQueueManager)
 * - Authentication state machine (AuthenticationManager)
 * - Type-safe message routing (MessageRouter)
 *
 * PUBLIC API (unchanged from original):
 *
 * - connect() - Establish WebSocket connection
 * - disconnect() - Close connection and cleanup
 * - send(message) - Send message (queues if not ready)
 * - authenticate(secret, roomId?) - Authenticate session
 * - getState() - Get connection state
 * - isConnected() - Check if connected
 *
 * USAGE:
 *
 * ```typescript
 * const ws = new WebSocketService({
 *   url: "ws://localhost:8080",
 *   uid: "user-123",
 *   onMessage: (snapshot) => handleSnapshot(snapshot),
 *   onStateChange: (state) => console.log("State:", state),
 * });
 *
 * ws.connect();
 * ws.authenticate("secret-key", "room-id");
 * ws.send({ t: "action", ... });
 * ```
 */
export class WebSocketService {
  private config: Required<WebSocketServiceConfig>;
  private messageRouter: MessageRouter;
  private authManager: AuthenticationManager;
  private messageQueueManager: MessageQueueManager;
  private heartbeatManager: HeartbeatManager;
  private connectionManager: ConnectionLifecycleManager;
  private warmupManager: ServerWarmupManager;

  /**
   * Create a new WebSocketService orchestrator
   *
   * INITIALIZATION ORDER:
   *
   * Managers are initialized in dependency order:
   * 1. AuthenticationManager (no dependencies)
   * 2. MessageRouter (no dependencies)
   * 3. MessageQueueManager (no dependencies)
   * 4. HeartbeatManager (depends on auth state)
   * 5. ConnectionLifecycleManager (coordinates all via callbacks)
   *
   * CALLBACK WIRING:
   *
   * - ConnectionLifecycleManager.onOpen → handleOpen() → starts HeartbeatManager
   * - ConnectionLifecycleManager.onMessage → handleMessage() → MessageRouter
   * - MessageRouter.onAuthResponse → handleAuthResponse() → AuthenticationManager
   * - HeartbeatManager.onTimeout → closes WebSocket
   * - AuthenticationManager state → influences MessageQueueManager send decisions
   *
   * @param config - Configuration options
   */
  constructor(config: WebSocketServiceConfig) {
    this.config = {
      reconnectInterval: 2000,
      maxReconnectAttempts: 0, // infinite
      heartbeatInterval: 25000, // 25 seconds (matches server)
      onRtcSignal: () => {},
      onStateChange: () => {},
      onAuthEvent: () => {},
      onControlMessage: () => {},
      ...config,
    };

    // Initialize AuthenticationManager (independent)
    this.authManager = new AuthenticationManager({
      onAuthEvent: this.config.onAuthEvent,
    });

    // Initialize MessageRouter (independent)
    this.messageRouter = new MessageRouter({
      onMessage: this.config.onMessage,
      onRtcSignal: this.config.onRtcSignal,
      onAuthResponse: this.handleAuthResponse.bind(this),
      onControlMessage: this.config.onControlMessage,
    });

    // Initialize MessageQueueManager (independent)
    this.messageQueueManager = new MessageQueueManager({
      maxQueueSize: 200,
    });

    // Initialize HeartbeatManager (needs auth state accessor)
    this.heartbeatManager = new HeartbeatManager({
      heartbeatInterval: this.config.heartbeatInterval,
      onTimeout: () => this.connectionManager.getWebSocket()?.close(),
      getAuthState: () => this.authManager.getAuthState(),
    });

    // Initialize ConnectionLifecycleManager (orchestrates via callbacks)
    this.connectionManager = new ConnectionLifecycleManager({
      url: this.config.url,
      uid: this.config.uid,
      reconnectInterval: this.config.reconnectInterval,
      maxReconnectAttempts: this.config.maxReconnectAttempts,
      onStateChange: this.config.onStateChange,
      onOpen: this.handleOpen.bind(this),
      onMessage: this.handleMessage.bind(this),
    });

    this.warmupManager = new ServerWarmupManager(this.config.url);
  }

  // =========================================================================
  // PUBLIC API
  // =========================================================================

  /**
   * Connect to the WebSocket server
   *
   * ORCHESTRATION:
   * 1. Resets authentication state (clean slate)
   * 2. Delegates to ConnectionLifecycleManager.connect()
   * 3. ConnectionLifecycleManager will call handleOpen() when ready
   * 4. handleOpen() starts HeartbeatManager
   *
   * SUBSEQUENT FLOW:
   * - ConnectionLifecycleManager creates WebSocket
   * - WebSocket.onopen fires → handleOpen() → start heartbeat
   * - Caller should then call authenticate() to auth the session
   * - After auth-ok, message queue will flush
   */
  connect(): void {
    this.authManager.reset();
    this.warmupManager.ensureWarmup().catch((error) => {
      console.warn("[Warmup] Warmup request rejected:", error);
    });
    this.connectionManager.connect();
  }

  /**
   * Disconnect from the WebSocket server
   *
   * ORCHESTRATION:
   * 1. Resets authentication state
   * 2. Stops heartbeat timer
   * 3. Delegates to ConnectionLifecycleManager.disconnect()
   *
   * CLEANUP:
   * - ConnectionLifecycleManager closes WebSocket
   * - ConnectionLifecycleManager clears timers
   * - ConnectionLifecycleManager removes event listeners
   * - No reconnection will be attempted
   */
  disconnect(): void {
    this.authManager.reset();
    this.heartbeatManager.stop();
    this.connectionManager.disconnect();
  }

  /**
   * Send a message to the server
   *
   * ORCHESTRATION:
   * - Delegates to MessageQueueManager.send()
   * - MessageQueueManager decides: send immediately or queue
   * - Decision based on canSendImmediately() (connection + auth state)
   *
   * QUEUEING BEHAVIOR:
   * - Messages queued if not connected or not authenticated
   * - Exception: authenticate messages always sent immediately
   * - Exception: heartbeats dropped if not authenticated yet
   * - Queue flushed after successful authentication (auth-ok)
   *
   * @param message - Client message to send
   */
  send(message: ClientMessage): void {
    // Log additional context for debugging
    if (message.t !== "authenticate" && message.t !== "heartbeat") {
      console.log(
        `[WebSocket] send() called for message type=${message.t}, authState=${this.authManager.getAuthState()}, connectionState=${this.connectionManager.getState()}`,
      );
    }

    // Delegate to MessageQueueManager
    this.messageQueueManager.send(message, this.connectionManager.getWebSocket(), () =>
      this.canSendImmediately(),
    );
  }

  /**
   * Get current connection state
   *
   * @returns Current ConnectionState from ConnectionLifecycleManager
   */
  getState(): ConnectionState {
    return this.connectionManager.getState();
  }

  /**
   * Check if currently connected
   *
   * @returns true if state is CONNECTED, false otherwise
   */
  isConnected(): boolean {
    return this.connectionManager.isConnected();
  }

  /**
   * Authenticate the current WebSocket session
   *
   * ORCHESTRATION:
   * - Delegates to AuthenticationManager.authenticate()
   * - AuthenticationManager sends authenticate message
   * - AuthenticationManager transitions to PENDING state
   * - Server responds with auth-ok or auth-failed
   * - Response routes through MessageRouter → handleAuthResponse()
   * - On auth-ok: message queue flushes automatically
   *
   * @param secret - Authentication secret
   * @param roomId - Optional room ID to join
   */
  authenticate(secret: string, roomId?: string): void {
    this.authManager.authenticate(this.connectionManager.getWebSocket(), secret, roomId);
  }

  // =========================================================================
  // PRIVATE ORCHESTRATION METHODS
  // =========================================================================
  //
  // These methods coordinate between managers via callbacks.
  // They contain no business logic - only delegation and coordination.
  //
  // =========================================================================

  /**
   * Handle WebSocket connection open event
   *
   * COORDINATION:
   * - Called by ConnectionLifecycleManager.onOpen callback
   * - Starts HeartbeatManager with WebSocket instance
   *
   * MESSAGE QUEUE BEHAVIOR:
   * - Does NOT flush message queue here
   * - Queue flushing waits for successful authentication (auth-ok)
   * - This ensures messages don't get rejected for being unauthenticated
   *
   * @private Callback from ConnectionLifecycleManager
   */
  private handleOpen(): void {
    const ws = this.connectionManager.getWebSocket();
    if (ws) {
      this.heartbeatManager.start(ws);
    }
    // Do NOT flush message queue here - wait for auth-ok response
    // Messages will be flushed after successful authentication
  }

  /**
   * Handle inbound WebSocket message
   *
   * COORDINATION:
   * - Called by ConnectionLifecycleManager.onMessage callback
   * - Records message timestamp in HeartbeatManager (any message = alive)
   * - Delegates parsing and routing to MessageRouter
   *
   * MESSAGE FLOW:
   * - MessageRouter parses JSON
   * - MessageRouter identifies message type via type guards
   * - MessageRouter routes to appropriate callback:
   *   - RTC signals → onRtcSignal callback
   *   - Auth responses → handleAuthResponse()
   *   - Control messages → onControlMessage callback
   *   - Room snapshots → onMessage callback
   *
   * @param data - Raw JSON message string from WebSocket
   * @private Callback from ConnectionLifecycleManager
   */
  private handleMessage(data: string): void {
    this.heartbeatManager.recordMessage(); // Any message counts as "alive"
    this.messageRouter.route(data);
  }

  /**
   * Handle authentication response messages
   *
   * COORDINATION:
   * - Called by MessageRouter.onAuthResponse callback
   * - Delegates to AuthenticationManager to update auth state
   * - On auth-ok: triggers message queue flush
   *
   * AUTH STATE TRANSITIONS:
   * - auth-ok: PENDING → AUTHENTICATED (+ flush queue)
   * - auth-failed: PENDING → FAILED (no queue flush)
   *
   * MESSAGE QUEUE FLUSH:
   * - Only flushes on successful authentication (auth-ok)
   * - Ensures queued messages are sent with valid auth
   * - MessageQueueManager checks canSendImmediately() for each message
   *
   * @param message - Auth response message (auth-ok or auth-failed)
   * @private Callback from MessageRouter
   */
  private handleAuthResponse(message: AuthResponseMessage): void {
    this.authManager.handleAuthResponse(message);

    // Flush message queue on successful authentication
    if (message.t === "auth-ok") {
      this.flushMessageQueue();
    }
  }

  /**
   * Flush queued messages to server
   *
   * COORDINATION:
   * - Delegates to MessageQueueManager.flush()
   * - Provides WebSocket instance from ConnectionLifecycleManager
   * - Provides canSendImmediately() predicate for send decisions
   *
   * FLUSH BEHAVIOR:
   * - Processes queue in FIFO order
   * - For each message: checks canSendImmediately()
   * - If can send: sends immediately
   * - If cannot send: stops flushing (re-queues remaining)
   *
   * @private Called after successful authentication
   */
  private flushMessageQueue(): void {
    this.messageQueueManager.flush(this.connectionManager.getWebSocket(), () =>
      this.canSendImmediately(),
    );
  }

  /**
   * Check if message can be sent immediately (vs queued)
   *
   * SEND CRITERIA (all must be true):
   * 1. WebSocket instance exists (not null)
   * 2. WebSocket.readyState is OPEN (connection established)
   * 3. ConnectionState is CONNECTED (lifecycle manager confirms)
   * 4. AuthState is AUTHENTICATED (auth manager confirms)
   *
   * USED BY:
   * - MessageQueueManager.send() - decide send vs queue
   * - MessageQueueManager.flush() - decide continue vs stop
   *
   * EXCEPTIONS (bypass this check):
   * - authenticate messages (always sent immediately)
   * - heartbeat messages when not authenticated (dropped, not queued)
   *
   * @returns true if all send criteria met, false otherwise
   * @private Helper for MessageQueueManager
   */
  private canSendImmediately(): boolean {
    const ws = this.connectionManager.getWebSocket();
    return (
      ws !== null &&
      ws.readyState === WebSocket.OPEN &&
      this.connectionManager.getState() === ConnectionState.CONNECTED &&
      this.authManager.isAuthenticated()
    );
  }
}
