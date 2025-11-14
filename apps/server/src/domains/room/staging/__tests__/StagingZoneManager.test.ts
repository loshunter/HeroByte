/**
 * Characterization tests for StagingZoneManager
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/server/src/domains/room/service.ts
 * - sanitizeStagingZone (lines 26-54)
 * - setPlayerStagingZone (lines 656-661)
 * - getPlayerSpawnPosition (lines 667-687)
 *
 * Target: apps/server/src/domains/room/staging/StagingZoneManager.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RoomService } from "../../service.js";
import type { PlayerStagingZone } from "@shared";

describe("StagingZoneManager - Characterization Tests", () => {
  let roomService: RoomService;

  beforeEach(() => {
    roomService = new RoomService();
  });

  describe("sanitizeStagingZone (via setPlayerStagingZone)", () => {
    it("should accept a valid staging zone with all required fields", () => {
      const validZone: PlayerStagingZone = {
        x: 10,
        y: 20,
        width: 5,
        height: 3,
        rotation: 45,
      };

      const result = roomService.setPlayerStagingZone(validZone);
      expect(result).toBe(true);

      const state = roomService.getState();
      expect(state.playerStagingZone).toEqual({
        x: 10,
        y: 20,
        width: 5,
        height: 3,
        rotation: 45,
      });
    });

    it("should accept a zone without rotation and default to 0", () => {
      const zoneWithoutRotation = {
        x: 5,
        y: 5,
        width: 4,
        height: 4,
      };

      roomService.setPlayerStagingZone(zoneWithoutRotation as PlayerStagingZone);

      const state = roomService.getState();
      expect(state.playerStagingZone).toEqual({
        x: 5,
        y: 5,
        width: 4,
        height: 4,
        rotation: 0,
      });
    });

    it("should normalize negative width and height to positive values", () => {
      const zoneWithNegatives = {
        x: 0,
        y: 0,
        width: -10,
        height: -5,
        rotation: 0,
      };

      roomService.setPlayerStagingZone(zoneWithNegatives as PlayerStagingZone);

      const state = roomService.getState();
      expect(state.playerStagingZone?.width).toBe(10);
      expect(state.playerStagingZone?.height).toBe(5);
    });

    it("should enforce minimum width and height of 1", () => {
      const zoneWithZeroSize = {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
      };

      roomService.setPlayerStagingZone(zoneWithZeroSize as PlayerStagingZone);

      const state = roomService.getState();
      expect(state.playerStagingZone?.width).toBe(1);
      expect(state.playerStagingZone?.height).toBe(1);
    });

    it("should reject zone with non-finite x coordinate", () => {
      const invalidZone = {
        x: NaN,
        y: 10,
        width: 5,
        height: 5,
        rotation: 0,
      };

      roomService.setPlayerStagingZone(invalidZone as unknown as PlayerStagingZone);

      const state = roomService.getState();
      expect(state.playerStagingZone).toBeUndefined();
    });

    it("should reject zone with non-finite y coordinate", () => {
      const invalidZone = {
        x: 10,
        y: Infinity,
        width: 5,
        height: 5,
        rotation: 0,
      };

      roomService.setPlayerStagingZone(invalidZone as unknown as PlayerStagingZone);

      const state = roomService.getState();
      expect(state.playerStagingZone).toBeUndefined();
    });

    it("should reject zone with non-finite width", () => {
      const invalidZone = {
        x: 10,
        y: 10,
        width: -Infinity,
        height: 5,
        rotation: 0,
      };

      roomService.setPlayerStagingZone(invalidZone as unknown as PlayerStagingZone);

      const state = roomService.getState();
      expect(state.playerStagingZone).toBeUndefined();
    });

    it("should reject zone with non-finite height", () => {
      const invalidZone = {
        x: 10,
        y: 10,
        width: 5,
        height: NaN,
        rotation: 0,
      };

      roomService.setPlayerStagingZone(invalidZone as unknown as PlayerStagingZone);

      const state = roomService.getState();
      expect(state.playerStagingZone).toBeUndefined();
    });

    it("should accept fractional dimensions", () => {
      const fractionalZone = {
        x: 5.5,
        y: 10.25,
        width: 3.7,
        height: 2.3,
        rotation: 15.5,
      };

      roomService.setPlayerStagingZone(fractionalZone as PlayerStagingZone);

      const state = roomService.getState();
      expect(state.playerStagingZone?.x).toBe(5.5);
      expect(state.playerStagingZone?.y).toBe(10.25);
      expect(state.playerStagingZone?.width).toBe(3.7);
      expect(state.playerStagingZone?.height).toBe(2.3);
      expect(state.playerStagingZone?.rotation).toBe(15.5);
    });

    it("should coerce string numbers to numbers", () => {
      const stringZone = {
        x: "10",
        y: "20",
        width: "5",
        height: "3",
        rotation: "45",
      };

      roomService.setPlayerStagingZone(stringZone as unknown as PlayerStagingZone);

      const state = roomService.getState();
      expect(state.playerStagingZone).toEqual({
        x: 10,
        y: 20,
        width: 5,
        height: 3,
        rotation: 45,
      });
    });

    it("should reject null zone", () => {
      roomService.setPlayerStagingZone(null as unknown as PlayerStagingZone);

      const state = roomService.getState();
      expect(state.playerStagingZone).toBeUndefined();
    });

    it("should reject undefined zone (clear the staging zone)", () => {
      // First set a zone
      roomService.setPlayerStagingZone({ x: 10, y: 10, width: 5, height: 5, rotation: 0 });
      expect(roomService.getState().playerStagingZone).toBeDefined();

      // Then clear it
      roomService.setPlayerStagingZone(undefined);

      const state = roomService.getState();
      expect(state.playerStagingZone).toBeUndefined();
    });

    it("should handle invalid rotation by defaulting to 0", () => {
      const invalidRotation = {
        x: 10,
        y: 10,
        width: 5,
        height: 5,
        rotation: NaN,
      };

      roomService.setPlayerStagingZone(invalidRotation as unknown as PlayerStagingZone);

      const state = roomService.getState();
      expect(state.playerStagingZone?.rotation).toBe(0);
    });
  });

  describe("setPlayerStagingZone", () => {
    it("should always return true", () => {
      const validZone: PlayerStagingZone = {
        x: 10,
        y: 10,
        width: 5,
        height: 5,
        rotation: 0,
      };

      const result1 = roomService.setPlayerStagingZone(validZone);
      expect(result1).toBe(true);

      const result2 = roomService.setPlayerStagingZone(undefined);
      expect(result2).toBe(true);

      const result3 = roomService.setPlayerStagingZone(null as unknown as PlayerStagingZone);
      expect(result3).toBe(true);
    });

    it("should update the state with sanitized zone", () => {
      const zone: PlayerStagingZone = {
        x: 5,
        y: 10,
        width: 3,
        height: 4,
        rotation: 90,
      };

      roomService.setPlayerStagingZone(zone);

      const state = roomService.getState();
      expect(state.playerStagingZone).toEqual(zone);
    });

    it("should trigger scene graph rebuild", () => {
      // Set a zone
      roomService.setPlayerStagingZone({
        x: 10,
        y: 10,
        width: 5,
        height: 5,
        rotation: 0,
      });

      // Verify scene graph contains staging zone object
      const state = roomService.getState();
      const stagingZoneObject = state.sceneObjects.find((obj) => obj.type === "staging-zone");
      expect(stagingZoneObject).toBeDefined();
      expect(stagingZoneObject?.transform.x).toBe(10);
      expect(stagingZoneObject?.transform.y).toBe(10);
    });

    it("should remove staging zone from scene graph when cleared", () => {
      // Set a zone first
      roomService.setPlayerStagingZone({
        x: 10,
        y: 10,
        width: 5,
        height: 5,
        rotation: 0,
      });

      let state = roomService.getState();
      let stagingZoneObject = state.sceneObjects.find((obj) => obj.type === "staging-zone");
      expect(stagingZoneObject).toBeDefined();

      // Clear the zone
      roomService.setPlayerStagingZone(undefined);

      state = roomService.getState();
      stagingZoneObject = state.sceneObjects.find((obj) => obj.type === "staging-zone");
      expect(stagingZoneObject).toBeUndefined();
    });
  });

  describe("getPlayerSpawnPosition", () => {
    it("should return (0, 0) when no staging zone is set", () => {
      const position = roomService.getPlayerSpawnPosition();
      expect(position).toEqual({ x: 0, y: 0 });
    });

    it("should return positions within the staging zone bounds (no rotation)", () => {
      roomService.setPlayerStagingZone({
        x: 100,
        y: 100,
        width: 10,
        height: 10,
        rotation: 0,
      });

      // Test multiple spawns to verify distribution
      for (let i = 0; i < 100; i++) {
        const position = roomService.getPlayerSpawnPosition();
        expect(position.x).toBeGreaterThanOrEqual(95); // 100 - 10/2
        expect(position.x).toBeLessThanOrEqual(105); // 100 + 10/2
        expect(position.y).toBeGreaterThanOrEqual(95); // 100 - 10/2
        expect(position.y).toBeLessThanOrEqual(105); // 100 + 10/2
      }
    });

    it("should handle rotation at 0 degrees", () => {
      roomService.setPlayerStagingZone({
        x: 50,
        y: 50,
        width: 20,
        height: 10,
        rotation: 0,
      });

      const position = roomService.getPlayerSpawnPosition();
      expect(position.x).toBeGreaterThanOrEqual(40); // 50 - 20/2
      expect(position.x).toBeLessThanOrEqual(60); // 50 + 20/2
      expect(position.y).toBeGreaterThanOrEqual(45); // 50 - 10/2
      expect(position.y).toBeLessThanOrEqual(55); // 50 + 10/2
    });

    it("should handle rotation at 90 degrees", () => {
      roomService.setPlayerStagingZone({
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        rotation: 90,
      });

      // At 90 degrees, width and height are swapped in the rotated coordinate system
      const position = roomService.getPlayerSpawnPosition();
      // The position should still be within the rotated bounds
      const distance = Math.sqrt(position.x ** 2 + position.y ** 2);
      expect(distance).toBeLessThanOrEqual(10); // Should be within the zone
    });

    it("should handle rotation at 180 degrees", () => {
      roomService.setPlayerStagingZone({
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        rotation: 180,
      });

      const position = roomService.getPlayerSpawnPosition();
      // At 180 degrees, the zone is flipped, but center is still at (0, 0)
      const distance = Math.sqrt(position.x ** 2 + position.y ** 2);
      expect(distance).toBeLessThanOrEqual(10);
    });

    it("should handle rotation at 270 degrees", () => {
      roomService.setPlayerStagingZone({
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        rotation: 270,
      });

      const position = roomService.getPlayerSpawnPosition();
      const distance = Math.sqrt(position.x ** 2 + position.y ** 2);
      expect(distance).toBeLessThanOrEqual(10);
    });

    it("should handle arbitrary rotation (45 degrees)", () => {
      roomService.setPlayerStagingZone({
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        rotation: 45,
      });

      const position = roomService.getPlayerSpawnPosition();
      // Verify the position is reasonably within the rotated zone
      const distance = Math.sqrt(position.x ** 2 + position.y ** 2);
      expect(distance).toBeLessThanOrEqual(10);
    });

    it("should handle rectangular zones with different width and height", () => {
      roomService.setPlayerStagingZone({
        x: 0,
        y: 0,
        width: 20,
        height: 5,
        rotation: 0,
      });

      for (let i = 0; i < 50; i++) {
        const position = roomService.getPlayerSpawnPosition();
        expect(position.x).toBeGreaterThanOrEqual(-10); // 0 - 20/2
        expect(position.x).toBeLessThanOrEqual(10); // 0 + 20/2
        expect(position.y).toBeGreaterThanOrEqual(-2.5); // 0 - 5/2
        expect(position.y).toBeLessThanOrEqual(2.5); // 0 + 5/2
      }
    });

    it("should return different positions on multiple calls (randomness)", () => {
      roomService.setPlayerStagingZone({
        x: 100,
        y: 100,
        width: 50,
        height: 50,
        rotation: 0,
      });

      const positions = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const position = roomService.getPlayerSpawnPosition();
        positions.add(`${position.x},${position.y}`);
      }

      // With a large enough zone and enough samples, we should get multiple unique positions
      expect(positions.size).toBeGreaterThan(1);
    });

    it("should handle minimum size zone (1x1)", () => {
      roomService.setPlayerStagingZone({
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        rotation: 0,
      });

      const position = roomService.getPlayerSpawnPosition();
      expect(position.x).toBeGreaterThanOrEqual(-0.5);
      expect(position.x).toBeLessThanOrEqual(0.5);
      expect(position.y).toBeGreaterThanOrEqual(-0.5);
      expect(position.y).toBeLessThanOrEqual(0.5);
    });

    it("should offset position by zone center coordinates", () => {
      roomService.setPlayerStagingZone({
        x: 1000,
        y: 2000,
        width: 10,
        height: 10,
        rotation: 0,
      });

      const position = roomService.getPlayerSpawnPosition();
      expect(position.x).toBeGreaterThanOrEqual(995); // 1000 - 10/2
      expect(position.x).toBeLessThanOrEqual(1005); // 1000 + 10/2
      expect(position.y).toBeGreaterThanOrEqual(1995); // 2000 - 10/2
      expect(position.y).toBeLessThanOrEqual(2005); // 2000 + 10/2
    });
  });
});
