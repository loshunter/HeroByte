/**
 * MessageQueueManager
 *
 * Manages outbound message queue and send logic for WebSocket connections.
 *
 * Responsibilities:
 * - Decide whether to send immediately or queue (based on auth/connection state)
 * - Handle special cases (authenticate messages always send immediately)
 * - Drop heartbeats if not authenticated yet (prevent queue bloat)
 * - Maintain message queue with size limit
 * - Flush queue when conditions allow
 * - Error handling for send failures (queue fallback)
 *
 * Single Responsibility Principle:
 * This manager is solely responsible for message queueing and sending logic.
 * It does NOT handle:
 * - WebSocket connection lifecycle (ConnectionLifecycleManager)
 * - Authentication state (AuthenticationManager)
 * - Message routing (MessageRouter)
 * - Heartbeat timing (HeartbeatManager)
 *
 * Extracted from: apps/client/src/services/websocket.ts
 * - send() method (lines 145-172)
 * - sendRaw() method (lines 359-375)
 * - queueMessage() method (lines 352-357)
 * - flushMessageQueue() method (lines 324-341)
 * - canSendImmediately() method (lines 343-350)
 * - messageQueue property (line 77)
 */

import type { ClientMessage } from "@shared";

/**
 * Configuration for MessageQueueManager
 */
export interface MessageQueueManagerConfig {
  /**
   * Maximum number of messages to queue before dropping oldest
   * Default: 200
   */
  maxQueueSize?: number;
}

/**
 * MessageQueueManager
 *
 * Manages the outbound message queue for WebSocket connections.
 *
 * Features:
 * - Intelligent send decision logic (immediate vs queued)
 * - Special handling for authenticate and heartbeat messages
 * - FIFO queue with configurable size limit
 * - Automatic queue flushing when conditions allow
 * - Error handling with queue fallback
 *
 * @example
 * ```typescript
 * const queueManager = new MessageQueueManager({ maxQueueSize: 200 });
 *
 * // Send message (will queue if not ready)
 * queueManager.send(message, ws, () => isAuthenticated());
 *
 * // Flush queue after authentication
 * queueManager.flush(ws, () => isAuthenticated());
 *
 * // Check queue state
 * console.log(`Queue has ${queueManager.getQueueLength()} messages`);
 * ```
 */
export class MessageQueueManager {
  private messageQueue: ClientMessage[] = [];
  private readonly maxQueueSize: number;

  constructor(config: MessageQueueManagerConfig = {}) {
    this.maxQueueSize = config.maxQueueSize ?? 200;
  }

  /**
   * Send a message to the server
   *
   * Messages are sent immediately if:
   * - Message type is "authenticate" (always bypass queue)
   * - WebSocket is open AND canSendFn() returns true
   *
   * Messages are queued if:
   * - WebSocket is not open
   * - canSendFn() returns false (not authenticated)
   *
   * Special cases:
   * - "authenticate" messages always send immediately (bypass all checks)
   * - "heartbeat" messages are dropped if canSendFn() returns false (prevent queue bloat)
   *
   * @param message - The message to send
   * @param ws - The WebSocket connection (or null if not connected)
   * @param canSendFn - Function that returns true if can send immediately (e.g., authenticated)
   */
  send(
    message: ClientMessage,
    ws: WebSocket | null,
    canSendFn: () => boolean,
  ): void {
    // Authenticate messages always send immediately
    if (message.t === "authenticate") {
      console.log("[WebSocket] Sending authenticate message immediately");
      this.sendRaw(message, ws);
      return;
    }

    const canSend = this.canSendImmediately(ws, canSendFn);
    console.log(
      `[WebSocket] send() called for message type=${message.t}, canSendImmediately=${canSend}`,
    );

    if (canSend) {
      this.sendRaw(message, ws);
      return;
    }

    // Drop heartbeat attempts until authenticated to prevent queue bloat
    if (message.t === "heartbeat") {
      console.log("[WebSocket] Dropping heartbeat message (not authenticated yet)");
      return;
    }

    console.log(
      `[WebSocket] Queueing message type=${message.t}, queue length=${this.messageQueue.length + 1}`,
    );
    this.queueMessage(message);
  }

  /**
   * Flush all queued messages to the server
   *
   * Will only flush if canSendFn() returns true.
   * Messages are sent in FIFO order.
   *
   * @param ws - The WebSocket connection (or null if not connected)
   * @param canSendFn - Function that returns true if can send (e.g., authenticated)
   */
  flush(ws: WebSocket | null, canSendFn: () => boolean): void {
    if (!this.canSendImmediately(ws, canSendFn)) {
      console.log(
        `[WebSocket] flushMessageQueue() - Cannot send, queue has ${this.messageQueue.length} messages`,
      );
      return;
    }

    console.log(
      `[WebSocket] flushMessageQueue() - Flushing ${this.messageQueue.length} queued messages`,
    );
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendRaw(message, ws);
      }
    }
  }

  /**
   * Get the current queue length
   *
   * @returns Number of messages currently queued
   */
  getQueueLength(): number {
    return this.messageQueue.length;
  }

  /**
   * Clear all queued messages
   *
   * Useful when disconnecting or resetting state.
   */
  clear(): void {
    this.messageQueue = [];
  }

  /**
   * Check if message can be sent immediately
   *
   * Returns true if:
   * - WebSocket is not null
   * - WebSocket is in OPEN state
   * - canSendFn() returns true (authenticated)
   *
   * @param ws - The WebSocket connection (or null if not connected)
   * @param canSendFn - Function that returns true if can send (e.g., authenticated)
   * @returns True if can send immediately, false otherwise
   */
  private canSendImmediately(ws: WebSocket | null, canSendFn: () => boolean): boolean {
    return ws !== null && ws.readyState === WebSocket.OPEN && canSendFn();
  }

  /**
   * Add message to queue
   *
   * If queue is full (at maxQueueSize), the oldest message is dropped.
   *
   * @param message - The message to queue
   */
  private queueMessage(message: ClientMessage): void {
    if (this.messageQueue.length >= this.maxQueueSize) {
      this.messageQueue.shift();
    }
    this.messageQueue.push(message);
  }

  /**
   * Send message directly over WebSocket
   *
   * Will queue the message if:
   * - WebSocket is null
   * - WebSocket is not in OPEN state
   * - Send throws an error
   *
   * @param message - The message to send
   * @param ws - The WebSocket connection (or null if not connected)
   */
  private sendRaw(message: ClientMessage, ws: WebSocket | null): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log(
        `[WebSocket] sendRaw() - WebSocket not ready (readyState=${ws?.readyState}), queueing message type=${message.t}`,
      );
      this.queueMessage(message);
      return;
    }

    try {
      console.log(`[WebSocket] sendRaw() - Sending message type=${message.t} over wire`);
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error("[WebSocket] Send error:", error);
      this.queueMessage(message);
    }
  }
}
