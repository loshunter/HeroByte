/**
 * Characterization tests for MapMessageHandler
 *
 * These tests capture the original behavior of map configuration message handling
 * from messageRouter.ts before extraction.
 *
 * Source: apps/server/src/ws/messageRouter.ts
 * - map-background (lines 521-524)
 * - grid-size (lines 526-529)
 * - grid-square-size (lines 531-534)
 * - set-player-staging-zone (lines 536-560)
 *
 * @module ws/handlers/__tests__/MapMessageHandler.test
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { MapMessageHandler } from "../MapMessageHandler.js";
import type { RoomState, StagingZone } from "@shared";
import type { MapService } from "../../../domains/map/service.js";
import type { RoomService } from "../../../domains/room/service.js";

describe("MapMessageHandler", () => {
  let handler: MapMessageHandler;
  let mockMapService: MapService;
  let mockRoomService: RoomService;
  let state: RoomState;

  beforeEach(() => {
    // Create mock state
    state = {
      players: [],
      tokens: [],
      npcs: [],
      characters: [],
      props: [],
      map: { background: null, gridSize: 50, gridSquareSize: 5 },
      drawings: [],
      selected: [],
      combatActive: false,
      currentTurnCharacterId: undefined,
    } as unknown as RoomState;

    // Create mock services
    mockMapService = {
      setBackground: vi.fn((state: RoomState, background: string | null) => {
        state.map.background = background;
      }),
      setGridSize: vi.fn((state: RoomState, size: number) => {
        state.map.gridSize = size;
      }),
      setGridSquareSize: vi.fn((state: RoomState, size: number) => {
        state.map.gridSquareSize = size;
      }),
    } as unknown as MapService;

    mockRoomService = {
      getState: vi.fn(() => state),
      saveState: vi.fn(),
      setPlayerStagingZone: vi.fn((_zone: StagingZone) => {
        // Simulate successful setting
        return true;
      }),
    } as unknown as RoomService;

    handler = new MapMessageHandler(mockMapService, mockRoomService);
  });

  describe("handleMapBackground", () => {
    it("should set map background", () => {
      const result = handler.handleMapBackground(state, "https://example.com/map.jpg");

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(false);
      expect(mockMapService.setBackground).toHaveBeenCalledWith(
        state,
        "https://example.com/map.jpg",
      );
    });

    it("should allow clearing map background", () => {
      state.map.background = "https://example.com/old.jpg";

      const result = handler.handleMapBackground(state, null);

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(false);
      expect(mockMapService.setBackground).toHaveBeenCalledWith(state, null);
    });
  });

  describe("handleGridSize", () => {
    it("should set grid size", () => {
      const result = handler.handleGridSize(state, 100);

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(false);
      expect(mockMapService.setGridSize).toHaveBeenCalledWith(state, 100);
    });

    it("should allow changing grid size", () => {
      state.map.gridSize = 50;

      const result = handler.handleGridSize(state, 75);

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(false);
      expect(mockMapService.setGridSize).toHaveBeenCalledWith(state, 75);
    });
  });

  describe("handleGridSquareSize", () => {
    it("should set grid square size", () => {
      const result = handler.handleGridSquareSize(state, 10);

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(false);
      expect(mockMapService.setGridSquareSize).toHaveBeenCalledWith(state, 10);
    });

    it("should allow changing grid square size", () => {
      state.map.gridSquareSize = 5;

      const result = handler.handleGridSquareSize(state, 15);

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(false);
      expect(mockMapService.setGridSquareSize).toHaveBeenCalledWith(state, 15);
    });
  });

  describe("handleSetPlayerStagingZone", () => {
    const testZone: StagingZone = {
      x: 100,
      y: 200,
      width: 300,
      height: 400,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    };

    it("should allow DM to set staging zone", () => {
      const result = handler.handleSetPlayerStagingZone(state, "dmPlayer", testZone, true);

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(true);
      expect(mockRoomService.setPlayerStagingZone).toHaveBeenCalledWith(testZone);
    });

    it("should reject non-DM setting staging zone", () => {
      const result = handler.handleSetPlayerStagingZone(state, "player1", testZone, false);

      expect(result.broadcast).toBe(false);
      expect(result.save).toBe(false);
      expect(mockRoomService.setPlayerStagingZone).not.toHaveBeenCalled();
    });

    it("should handle failed staging zone set", () => {
      // Mock setPlayerStagingZone to return false
      mockRoomService.setPlayerStagingZone = vi.fn(() => false);

      const result = handler.handleSetPlayerStagingZone(state, "dmPlayer", testZone, true);

      expect(result.broadcast).toBe(false);
      expect(result.save).toBe(false);
      expect(mockRoomService.setPlayerStagingZone).toHaveBeenCalledWith(testZone);
    });
  });
});
