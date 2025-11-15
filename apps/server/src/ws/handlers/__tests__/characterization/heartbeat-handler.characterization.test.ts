/**
 * Characterization Tests: HeartbeatHandler
 *
 * These tests capture the CURRENT behavior of HeartbeatHandler before refactoring
 * to ensure we maintain backward compatibility during Week 8 standardization.
 *
 * Target: apps/server/src/ws/handlers/HeartbeatHandler.ts
 * Pattern: Currently returns boolean, will be refactored to return result object
 *
 * Week 8 Goal: Standardize all handlers to use RouteResultHandler pattern
 *
 * @see apps/server/src/ws/handlers/HeartbeatHandler.ts:39
 * @see apps/server/src/ws/messageRouter.ts:772-776
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { HeartbeatHandler } from "../../HeartbeatHandler.js";
import type { RoomState } from "../../../../domains/room/model.js";

describe("HeartbeatHandler - Characterization Tests (Week 8)", () => {
  let heartbeatHandler: HeartbeatHandler;
  let state: RoomState;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    heartbeatHandler = new HeartbeatHandler();

    // Spy on console.log to capture debug output
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Minimal state with players
    state = {
      players: [
        { uid: "player-1", name: "Alice", isDM: false, lastHeartbeat: 1000 },
        { uid: "player-2", name: "Bob", isDM: false, lastHeartbeat: 2000 },
      ],
      pointers: {},
      tokens: [],
      characters: [],
      drawings: [],
      props: [],
      stagingZone: [],
      selectionState: {},
      mapBackground: null,
      gridSize: 50,
      gridSquareSize: 5,
      rollHistory: [],
      combatState: null,
    } as RoomState;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe("Week 8 Refactored Behavior - Returns Result Object", () => {
    it("should return result object when handling heartbeat from existing player", () => {
      const result = heartbeatHandler.handleHeartbeat(state, "player-1");

      expect(result).toEqual({ broadcast: true });
      expect(typeof result).toBe("object");
      expect(result).toHaveProperty("broadcast");
      expect(result.broadcast).toBe(true);
    });

    it("should return result object even for non-existent player", () => {
      const result = heartbeatHandler.handleHeartbeat(state, "unknown-player");

      expect(result).toEqual({ broadcast: true });
      expect(typeof result).toBe("object");
    });

    it("should always return broadcast:true regardless of player", () => {
      const result1 = heartbeatHandler.handleHeartbeat(state, "player-1");
      const result2 = heartbeatHandler.handleHeartbeat(state, "player-2");
      const result3 = heartbeatHandler.handleHeartbeat(state, "player-999");

      expect(result1).toEqual({ broadcast: true });
      expect(result2).toEqual({ broadcast: true });
      expect(result3).toEqual({ broadcast: true });
    });
  });

  describe("Side Effects - Player Timestamp Updates", () => {
    it("should update lastHeartbeat timestamp for existing player", () => {
      const beforeTimestamp = state.players[0]!.lastHeartbeat;

      // Mock Date.now to return a predictable value
      const mockNow = 5000;
      vi.spyOn(Date, "now").mockReturnValue(mockNow);

      heartbeatHandler.handleHeartbeat(state, "player-1");

      const afterTimestamp = state.players[0]!.lastHeartbeat;

      expect(afterTimestamp).toBe(mockNow);
      expect(afterTimestamp).not.toBe(beforeTimestamp);

      vi.restoreAllMocks();
    });

    it("should not throw when player does not exist", () => {
      expect(() => {
        heartbeatHandler.handleHeartbeat(state, "unknown-player");
      }).not.toThrow();
    });

    it("should only update the specific player's timestamp", () => {
      const player1Before = state.players[0]!.lastHeartbeat;
      const player2Before = state.players[1]!.lastHeartbeat;

      heartbeatHandler.handleHeartbeat(state, "player-1");

      const player1After = state.players[0]!.lastHeartbeat;
      const player2After = state.players[1]!.lastHeartbeat;

      // Player 1 timestamp should change
      expect(player1After).not.toBe(player1Before);

      // Player 2 timestamp should NOT change
      expect(player2After).toBe(player2Before);
    });
  });

  describe("Side Effects - Debug Logging", () => {
    it("should log debug message with player UID", () => {
      heartbeatHandler.handleHeartbeat(state, "player-1");

      expect(consoleLogSpy).toHaveBeenCalledWith("[DEBUG] Heartbeat received from player-1");
    });

    it("should log debug message even for unknown player", () => {
      heartbeatHandler.handleHeartbeat(state, "unknown-player");

      expect(consoleLogSpy).toHaveBeenCalledWith("[DEBUG] Heartbeat received from unknown-player");
    });

    it("should log debug message exactly once per heartbeat", () => {
      heartbeatHandler.handleHeartbeat(state, "player-1");

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("Week 8 Usage Pattern in messageRouter.ts", () => {
    it("should follow the RouteResultHandler pattern", () => {
      // Week 8 pattern (line 772-776 in messageRouter.ts):
      // const result = this.heartbeatHandler.handleHeartbeat(state, senderUid);
      // this.routeResultHandler.handleResult(result);

      const result = heartbeatHandler.handleHeartbeat(state, "player-1");

      // Verify it works with RouteResultHandler pattern
      expect(result).toHaveProperty("broadcast");
      expect(result.broadcast).toBe(true);

      // Simulate RouteResultHandler behavior
      if (result.broadcast) {
        // broadcast() would be called here
        expect(true).toBe(true);
      }
    });
  });

  describe("Week 8 Achieved Behavior - Result Object Pattern", () => {
    it("should implement the result object pattern", () => {
      // BEFORE Week 8:
      // const needsBroadcast: boolean = heartbeatHandler.handleHeartbeat(...)
      // if (needsBroadcast) this.broadcast()

      // AFTER Week 8 (CURRENT):
      // const result: { broadcast: boolean, save?: boolean } = heartbeatHandler.handleHeartbeat(...)
      // this.routeResultHandler.handleResult(result)

      const result = heartbeatHandler.handleHeartbeat(state, "player-1");

      // Week 8 achievement: result object pattern
      const expectedResult = { broadcast: true };
      expect(result).toEqual(expectedResult);
      expect(result).toHaveProperty("broadcast");
      expect(typeof result.broadcast).toBe("boolean");
    });
  });

  describe("Heartbeat Connection Keep-Alive Pattern", () => {
    it("should always broadcast to prevent client timeout", () => {
      // Heartbeat always returns { broadcast: true } to keep the connection alive
      // This prevents the client from timing out due to lack of server response

      const result = heartbeatHandler.handleHeartbeat(state, "player-1");

      expect(result.broadcast).toBe(true); // Always broadcast = connection kept alive
      expect(result).toEqual({ broadcast: true });
    });
  });
});
