// ============================================================================
// WEBSOCKET SERVICE
// ============================================================================
// Manages WebSocket connection with automatic reconnection, heartbeat,
// and message routing. Follows best practices from:
// - https://medium.com/@voodooengineering/websocket-integration-checklist
// - https://ably.com/topic/websocket-architecture

import type { RoomSnapshot, ClientMessage, ServerMessage } from "@shared";
import type { SignalData } from "simple-peer";

type MessageHandler = (snapshot: RoomSnapshot) => void;
type RtcSignalHandler = (from: string, signal: SignalData) => void;
type ConnectionStateHandler = (state: ConnectionState) => void;

type AuthResponseMessage =
  | Extract<ServerMessage, { t: "auth-ok" }>
  | Extract<ServerMessage, { t: "auth-failed" }>;

type RtcSignalMessage = {
  t: "rtc-signal";
  from: string;
  signal: SignalData;
};

type ControlMessage =
  | Extract<ServerMessage, { t: "room-password-updated" }>
  | Extract<ServerMessage, { t: "room-password-update-failed" }>;

function isRtcSignalMessage(value: unknown): value is RtcSignalMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RtcSignalMessage>;
  return (
    candidate.t === "rtc-signal" &&
    typeof candidate.from === "string" &&
    Object.prototype.hasOwnProperty.call(candidate, "signal")
  );
}

function isAuthResponseMessage(value: unknown): value is AuthResponseMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AuthResponseMessage>;
  if (candidate.t === "auth-ok") {
    return true;
  }
  if (candidate.t === "auth-failed") {
    return true;
  }
  return false;
}

function isControlMessage(value: unknown): value is ControlMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ControlMessage>;
  return candidate.t === "room-password-updated" || candidate.t === "room-password-update-failed";
}

export enum AuthState {
  UNAUTHENTICATED = "unauthenticated",
  PENDING = "pending",
  AUTHENTICATED = "authenticated",
  FAILED = "failed",
}

export type AuthEvent =
  | { type: "reset" }
  | { type: "pending" }
  | { type: "success" }
  | { type: "failure"; reason?: string };

export enum ConnectionState {
  CONNECTING = "connecting",
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  RECONNECTING = "reconnecting",
  FAILED = "failed",
}

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
  private ws: WebSocket | null = null;
  private config: Required<WebSocketServiceConfig>;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private authState: AuthState = AuthState.UNAUTHENTICATED;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private connectTimer: number | null = null;
  private messageQueue: ClientMessage[] = [];
  private lastPongTime = Date.now();

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
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    if (this.ws && this.state === ConnectionState.CONNECTED) {
      console.warn("[WebSocket] Already connected");
      return;
    }

    this.authState = AuthState.UNAUTHENTICATED;
    this.config.onAuthEvent({ type: "reset" });

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
   */
  disconnect(): void {
    this.cleanup();
    this.authState = AuthState.UNAUTHENTICATED;
    this.config.onAuthEvent({ type: "reset" });
    this.setState(ConnectionState.DISCONNECTED);
  }

  /**
   * Send a message to the server
   * Messages are queued if not connected and sent when reconnected
   */
  send(message: ClientMessage): void {
    if (message.t === "authenticate") {
      this.sendRaw(message);
      return;
    }

    if (this.canSendImmediately()) {
      this.sendRaw(message);
      return;
    }

    if (message.t === "heartbeat") {
      // Drop heartbeat attempts until authenticated to prevent queue bloat
      return;
    }

    this.queueMessage(message);
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.state === ConnectionState.CONNECTED;
  }

  /**
   * Attempt to authenticate the current WebSocket session
   */
  authenticate(secret: string, roomId?: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[WebSocket] Cannot authenticate before socket is open");
      return;
    }

    this.authState = AuthState.PENDING;
    this.config.onAuthEvent({ type: "pending" });

    this.sendRaw({ t: "authenticate", secret, roomId });
  }

  // =========================================================================
  // PRIVATE METHODS
  // =========================================================================

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log("[WebSocket] Connected as", this.config.uid);
      this.clearConnectTimer();
      this.setState(ConnectionState.CONNECTED);
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      // Do NOT flush message queue here - wait for auth-ok response
      // Messages will be flushed after successful authentication
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.ws.onclose = (event) => {
      console.log("[WebSocket] Disconnected", event.code, event.reason);
      this.clearConnectTimer();
      this.handleDisconnect();
    };

    this.ws.onerror = (error) => {
      console.error("[WebSocket] Error:", error);
    };

    // Handle browser page visibility - reconnect when tab becomes visible
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  private handleMessage(data: string): void {
    this.lastPongTime = Date.now(); // Any message counts as "alive"

    try {
      const parsed: unknown = JSON.parse(data);

      if (isRtcSignalMessage(parsed)) {
        this.config.onRtcSignal(parsed.from, parsed.signal);
        return;
      }

      if (isAuthResponseMessage(parsed)) {
        if (parsed.t === "auth-ok") {
          this.authState = AuthState.AUTHENTICATED;
          this.config.onAuthEvent({ type: "success" });
          this.flushMessageQueue();
        } else {
          this.authState = AuthState.FAILED;
          this.config.onAuthEvent({ type: "failure", reason: parsed.reason });
        }
        return;
      }

      if (isControlMessage(parsed)) {
        this.config.onControlMessage(parsed);
        return;
      }

      // All other messages are room snapshots
      const snapshot = parsed as RoomSnapshot;

      // Debug: Log initiative values when snapshot is received
      if (snapshot.characters && snapshot.characters.length > 0) {
        const withInitiative = snapshot.characters.filter(
          (c) => c.initiative !== undefined && c.initiative !== null,
        );
        if (withInitiative.length > 0) {
          console.log(
            "[WebSocket] Snapshot received with initiative data:",
            withInitiative.map((c) => ({
              id: c.id,
              name: c.name,
              initiative: c.initiative,
              initiativeModifier: c.initiativeModifier,
            })),
          );
        }
      }

      this.config.onMessage(snapshot);
    } catch (error) {
      console.error("[WebSocket] Invalid message:", error, data);
    }
  }

  private handleDisconnect(): void {
    if (this.authState !== AuthState.UNAUTHENTICATED) {
      this.authState = AuthState.UNAUTHENTICATED;
      this.config.onAuthEvent({ type: "reset" });
    }

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

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastPongTime = Date.now();

    this.heartbeatTimer = window.setInterval(() => {
      const timeSinceLastMessage = Date.now() - this.lastPongTime;

      // If no message in 2x heartbeat interval, consider connection dead
      if (
        this.authState === AuthState.AUTHENTICATED &&
        timeSinceLastMessage > this.config.heartbeatInterval * 2
      ) {
        console.warn("[WebSocket] Heartbeat timeout - reconnecting");
        this.handleDisconnect();
        return;
      }

      // Send heartbeat message (server uses this to track player activity)
      if (
        this.authState === AuthState.AUTHENTICATED &&
        this.ws &&
        this.ws.readyState === WebSocket.OPEN
      ) {
        this.ws.send(JSON.stringify({ t: "heartbeat" }));
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private flushMessageQueue(): void {
    if (!this.canSendImmediately()) {
      return;
    }

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendRaw(message);
      }
    }
  }

  private canSendImmediately(): boolean {
    return (
      this.ws !== null &&
      this.ws.readyState === WebSocket.OPEN &&
      this.state === ConnectionState.CONNECTED &&
      this.authState === AuthState.AUTHENTICATED
    );
  }

  private queueMessage(message: ClientMessage): void {
    if (this.messageQueue.length >= 200) {
      this.messageQueue.shift();
    }
    this.messageQueue.push(message);
  }

  private sendRaw(message: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.queueMessage(message);
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error("[WebSocket] Send error:", error);
      this.queueMessage(message);
    }
  }

  private cleanup(): void {
    this.stopHeartbeat();
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

    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
  }

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === "visible" && !this.isConnected()) {
      console.log("[WebSocket] Tab visible - attempting reconnect");
      this.connect();
    }
  };

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

  private clearConnectTimer(): void {
    if (this.connectTimer !== null) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.config.onStateChange(newState);
      console.log("[WebSocket] State:", newState);
    }
  }
}
