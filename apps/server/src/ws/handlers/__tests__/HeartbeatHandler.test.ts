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

    it("should maintain timestamp monotonicity for sequential heartbeats", () => {
      // Test that sequential heartbeats have strictly increasing timestamps
      vi.useFakeTimers();

      const heartbeatMessage: ClientMessage = {
        t: "heartbeat",
      };

      const timestamps: number[] = [];

      // Send 5 sequential heartbeats with time advancing between each
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(50); // Advance time by 50ms between heartbeats
        messageRouter.route(heartbeatMessage, playerUid);

        const state = roomService.getState();
        const player = state.players.find((p) => p.uid === playerUid);
        timestamps.push(player!.lastHeartbeat);
      }

      vi.useRealTimers();

      // Verify each timestamp is greater than or equal to the previous one
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });

    it("should handle concurrent heartbeats from multiple players without state corruption", () => {
      // Test that multiple players sending heartbeats simultaneously doesn't corrupt state
      const heartbeatMessage: ClientMessage = {
        t: "heartbeat",
      };

      const beforeTimestamp = Date.now();

      // Send heartbeats from both players "simultaneously"
      messageRouter.route(heartbeatMessage, playerUid);
      messageRouter.route(heartbeatMessage, otherPlayerUid);

      const state = roomService.getState();
      const player1 = state.players.find((p) => p.uid === playerUid);
      const player2 = state.players.find((p) => p.uid === otherPlayerUid);

      // Both players should have updated heartbeats
      expect(player1!.lastHeartbeat).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(player2!.lastHeartbeat).toBeGreaterThanOrEqual(beforeTimestamp);

      // Verify all other player state remains intact
      expect(player1!.name).toBe("Test Player");
      expect(player1!.hp).toBe(10);
      expect(player2!.name).toBe("Other Player");
      expect(player2!.hp).toBe(10);
    });

    it("should work correctly after player state changes", () => {
      // Test heartbeat works correctly after player HP/name/other changes
      const state = roomService.getState();

      // Modify player state (HP and name)
      roomService.setState({
        players: state.players.map((p) =>
          p.uid === playerUid
            ? { ...p, hp: 5, maxHp: 15, name: "Modified Player" }
            : p
        ),
      });

      const beforeTimestamp = Date.now();
      const heartbeatMessage: ClientMessage = {
        t: "heartbeat",
      };

      messageRouter.route(heartbeatMessage, playerUid);

      const updatedState = roomService.getState();
      const player = updatedState.players.find((p) => p.uid === playerUid);

      // Heartbeat should still update
      expect(player!.lastHeartbeat).toBeGreaterThanOrEqual(beforeTimestamp);

      // Other state changes should be preserved
      expect(player!.hp).toBe(5);
      expect(player!.maxHp).toBe(15);
      expect(player!.name).toBe("Modified Player");
    });

    it("should preserve all other player state fields when updating heartbeat", () => {
      // Verify heartbeat only touches lastHeartbeat field
      vi.useFakeTimers();

      const heartbeatMessage: ClientMessage = {
        t: "heartbeat",
      };

      const stateBefore = roomService.getState();
      const playerBefore = stateBefore.players.find((p) => p.uid === playerUid)!;

      // Capture initial heartbeat value
      const initialHeartbeat = playerBefore.lastHeartbeat;

      // Advance time to ensure timestamp will be different
      vi.advanceTimersByTime(100);

      messageRouter.route(heartbeatMessage, playerUid);

      const stateAfter = roomService.getState();
      const playerAfter = stateAfter.players.find((p) => p.uid === playerUid)!;

      vi.useRealTimers();

      // Only lastHeartbeat should change
      expect(playerAfter.lastHeartbeat).toBeGreaterThan(initialHeartbeat);

      // All other fields should remain exactly the same
      expect(playerAfter.uid).toBe(playerBefore.uid);
      expect(playerAfter.name).toBe(playerBefore.name);
      expect(playerAfter.portrait).toBe(playerBefore.portrait);
      expect(playerAfter.micLevel).toBe(playerBefore.micLevel);
      expect(playerAfter.hp).toBe(playerBefore.hp);
      expect(playerAfter.maxHp).toBe(playerBefore.maxHp);
      expect(playerAfter.isDM).toBe(playerBefore.isDM);
      expect(playerAfter.statusEffects).toEqual(playerBefore.statusEffects);
    });

    it("should handle edge case timestamps gracefully", () => {
      // Test behavior with very large timestamps and zero timestamps
      vi.useFakeTimers();

      const heartbeatMessage: ClientMessage = {
        t: "heartbeat",
      };

      // Set system time to a very large timestamp (year 2100+)
      const largeTimestamp = 4102444800000; // January 1, 2100
      vi.setSystemTime(new Date(largeTimestamp));

      messageRouter.route(heartbeatMessage, playerUid);

      let state = roomService.getState();
      let player = state.players.find((p) => p.uid === playerUid);

      // Should handle large timestamp without issues
      expect(player!.lastHeartbeat).toBe(largeTimestamp);

      // Set system time to epoch (zero-ish)
      vi.setSystemTime(new Date(0));

      messageRouter.route(heartbeatMessage, playerUid);

      state = roomService.getState();
      player = state.players.find((p) => p.uid === playerUid);

      // Should handle zero timestamp
      expect(player!.lastHeartbeat).toBe(0);

      vi.useRealTimers();
    });

    it("should process rapid sequential heartbeats from same player", () => {
      // Test that rapid heartbeats from same player all get processed
      vi.useFakeTimers();

      const heartbeatMessage: ClientMessage = {
        t: "heartbeat",
      };

      const timestamps: number[] = [];

      // Send 10 rapid heartbeats with only 1ms between each
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(1);
        messageRouter.route(heartbeatMessage, playerUid);

        const state = roomService.getState();
        const player = state.players.find((p) => p.uid === playerUid);
        timestamps.push(player!.lastHeartbeat);
      }

      vi.useRealTimers();

      // All heartbeats should be processed
      expect(timestamps).toHaveLength(10);

      // Each should be at least as recent as the previous
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }

      // Final timestamp should be the most recent
      const state = roomService.getState();
      const player = state.players.find((p) => p.uid === playerUid);
      expect(player!.lastHeartbeat).toBe(timestamps[timestamps.length - 1]);
    });
  });
});
