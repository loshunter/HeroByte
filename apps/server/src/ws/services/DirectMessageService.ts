// ============================================================================
// DIRECT MESSAGE SERVICE
// ============================================================================
// Manages sending control messages to specific WebSocket clients
// Extracted from: apps/server/src/ws/messageRouter.ts

import type { WebSocket } from "ws";
import type { ServerMessage } from "@shared";

/**
 * Service responsible for sending direct messages to specific WebSocket clients.
 *
 * This service handles point-to-point messaging where the server needs to send
 * a control message to a specific client identified by their UID. It ensures
 * messages are only sent when the client connection is in the OPEN state.
 *
 * **Responsibilities:**
 * - Send control messages to specific clients by UID
 * - Verify client connection state before sending
 * - Serialize messages to JSON format
 *
 * **Single Responsibility Principle (SRP):**
 * This service has ONE clear responsibility: send messages to individual clients.
 * It does NOT handle broadcasting, message routing, or client management.
 *
 * **Separation of Concerns (SoC):**
 * - Message delivery is separated from message creation
 * - Connection state validation is separated from routing logic
 * - Client lookup is delegated to the provided UID-to-WebSocket map
 *
 * @example
 * ```typescript
 * const messageSender = new DirectMessageService(uidToWsMap);
 *
 * // Send control message to specific client
 * messageSender.sendControlMessage("player-123", {
 *   t: "elevate-to-dm",
 *   uid: "player-123"
 * });
 * ```
 */
export class DirectMessageService {
  private uidToWs: Map<string, WebSocket>;

  /**
   * Create a new DirectMessageService
   *
   * @param uidToWs - Map from client UID to their WebSocket connection
   */
  constructor(uidToWs: Map<string, WebSocket>) {
    this.uidToWs = uidToWs;
  }

  /**
   * Send a control message to a specific client by their UID.
   *
   * The message will only be sent if:
   * 1. A WebSocket connection exists for the target UID
   * 2. The WebSocket connection is in the OPEN state (readyState === 1)
   *
   * If either condition is not met, the method silently returns without
   * sending the message. This graceful failure mode prevents errors when
   * clients disconnect or are not yet connected.
   *
   * **WebSocket ReadyState Values:**
   * - 0 (CONNECTING): Connection is being established
   * - 1 (OPEN): Connection is open and ready to communicate
   * - 2 (CLOSING): Connection is in the process of closing
   * - 3 (CLOSED): Connection is closed
   *
   * @param targetUid - The UID of the client to send the message to
   * @param message - The server message to send
   *
   * @example
   * ```typescript
   * // Send DM elevation notification
   * service.sendControlMessage("player-456", {
   *   t: "elevate-to-dm",
   *   uid: "player-456"
   * });
   *
   * // Send state update to specific client
   * service.sendControlMessage("dm-123", {
   *   t: "state",
   *   state: roomState
   * });
   * ```
   */
  sendControlMessage(targetUid: string, message: ServerMessage): void {
    // Lookup the WebSocket connection for this UID
    const ws = this.uidToWs.get(targetUid);

    // Only send if connection exists and is OPEN (readyState === 1)
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Check if a client connection exists and is ready to receive messages.
   *
   * @param targetUid - The UID of the client to check
   * @returns True if the client exists and connection is OPEN
   *
   * @example
   * ```typescript
   * if (service.isClientReady("player-123")) {
   *   service.sendControlMessage("player-123", message);
   * }
   * ```
   */
  isClientReady(targetUid: string): boolean {
    const ws = this.uidToWs.get(targetUid);
    return ws !== undefined && ws !== null && ws.readyState === 1;
  }
}
