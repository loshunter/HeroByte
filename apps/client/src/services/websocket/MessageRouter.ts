/**
 * MessageRouter
 *
 * Handles parsing, type-checking, and routing of inbound WebSocket messages.
 *
 * Responsibilities:
 * - Parse JSON message strings from WebSocket
 * - Type-guard different message types (RTC, auth, control, snapshot)
 * - Route messages to appropriate callback handlers
 * - Handle debug logging for snapshots with initiative data
 * - Error handling for invalid JSON
 *
 * Extracted from: apps/client/src/services/websocket.ts
 * Lines: 270-323 (handleMessage), 34-67 (type guards)
 *
 * @see CLIENT_WEBSOCKET_PLAN.md - Manager 5: MessageRouter
 */

import type { DragPreviewEvent, Pointer, RoomSnapshot, ServerMessage } from "@shared";
import type { SignalData } from "simple-peer";

/**
 * RTC Signal message type
 * Contains peer-to-peer WebRTC signaling data
 */
type RtcSignalMessage = {
  t: "rtc-signal";
  from: string;
  signal: SignalData;
};

/**
 * Authentication response message types
 * Server responses to authentication attempts
 */
type AuthResponseMessage =
  | Extract<ServerMessage, { t: "auth-ok" }>
  | Extract<ServerMessage, { t: "auth-failed" }>;

/**
 * Control message types
 * Server-initiated control/status messages
 */
type ControlMessage =
  | Extract<ServerMessage, { t: "room-password-updated" }>
  | Extract<ServerMessage, { t: "room-password-update-failed" }>
  | Extract<ServerMessage, { t: "dm-status" }>
  | Extract<ServerMessage, { t: "dm-elevation-failed" }>
  | Extract<ServerMessage, { t: "dm-password-updated" }>
  | Extract<ServerMessage, { t: "dm-password-update-failed" }>;

type HeartbeatAckMessage = Extract<ServerMessage, { t: "heartbeat-ack" }>;

type DeltaMessage = Extract<ServerMessage, { t: "token-updated" }>;

type PointerPreviewMessage = Extract<ServerMessage, { t: "pointer-preview" }>;

type DragPreviewMessage = Extract<ServerMessage, { t: "drag-preview" }>;

type AckMessage = Extract<ServerMessage, { t: "ack" }>;
type NackMessage = Extract<ServerMessage, { t: "nack" }>;

/**
 * Configuration for MessageRouter
 */
export interface MessageRouterConfig {
  /**
   * Callback for room snapshot messages
   * Called for all messages that aren't RTC, auth, or control messages
   */
  onMessage: (snapshot: RoomSnapshot) => void;

  /**
   * Optional callback for RTC signaling messages
   * @param from - Peer ID sending the signal
   * @param signal - WebRTC signal data
   */
  onRtcSignal?: (from: string, signal: SignalData) => void;

  /**
   * Optional callback for authentication response messages
   * @param message - Auth-ok or auth-failed message
   */
  onAuthResponse?: (message: AuthResponseMessage) => void;

  /**
   * Optional callback for control/status messages
   * @param message - Control message from server
   */
  onControlMessage?: (message: ControlMessage) => void;

  /**
   * Optional callback for delta messages (partial updates)
   * @param message - Delta message from server
   */
  onDelta?: (message: DeltaMessage) => void;

  /**
   * Optional callback for pointer preview messages
   */
  onPointerPreview?: (pointer: Pointer) => void;

  /**
   * Optional callback for drag preview messages
   */
  onDragPreview?: (preview: DragPreviewEvent) => void;

  /**
   * Optional callback for heartbeat acknowledgements
   * @param timestamp - Server timestamp when ack was emitted
   */
  onHeartbeatAck?: (timestamp: number) => void;

  /**
   * Optional callback for command acknowledgements
   */
  onAck?: (commandId: string) => void;

  /**
   * Optional callback for command rejections
   */
  onNack?: (commandId: string, reason?: string) => void;
}

/**
 * MessageRouter
 *
 * Routes inbound WebSocket messages to appropriate handlers based on message type.
 *
 * Message routing priority:
 * 1. RTC signals (peer-to-peer communication)
 * 2. Authentication responses (auth-ok, auth-failed)
 * 3. Control messages (server status/control)
 * 4. Room snapshots (default - all other messages)
 *
 * Features:
 * - Type-safe message routing with TypeScript type guards
 * - Graceful error handling for invalid JSON
 * - Debug logging for initiative data in snapshots
 * - Optional callbacks (gracefully handles undefined handlers)
 *
 * @example
 * ```typescript
 * const router = new MessageRouter({
 *   onMessage: (snapshot) => updateGameState(snapshot),
 *   onRtcSignal: (from, signal) => handlePeerSignal(from, signal),
 *   onAuthResponse: (msg) => handleAuth(msg),
 *   onControlMessage: (msg) => handleControl(msg),
 * });
 *
 * // Route incoming WebSocket message
 * router.route(event.data);
 * ```
 */
export class MessageRouter {
  private config: MessageRouterConfig;

  /**
   * Create a new MessageRouter
   *
   * @param config - Router configuration with message handlers
   */
  constructor(config: MessageRouterConfig) {
    this.config = config;
  }

  /**
   * Route an inbound WebSocket message to the appropriate handler
   *
   * Parses JSON and dispatches to handlers based on message type.
   * Invalid JSON is logged but does not throw.
   *
   * @param data - Raw message string from WebSocket
   */
  route(data: string): void {
    try {
      const parsed: unknown = JSON.parse(data);

      // Route RTC signals first (highest priority)
      if (this.isRtcSignalMessage(parsed)) {
        this.handleRtcSignal(parsed);
        return;
      }

      // Route authentication responses
      if (this.isAuthResponseMessage(parsed)) {
        this.handleAuthResponse(parsed);
        return;
      }

      // Route control messages
      if (this.isControlMessage(parsed)) {
        this.handleControlMessage(parsed);
        return;
      }

      // Route delta messages (partial updates)
      if (this.isDeltaMessage(parsed)) {
        this.handleDeltaMessage(parsed);
        return;
      }

      if (this.isPointerPreviewMessage(parsed)) {
        this.handlePointerPreviewMessage(parsed);
        return;
      }

      if (this.isDragPreviewMessage(parsed)) {
        this.handleDragPreviewMessage(parsed);
        return;
      }

      // Route heartbeat acknowledgements
      if (this.isHeartbeatAckMessage(parsed)) {
        this.handleHeartbeatAck(parsed);
        return;
      }

      if (this.isAckMessage(parsed)) {
        this.handleAck(parsed);
        return;
      }

      if (this.isNackMessage(parsed)) {
        this.handleNack(parsed);
        return;
      }

      // All other messages are room snapshots
      this.handleSnapshot(parsed as RoomSnapshot);
    } catch (error) {
      // Invalid JSON - log and ignore (does NOT throw)
      console.error("[WebSocket] Invalid message:", error, data);
    }
  }

  // =========================================================================
  // TYPE GUARDS
  // =========================================================================

  /**
   * Type guard for RTC signal messages
   *
   * Validates that message has:
   * - t: "rtc-signal"
   * - from: string (peer ID)
   * - signal: SignalData object
   *
   * @param value - Unknown value to check
   * @returns True if value is a valid RTC signal message
   */
  private isRtcSignalMessage(value: unknown): value is RtcSignalMessage {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<RtcSignalMessage>;
    return (
      candidate.t === "rtc-signal" &&
      typeof candidate.from === "string" &&
      Object.prototype.hasOwnProperty.call(candidate, "signal")
    );
  }

  /**
   * Type guard for authentication response messages
   *
   * Validates that message is either:
   * - { t: "auth-ok" }
   * - { t: "auth-failed", reason?: string }
   *
   * @param value - Unknown value to check
   * @returns True if value is an auth response message
   */
  private isAuthResponseMessage(value: unknown): value is AuthResponseMessage {
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

  /**
   * Type guard for control messages
   *
   * Validates that message type is one of:
   * - room-password-updated
   * - room-password-update-failed
   * - dm-status
   * - dm-elevation-failed
   * - dm-password-updated
   * - dm-password-update-failed
   *
   * @param value - Unknown value to check
   * @returns True if value is a control message
   */
  private isControlMessage(value: unknown): value is ControlMessage {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<ControlMessage>;
    return (
      candidate.t === "room-password-updated" ||
      candidate.t === "room-password-update-failed" ||
      candidate.t === "dm-status" ||
      candidate.t === "dm-elevation-failed" ||
      candidate.t === "dm-password-updated" ||
      candidate.t === "dm-password-update-failed"
    );
  }

  /**
   * Type guard for delta messages
   */
  private isDeltaMessage(value: unknown): value is DeltaMessage {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<DeltaMessage>;
    return candidate.t === "token-updated" && typeof candidate.stateVersion === "number";
  }

  private isPointerPreviewMessage(value: unknown): value is PointerPreviewMessage {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<PointerPreviewMessage>;
    return candidate.t === "pointer-preview" && Boolean(candidate.pointer);
  }

  private isDragPreviewMessage(value: unknown): value is DragPreviewMessage {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<DragPreviewMessage>;
    return candidate.t === "drag-preview" && Boolean(candidate.preview);
  }

  /**
   * Type guard for heartbeat acknowledgement messages
   */
  private isHeartbeatAckMessage(value: unknown): value is HeartbeatAckMessage {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<HeartbeatAckMessage>;
    return candidate.t === "heartbeat-ack" && typeof candidate.timestamp === "number";
  }

  private isAckMessage(value: unknown): value is AckMessage {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<AckMessage>;
    return candidate.t === "ack" && typeof candidate.commandId === "string";
  }

  private isNackMessage(value: unknown): value is NackMessage {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<NackMessage>;
    return candidate.t === "nack" && typeof candidate.commandId === "string";
  }

  // =========================================================================
  // MESSAGE HANDLERS
  // =========================================================================

  /**
   * Handle RTC signal message
   *
   * Routes WebRTC peer-to-peer signaling data to the onRtcSignal callback.
   * Gracefully handles undefined callback.
   *
   * @param message - Validated RTC signal message
   */
  private handleRtcSignal(message: RtcSignalMessage): void {
    this.config.onRtcSignal?.(message.from, message.signal);
  }

  /**
   * Handle authentication response message
   *
   * Routes auth-ok or auth-failed messages to the onAuthResponse callback.
   * Gracefully handles undefined callback.
   *
   * @param message - Validated auth response message
   */
  private handleAuthResponse(message: AuthResponseMessage): void {
    this.config.onAuthResponse?.(message);
  }

  /**
   * Handle control message
   *
   * Routes server control/status messages to the onControlMessage callback.
   * Gracefully handles undefined callback.
   *
   * @param message - Validated control message
   */
  private handleControlMessage(message: ControlMessage): void {
    this.config.onControlMessage?.(message);
  }

  /**
   * Handle delta messages
   */
  private handleDeltaMessage(message: DeltaMessage): void {
    this.config.onDelta?.(message);
  }

  private handlePointerPreviewMessage(message: PointerPreviewMessage): void {
    this.config.onPointerPreview?.(message.pointer);
  }

  private handleDragPreviewMessage(message: DragPreviewMessage): void {
    this.config.onDragPreview?.(message.preview);
  }

  /**
   * Handle heartbeat acknowledgement message
   */
  private handleHeartbeatAck(message: HeartbeatAckMessage): void {
    this.config.onHeartbeatAck?.(message.timestamp);
  }

  private handleAck(message: AckMessage): void {
    this.config.onAck?.(message.commandId);
  }

  private handleNack(message: NackMessage): void {
    this.config.onNack?.(message.commandId, message.reason);
  }

  /**
   * Handle room snapshot message
   *
   * Routes room state snapshots to the onMessage callback.
   * Logs debug information for snapshots containing initiative data.
   *
   * @param snapshot - Room snapshot data
   */
  private handleSnapshot(snapshot: RoomSnapshot): void {
    // Debug: Log initiative values when snapshot is received
    // Only access .characters if snapshot is a valid object
    if (
      snapshot &&
      typeof snapshot === "object" &&
      "characters" in snapshot &&
      Array.isArray(snapshot.characters) &&
      snapshot.characters.length > 0
    ) {
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
  }
}
