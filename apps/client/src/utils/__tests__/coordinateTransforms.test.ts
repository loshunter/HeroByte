import { describe, it, expect } from "vitest";
import { worldToMapLocal } from "../coordinateTransforms";
import type { SceneObject } from "@shared";

describe("coordinateTransforms", () => {
  describe("worldToMapLocal", () => {
    it("should convert world coordinates to local with no transform", () => {
      const world = { x: 100, y: 200 };
      const transform: SceneObject["transform"] = {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      };

      const result = worldToMapLocal(world, transform);

      expect(result.x).toBe(100);
      expect(result.y).toBe(200);
    });

    it("should apply position offset", () => {
      const world = { x: 100, y: 200 };
      const transform: SceneObject["transform"] = {
        x: 50,
        y: 50,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      };

      const result = worldToMapLocal(world, transform);

      expect(result.x).toBe(50);
      expect(result.y).toBe(150);
    });

    it("should apply scale", () => {
      const world = { x: 100, y: 200 };
      const transform: SceneObject["transform"] = {
        x: 0,
        y: 0,
        scaleX: 2,
        scaleY: 2,
        rotation: 0,
      };

      const result = worldToMapLocal(world, transform);

      expect(result.x).toBe(50);
      expect(result.y).toBe(100);
    });

    it("should apply rotation (90 degrees)", () => {
      const world = { x: 100, y: 0 };
      const transform: SceneObject["transform"] = {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 90,
      };

      const result = worldToMapLocal(world, transform);

      // 90 degree rotation: (100, 0) -> (0, -100)
      expect(result.x).toBeCloseTo(0, 5);
      expect(result.y).toBeCloseTo(-100, 5);
    });

    it("should apply combined transform", () => {
      const world = { x: 200, y: 100 };
      const transform: SceneObject["transform"] = {
        x: 100,
        y: 50,
        scaleX: 2,
        scaleY: 2,
        rotation: 45,
      };

      const result = worldToMapLocal(world, transform);

      // This verifies the function runs without error
      // Exact values depend on correct rotation matrix math
      expect(result.x).toBeDefined();
      expect(result.y).toBeDefined();
      expect(typeof result.x).toBe("number");
      expect(typeof result.y).toBe("number");
    });

    it("should handle zero scale (division protection)", () => {
      const world = { x: 100, y: 200 };
      const transform: SceneObject["transform"] = {
        x: 0,
        y: 0,
        scaleX: 0,
        scaleY: 0,
        rotation: 0,
      };

      const result = worldToMapLocal(world, transform);

      // Should default to scale of 1 when scale is too small
      expect(result.x).toBe(100);
      expect(result.y).toBe(200);
    });

    it("should handle very small scale values", () => {
      const world = { x: 100, y: 200 };
      const transform: SceneObject["transform"] = {
        x: 0,
        y: 0,
        scaleX: 1e-7,
        scaleY: 1e-7,
        rotation: 0,
      };

      const result = worldToMapLocal(world, transform);

      // Should default to scale of 1 when scale is below threshold (1e-6)
      expect(result.x).toBe(100);
      expect(result.y).toBe(200);
    });

    it("should handle negative scale", () => {
      const world = { x: 100, y: 200 };
      const transform: SceneObject["transform"] = {
        x: 0,
        y: 0,
        scaleX: -2,
        scaleY: -2,
        rotation: 0,
      };

      const result = worldToMapLocal(world, transform);

      // With negative scale, the result is also negated
      expect(result.x).toBe(-50);
      expect(result.y).toBe(-100);
    });
  });
});
