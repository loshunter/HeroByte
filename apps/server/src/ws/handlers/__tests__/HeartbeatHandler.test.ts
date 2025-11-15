/**
 * Characterization tests for HeartbeatHandler
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/server/src/ws/messageRouter.ts (lines 829-838)
 * Target: apps/server/src/ws/handlers/HeartbeatHandler.ts
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

describe("HeartbeatHandler - Characterization Tests", () => {
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

  const playerUid = "test-player-uid";
  const otherPlayerUid = "other-player-uid";

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

    // Setup players in state
    roomService.setState({
      players: [
        {
          uid: playerUid,
          name: "Test Player",
          portrait: "",
          micLevel: 0,
          lastHeartbeat: 1000, // Initial timestamp
          hp: 10,
          maxHp: 10,
          isDM: false,
          statusEffects: [],
        },
        {
          uid: otherPlayerUid,
          name: "Other Player",
          portrait: "",
          micLevel: 0,
          lastHeartbeat: 2000, // Different initial timestamp
          hp: 10,
          maxHp: 10,
          isDM: false,
          statusEffects: [],
        },
      ],
    });

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

  describe("heartbeat message handling", () => {
    it("should update player lastHeartbeat when player exists", () => {
      const beforeTimestamp = Date.now();

      const heartbeatMessage: ClientMessage = {
        t: "heartbeat",
      };

      messageRouter.route(heartbeatMessage, playerUid);

      const state = roomService.getState();
      const player = state.players.find((p) => p.uid === playerUid);

      expect(player).toBeDefined();
      expect(player!.lastHeartbeat).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(player!.lastHeartbeat).toBeLessThanOrEqual(Date.now());
    });

    it("should not crash when player does not exist", () => {
      const nonExistentUid = "non-existent-player";

      const heartbeatMessage: ClientMessage = {
        t: "heartbeat",
      };

      // Should not throw
      expect(() => {
        messageRouter.route(heartbeatMessage, nonExistentUid);
      }).not.toThrow();

      // State should remain unchanged for existing players
      const state = roomService.getState();
      const existingPlayer = state.players.find((p) => p.uid === playerUid);
      expect(existingPlayer!.lastHeartbeat).toBe(1000); // Original value
    });

    it("should only update the heartbeat for the sender player", () => {
      const beforeTimestamp = Date.now();

      const heartbeatMessage: ClientMessage = {
        t: "heartbeat",
      };

      messageRouter.route(heartbeatMessage, playerUid);

      const state = roomService.getState();
      const senderPlayer = state.players.find((p) => p.uid === playerUid);
      const otherPlayer = state.players.find((p) => p.uid === otherPlayerUid);

      // Sender's heartbeat should be updated
      expect(senderPlayer!.lastHeartbeat).toBeGreaterThanOrEqual(beforeTimestamp);

      // Other player's heartbeat should remain unchanged
      expect(otherPlayer!.lastHeartbeat).toBe(2000); // Original value
    });

    it("should update heartbeat multiple times for the same player", () => {
      const heartbeatMessage: ClientMessage = {
        t: "heartbeat",
      };

      // First heartbeat
      messageRouter.route(heartbeatMessage, playerUid);
      const state1 = roomService.getState();
      const firstHeartbeat = state1.players.find((p) => p.uid === playerUid)!.lastHeartbeat ?? 0;

      // Wait a bit
      vi.useFakeTimers();
      vi.advanceTimersByTime(100);

      // Second heartbeat
      messageRouter.route(heartbeatMessage, playerUid);
      const state2 = roomService.getState();
      const secondHeartbeat = state2.players.find((p) => p.uid === playerUid)!.lastHeartbeat ?? 0;

      vi.useRealTimers();

      // Second heartbeat should be later than first
      expect(secondHeartbeat).toBeGreaterThanOrEqual(firstHeartbeat);
    });
  });
});
