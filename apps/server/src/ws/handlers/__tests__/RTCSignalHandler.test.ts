/**
 * Characterization tests for RTCSignalHandler
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/server/src/ws/messageRouter.ts
 * - route() case "rtc-signal" (lines 865-868)
 * - forwardRtcSignal() method (lines 886-891)
 *
 * Target: apps/server/src/ws/handlers/RTCSignalHandler.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { MessageRouter } from "../../messageRouter.js";
import { RoomService } from "../../../domains/room/service.js";
import { PlayerService } from "../../../domains/player/service.js";
import { TokenService } from "../../../domains/token/service.js";
import { MapService } from "../../../domains/map/service.js";
import { DiceService } from "../../../domains/dice/service.js";
import { CharacterService } from "../../../domains/character/service.js";
import { PropService } from "../../../domains/prop/service.js";
import { SelectionService } from "../../../domains/selection/service.js";
import { AuthService } from "../../../domains/auth/service.js";
import type { ClientMessage } from "@shared";
import type { WebSocketServer, WebSocket } from "ws";

describe("RTCSignalHandler - Characterization Tests", () => {
  let messageRouter: MessageRouter;
  let roomService: RoomService;
  let playerService: PlayerService;
  let tokenService: TokenService;
  let mapService: MapService;
  let diceService: DiceService;
  let characterService: CharacterService;
  let propService: PropService;
  let selectionService: SelectionService;
  let authService: AuthService;
  let mockWss: WebSocketServer;
  let mockUidToWs: Map<string, WebSocket>;
  let mockGetAuthorizedClients: () => Set<WebSocket>;

  const senderUid = "sender-player";
  const targetUid = "target-player";

  beforeEach(() => {
    // Initialize services
    roomService = new RoomService();
    playerService = new PlayerService();
    tokenService = new TokenService();
    mapService = new MapService();
    diceService = new DiceService();
    characterService = new CharacterService();
    propService = new PropService();
    selectionService = new SelectionService();
    authService = new AuthService();

    // Mock WebSocket infrastructure
    mockWss = {} as WebSocketServer;
    mockUidToWs = new Map();
    mockGetAuthorizedClients = vi.fn(() => new Set<WebSocket>());

    // Create MessageRouter instance
    messageRouter = new MessageRouter(
      roomService,
      playerService,
      tokenService,
      mapService,
      diceService,
      characterService,
      propService,
      selectionService,
      authService,
      mockWss,
      mockUidToWs,
      mockGetAuthorizedClients,
    );
  });

  describe("rtc-signal message handling", () => {
    it("should forward signal to target when target exists and is ready", () => {
      // Mock target WebSocket (readyState 1 = OPEN)
      const mockSend = vi.fn();
      const mockTargetWs = {
        readyState: 1, // WebSocket.OPEN
        send: mockSend,
      } as unknown as WebSocket;

      mockUidToWs.set(targetUid, mockTargetWs);

      const rtcMessage: ClientMessage = {
        t: "rtc-signal",
        target: targetUid,
        signal: { type: "offer", sdp: "test-sdp" },
      };

      messageRouter.route(rtcMessage, senderUid);

      // Verify send was called with correct message
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({
          t: "rtc-signal",
          from: senderUid,
          signal: { type: "offer", sdp: "test-sdp" },
        }),
      );
    });

    it("should not send when target does not exist in map", () => {
      // Target not in map
      const rtcMessage: ClientMessage = {
        t: "rtc-signal",
        target: "non-existent-target",
        signal: { type: "offer", sdp: "test-sdp" },
      };

      // Should not throw
      expect(() => {
        messageRouter.route(rtcMessage, senderUid);
      }).not.toThrow();
    });

    it("should not send when target WebSocket is not ready (readyState !== 1)", () => {
      // Mock target WebSocket with readyState 0 (CONNECTING)
      const mockSend = vi.fn();
      const mockTargetWs = {
        readyState: 0, // WebSocket.CONNECTING
        send: mockSend,
      } as unknown as WebSocket;

      mockUidToWs.set(targetUid, mockTargetWs);

      const rtcMessage: ClientMessage = {
        t: "rtc-signal",
        target: targetUid,
        signal: { type: "offer", sdp: "test-sdp" },
      };

      messageRouter.route(rtcMessage, senderUid);

      // Verify send was NOT called
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("should not send when target WebSocket is closing (readyState 2)", () => {
      // Mock target WebSocket with readyState 2 (CLOSING)
      const mockSend = vi.fn();
      const mockTargetWs = {
        readyState: 2, // WebSocket.CLOSING
        send: mockSend,
      } as unknown as WebSocket;

      mockUidToWs.set(targetUid, mockTargetWs);

      const rtcMessage: ClientMessage = {
        t: "rtc-signal",
        target: targetUid,
        signal: { type: "offer", sdp: "test-sdp" },
      };

      messageRouter.route(rtcMessage, senderUid);

      // Verify send was NOT called
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("should not send when target WebSocket is closed (readyState 3)", () => {
      // Mock target WebSocket with readyState 3 (CLOSED)
      const mockSend = vi.fn();
      const mockTargetWs = {
        readyState: 3, // WebSocket.CLOSED
        send: mockSend,
      } as unknown as WebSocket;

      mockUidToWs.set(targetUid, mockTargetWs);

      const rtcMessage: ClientMessage = {
        t: "rtc-signal",
        target: targetUid,
        signal: { type: "offer", sdp: "test-sdp" },
      };

      messageRouter.route(rtcMessage, senderUid);

      // Verify send was NOT called
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("should forward different signal types correctly", () => {
      const mockSend = vi.fn();
      const mockTargetWs = {
        readyState: 1,
        send: mockSend,
      } as unknown as WebSocket;

      mockUidToWs.set(targetUid, mockTargetWs);

      // Test with "answer" type signal
      const answerMessage: ClientMessage = {
        t: "rtc-signal",
        target: targetUid,
        signal: { type: "answer", sdp: "answer-sdp" },
      };

      messageRouter.route(answerMessage, senderUid);

      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({
          t: "rtc-signal",
          from: senderUid,
          signal: { type: "answer", sdp: "answer-sdp" },
        }),
      );
    });

    it("should preserve sender UID in forwarded message", () => {
      const mockSend = vi.fn();
      const mockTargetWs = {
        readyState: 1,
        send: mockSend,
      } as unknown as WebSocket;

      mockUidToWs.set(targetUid, mockTargetWs);

      const differentSender = "different-sender-uid";
      const rtcMessage: ClientMessage = {
        t: "rtc-signal",
        target: targetUid,
        signal: { type: "offer", sdp: "test-sdp" },
      };

      messageRouter.route(rtcMessage, differentSender);

      // Verify the "from" field matches the actual sender
      const sentMessage = JSON.parse(mockSend.mock.calls[0][0]);
      expect(sentMessage.from).toBe(differentSender);
    });
  });
});
