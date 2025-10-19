import { describe, expect, it } from "vitest";
import {
  calculateMarqueeRect,
  testAABBIntersection,
  isClickMarquee,
  isSelectableObjectId,
} from "../marqueeSelection.js";

describe("marqueeSelection handlers", () => {
  describe("calculateMarqueeRect", () => {
    it("calculates correct rect for drag from top-left to bottom-right", () => {
      const result = calculateMarqueeRect({ x: 10, y: 20 }, { x: 50, y: 80 });
      expect(result).toEqual({ x: 10, y: 20, width: 40, height: 60 });
    });

    it("calculates correct rect for drag from bottom-right to top-left", () => {
      const result = calculateMarqueeRect({ x: 50, y: 80 }, { x: 10, y: 20 });
      expect(result).toEqual({ x: 10, y: 20, width: 40, height: 60 });
    });

    it("handles zero-width marquee", () => {
      const result = calculateMarqueeRect({ x: 10, y: 20 }, { x: 10, y: 50 });
      expect(result).toEqual({ x: 10, y: 20, width: 0, height: 30 });
    });

    it("handles zero-height marquee", () => {
      const result = calculateMarqueeRect({ x: 10, y: 20 }, { x: 50, y: 20 });
      expect(result).toEqual({ x: 10, y: 20, width: 40, height: 0 });
    });
  });

  describe("testAABBIntersection", () => {
    it("detects intersection when marquee fully contains node", () => {
      const marqueeRect = { x: 0, y: 0, width: 100, height: 100 };
      const nodeRect = { x: 20, y: 20, width: 30, height: 30 };
      expect(testAABBIntersection(marqueeRect, nodeRect)).toBe(true);
    });

    it("detects intersection when node fully contains marquee", () => {
      const marqueeRect = { x: 20, y: 20, width: 30, height: 30 };
      const nodeRect = { x: 0, y: 0, width: 100, height: 100 };
      expect(testAABBIntersection(marqueeRect, nodeRect)).toBe(true);
    });

    it("detects intersection when rectangles partially overlap", () => {
      const marqueeRect = { x: 0, y: 0, width: 50, height: 50 };
      const nodeRect = { x: 25, y: 25, width: 50, height: 50 };
      expect(testAABBIntersection(marqueeRect, nodeRect)).toBe(true);
    });

    it("detects no intersection when rectangles don't overlap", () => {
      const marqueeRect = { x: 0, y: 0, width: 50, height: 50 };
      const nodeRect = { x: 100, y: 100, width: 50, height: 50 };
      expect(testAABBIntersection(marqueeRect, nodeRect)).toBe(false);
    });

    it("detects intersection when rectangles touch edges", () => {
      const marqueeRect = { x: 0, y: 0, width: 50, height: 50 };
      const nodeRect = { x: 50, y: 0, width: 50, height: 50 };
      expect(testAABBIntersection(marqueeRect, nodeRect)).toBe(true);
    });
  });

  describe("isClickMarquee", () => {
    it("returns true for very small marquee (likely a click)", () => {
      expect(isClickMarquee(2, 2)).toBe(true);
    });

    it("returns false for large marquee", () => {
      expect(isClickMarquee(50, 50)).toBe(false);
    });

    it("uses custom threshold", () => {
      expect(isClickMarquee(5, 5, 10)).toBe(true);
      expect(isClickMarquee(5, 5, 3)).toBe(false);
    });

    it("returns false when only one dimension is below threshold", () => {
      expect(isClickMarquee(2, 100)).toBe(false);
      expect(isClickMarquee(100, 2)).toBe(false);
    });
  });

  describe("isSelectableObjectId", () => {
    it("returns true for token IDs", () => {
      expect(isSelectableObjectId("token:abc123")).toBe(true);
    });

    it("returns true for drawing IDs", () => {
      expect(isSelectableObjectId("drawing:xyz789")).toBe(true);
    });

    it("returns false for map IDs", () => {
      expect(isSelectableObjectId("map:background")).toBe(false);
    });

    it("returns false for other types", () => {
      expect(isSelectableObjectId("prop:item1")).toBe(false);
      expect(isSelectableObjectId("staging-zone:1")).toBe(false);
    });

    it("returns false for invalid IDs", () => {
      expect(isSelectableObjectId("invalid")).toBe(false);
      expect(isSelectableObjectId("")).toBe(false);
    });
  });
});
