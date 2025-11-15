/**
 * Characterization tests for PointerHandler
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/server/src/ws/messageRouter.ts (lines 599-602)
 * - Uses MapService.placePointer() (apps/server/src/domains/map/service.ts:98-105)
 *
 * Target: apps/server/src/ws/handlers/PointerHandler.ts
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

describe("PointerHandler - Characterization Tests", () => {
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

  const playerUid = "test-player-123";
  const otherPlayerUid = "other-player-456";

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
    mockGetAuthorizedClients = vi.fn(() => new Set());

    // Setup players in state
    roomService.setState({
      players: [
        {
          uid: playerUid,
          name: "Test Player",
          portrait: "",
          micLevel: 0,
          lastHeartbeat: Date.now(),
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
          lastHeartbeat: Date.now(),
          hp: 10,
          maxHp: 10,
          isDM: false,
          statusEffects: [],
        },
      ],
      pointers: [], // Start with no pointers
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

  describe("point message handling", () => {
    it("should add pointer when player exists", () => {
      const pointMessage: ClientMessage = {
        t: "point",
        x: 100,
        y: 200,
      };

      messageRouter.route(pointMessage, playerUid);

      const state = roomService.getState();
      expect(state.pointers).toHaveLength(1);

      const pointer = state.pointers[0];
      expect(pointer.uid).toBe(playerUid);
      expect(pointer.x).toBe(100);
      expect(pointer.y).toBe(200);
      expect(pointer.name).toBe("Test Player");
      expect(pointer.timestamp).toBeDefined();
      expect(pointer.id).toBeDefined();
      expect(pointer.id).toMatch(new RegExp(`^${playerUid}-\\d+$`));
    });

    it("should use uid prefix as name when player does not exist", () => {
      const nonExistentUid = "unknown-player-789";
      const pointMessage: ClientMessage = {
        t: "point",
        x: 50,
        y: 75,
      };

      messageRouter.route(pointMessage, nonExistentUid);

      const state = roomService.getState();
      expect(state.pointers).toHaveLength(1);

      const pointer = state.pointers[0];
      expect(pointer.uid).toBe(nonExistentUid);
      expect(pointer.name).toBe("unknow"); // First 6 chars
    });

    it("should support multiple pointers from same player", () => {
      vi.useFakeTimers();
      vi.setSystemTime(1000000);

      const firstPoint: ClientMessage = {
        t: "point",
        x: 10,
        y: 20,
      };

      messageRouter.route(firstPoint, playerUid);

      vi.advanceTimersByTime(1); // Advance 1ms to ensure different timestamp

      const secondPoint: ClientMessage = {
        t: "point",
        x: 30,
        y: 40,
      };

      messageRouter.route(secondPoint, playerUid);

      vi.useRealTimers();

      const state = roomService.getState();
      expect(state.pointers).toHaveLength(2);

      expect(state.pointers[0].uid).toBe(playerUid);
      expect(state.pointers[0].x).toBe(10);
      expect(state.pointers[0].y).toBe(20);

      expect(state.pointers[1].uid).toBe(playerUid);
      expect(state.pointers[1].x).toBe(30);
      expect(state.pointers[1].y).toBe(40);

      // IDs should be different (based on timestamp)
      expect(state.pointers[0].id).not.toBe(state.pointers[1].id);
    });

    it("should support pointers from different players", () => {
      const playerOnePoint: ClientMessage = {
        t: "point",
        x: 100,
        y: 100,
      };

      const playerTwoPoint: ClientMessage = {
        t: "point",
        x: 200,
        y: 200,
      };

      messageRouter.route(playerOnePoint, playerUid);
      messageRouter.route(playerTwoPoint, otherPlayerUid);

      const state = roomService.getState();
      expect(state.pointers).toHaveLength(2);

      const pointer1 = state.pointers.find((p) => p.uid === playerUid);
      const pointer2 = state.pointers.find((p) => p.uid === otherPlayerUid);

      expect(pointer1).toBeDefined();
      expect(pointer1!.name).toBe("Test Player");
      expect(pointer1!.x).toBe(100);

      expect(pointer2).toBeDefined();
      expect(pointer2!.name).toBe("Other Player");
      expect(pointer2!.x).toBe(200);
    });

    it("should create unique pointer IDs based on timestamp", () => {
      vi.useFakeTimers();
      vi.setSystemTime(1000000);

      const point1: ClientMessage = {
        t: "point",
        x: 10,
        y: 10,
      };

      messageRouter.route(point1, playerUid);

      vi.advanceTimersByTime(100);

      const point2: ClientMessage = {
        t: "point",
        x: 20,
        y: 20,
      };

      messageRouter.route(point2, playerUid);

      vi.useRealTimers();

      const state = roomService.getState();
      const ids = state.pointers.map((p) => p.id);

      // IDs should be unique
      expect(ids[0]).not.toBe(ids[1]);
      // Both should start with playerUid
      expect(ids[0]).toMatch(new RegExp(`^${playerUid}-`));
      expect(ids[1]).toMatch(new RegExp(`^${playerUid}-`));
    });

    it("should handle negative coordinates", () => {
      const pointMessage: ClientMessage = {
        t: "point",
        x: -50,
        y: -100,
      };

      messageRouter.route(pointMessage, playerUid);

      const state = roomService.getState();
      const pointer = state.pointers[0];

      expect(pointer.x).toBe(-50);
      expect(pointer.y).toBe(-100);
    });

    it("should handle zero coordinates", () => {
      const pointMessage: ClientMessage = {
        t: "point",
        x: 0,
        y: 0,
      };

      messageRouter.route(pointMessage, playerUid);

      const state = roomService.getState();
      const pointer = state.pointers[0];

      expect(pointer.x).toBe(0);
      expect(pointer.y).toBe(0);
    });
  });
});
