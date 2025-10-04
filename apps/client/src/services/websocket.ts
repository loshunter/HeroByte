// ============================================================================
// WEBSOCKET SERVICE
// ============================================================================
// Manages WebSocket connection with automatic reconnection, heartbeat,
// and message routing. Follows best practices from:
// - https://medium.com/@voodooengineering/websocket-integration-checklist
// - https://ably.com/topic/websocket-architecture

import type { RoomSnapshot, ClientMessage } from "@shared";

type MessageHandler = (snapshot: RoomSnapshot) => void;
type RtcSignalHandler = (from: string, signal: any) => void;
type ConnectionStateHandler = (state: ConnectionState) => void;

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
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private messageQueue: ClientMessage[] = [];
  private lastPongTime = Date.now();

  constructor(config: WebSocketServiceConfig) {
    this.config = {
      reconnectInterval: 2000,
      maxReconnectAttempts: 0, // infinite
      heartbeatInterval: 25000, // 25 seconds (matches server)
      onRtcSignal: () => {},
      onStateChange: () => {},
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

    this.setState(ConnectionState.CONNECTING);
    const url = `${this.config.url}?uid=${this.config.uid}`;

    try {
      this.ws = new WebSocket(url);
      this.setupEventHandlers();
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
    this.setState(ConnectionState.DISCONNECTED);
  }

  /**
   * Send a message to the server
   * Messages are queued if not connected and sent when reconnected
   */
  send(message: ClientMessage): void {
    if (this.ws && this.state === ConnectionState.CONNECTED) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error("[WebSocket] Send error:", error);
        // Queue message for retry
        this.messageQueue.push(message);
      }
    } else {
      // Queue message to send when connected
      this.messageQueue.push(message);
      console.warn("[WebSocket] Message queued (not connected):", message);
    }
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

  // =========================================================================
  // PRIVATE METHODS
  // =========================================================================

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log("[WebSocket] Connected as", this.config.uid);
      this.setState(ConnectionState.CONNECTED);
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.flushMessageQueue();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.ws.onclose = (event) => {
      console.log("[WebSocket] Disconnected", event.code, event.reason);
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
      const msg = JSON.parse(data);

      // Route RTC signaling messages
      if (msg.t === "rtc-signal") {
        this.config.onRtcSignal(msg.from, msg.signal);
        return;
      }

      // All other messages are room snapshots
      this.config.onMessage(msg as RoomSnapshot);
    } catch (error) {
      console.error("[WebSocket] Invalid message:", error, data);
    }
  }

  private handleDisconnect(): void {
    this.cleanup();

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
      if (timeSinceLastMessage > this.config.heartbeatInterval * 2) {
        console.warn("[WebSocket] Heartbeat timeout - reconnecting");
        this.handleDisconnect();
        return;
      }

      // Send heartbeat message (server uses this to track player activity)
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
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
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  private cleanup(): void {
    this.stopHeartbeat();

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

  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.config.onStateChange(newState);
      console.log("[WebSocket] State:", newState);
    }
  }
}
