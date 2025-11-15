/**
 * RTCSignalHandler
 *
 * Handles WebRTC signaling between peers.
 * Forwards RTC signals (offer, answer, ICE candidates) from one client to another.
 *
 * Extracted from: apps/server/src/ws/messageRouter.ts (lines 865-891)
 * Extraction date: 2025-11-14
 *
 * @module ws/handlers/RTCSignalHandler
 */

import type { WebSocket } from "ws";
import type { SignalData } from "simple-peer";

/**
 * Handler for WebRTC signaling messages
 */
export class RTCSignalHandler {
  private uidToWs: Map<string, WebSocket>;

  /**
   * Create a new RTCSignalHandler
   *
   * @param uidToWs - Map of player UIDs to WebSocket connections
   */
  constructor(uidToWs: Map<string, WebSocket>) {
    this.uidToWs = uidToWs;
  }

  /**
   * Forward a WebRTC signal from one peer to another
   *
   * Sends the signal directly to the target peer's WebSocket connection.
   * Only forwards if the target connection exists and is in OPEN state.
   *
   * @param targetUid - UID of the peer to receive the signal
   * @param fromUid - UID of the peer sending the signal
   * @param signal - WebRTC signal data (offer, answer, or ICE candidate)
   *
   * @example
   * ```typescript
   * const handler = new RTCSignalHandler(uidToWs);
   * handler.forwardSignal(
   *   "target-player",
   *   "sender-player",
   *   { type: "offer", sdp: "..." }
   * );
   * ```
   */
  forwardSignal(targetUid: string, fromUid: string, signal: SignalData): void {
    const targetWs = this.uidToWs.get(targetUid);

    // Only send if target exists and connection is open (readyState === 1)
    if (targetWs && targetWs.readyState === 1) {
      targetWs.send(
        JSON.stringify({
          t: "rtc-signal",
          from: fromUid,
          signal,
        }),
      );
    }
  }
}
