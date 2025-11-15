// ============================================================================
// WEBSOCKET SERVICE
// ============================================================================
// Manages WebSocket connection with automatic reconnection, heartbeat,
// and message routing. Follows best practices from:
// - https://medium.com/@voodooengineering/websocket-integration-checklist
// - https://ably.com/topic/websocket-architecture

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
 * WebSocket service that manages connection lifecycle
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Heartbeat to detect broken connections
 * - Connection state management
 * - Message queueing during disconnection
 * - Clean separation of concerns
 */
export class WebSocketService {
  private config: Required<WebSocketServiceConfig>;
  private messageRouter: MessageRouter;
  private authManager: AuthenticationManager;
  private messageQueueManager: MessageQueueManager;
  private heartbeatManager: HeartbeatManager;
  private connectionManager: ConnectionLifecycleManager;

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

    // Initialize AuthenticationManager
    this.authManager = new AuthenticationManager({
      onAuthEvent: this.config.onAuthEvent,
    });

    // Initialize MessageRouter with callbacks
    this.messageRouter = new MessageRouter({
      onMessage: this.config.onMessage,
      onRtcSignal: this.config.onRtcSignal,
      onAuthResponse: this.handleAuthResponse.bind(this),
      onControlMessage: this.config.onControlMessage,
    });

    // Initialize MessageQueueManager
    this.messageQueueManager = new MessageQueueManager({
      maxQueueSize: 200,
    });

    // Initialize HeartbeatManager
    this.heartbeatManager = new HeartbeatManager({
      heartbeatInterval: this.config.heartbeatInterval,
      onTimeout: () => this.connectionManager.getWebSocket()?.close(),
      getAuthState: () => this.authManager.getAuthState(),
    });

    // Initialize ConnectionLifecycleManager
    this.connectionManager = new ConnectionLifecycleManager({
      url: this.config.url,
      uid: this.config.uid,
      reconnectInterval: this.config.reconnectInterval,
      maxReconnectAttempts: this.config.maxReconnectAttempts,
      onStateChange: this.config.onStateChange,
      onOpen: this.handleOpen.bind(this),
      onMessage: this.handleMessage.bind(this),
    });
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    this.authManager.reset();
    this.connectionManager.connect();
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.authManager.reset();
    this.heartbeatManager.stop();
    this.connectionManager.disconnect();
  }

  /**
   * Send a message to the server
   * Messages are queued if not connected and sent when reconnected
   */
  send(message: ClientMessage): void {
    // Log additional context for debugging
    if (message.t !== "authenticate" && message.t !== "heartbeat") {
      console.log(
        `[WebSocket] send() called for message type=${message.t}, authState=${this.authManager.getAuthState()}, connectionState=${this.connectionManager.getState()}`,
      );
    }

    // Delegate to MessageQueueManager
    this.messageQueueManager.send(
      message,
      this.connectionManager.getWebSocket(),
      () => this.canSendImmediately(),
    );
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.connectionManager.getState();
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.connectionManager.isConnected();
  }

  /**
   * Attempt to authenticate the current WebSocket session
   */
  authenticate(secret: string, roomId?: string): void {
    this.authManager.authenticate(this.connectionManager.getWebSocket(), secret, roomId);
  }

  // =========================================================================
  // PRIVATE METHODS
  // =========================================================================

  /**
   * Handle WebSocket connection open event
   * Called by ConnectionLifecycleManager when connection is established
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
   * Delegates to MessageRouter for parsing and routing
   */
  private handleMessage(data: string): void {
    this.heartbeatManager.recordMessage(); // Any message counts as "alive"
    this.messageRouter.route(data);
  }

  /**
   * Handle authentication response messages
   * Called by MessageRouter when auth-ok or auth-failed is received
   */
  private handleAuthResponse(message: AuthResponseMessage): void {
    this.authManager.handleAuthResponse(message);

    // Flush message queue on successful authentication
    if (message.t === "auth-ok") {
      this.flushMessageQueue();
    }
  }

  private flushMessageQueue(): void {
    // Delegate to MessageQueueManager
    this.messageQueueManager.flush(
      this.connectionManager.getWebSocket(),
      () => this.canSendImmediately(),
    );
  }

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
