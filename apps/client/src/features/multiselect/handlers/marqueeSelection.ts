/**
 * Marquee Selection Handlers
 * Pure utility functions for marquee selection logic
 */

import type { MarqueeState, MarqueeRect, Point } from "../types/index.js";

/**
 * Calculate the rectangular bounds of a marquee selection
 */
export function calculateMarqueeRect(start: Point, current: Point): MarqueeRect {
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    width: Math.abs(start.x - current.x),
    height: Math.abs(start.y - current.y),
  };
}

/**
 * Test if two axis-aligned bounding boxes intersect
 */
export function testAABBIntersection(
  marqueeRect: MarqueeRect,
  nodeRect: { x: number; y: number; width: number; height: number },
): boolean {
  const marqueeMinX = marqueeRect.x;
  const marqueeMinY = marqueeRect.y;
  const marqueeMaxX = marqueeRect.x + marqueeRect.width;
  const marqueeMaxY = marqueeRect.y + marqueeRect.height;

  const nodeMinX = nodeRect.x;
  const nodeMinY = nodeRect.y;
  const nodeMaxX = nodeRect.x + nodeRect.width;
  const nodeMaxY = nodeRect.y + nodeRect.height;

  return (
    nodeMinX <= marqueeMaxX &&
    nodeMaxX >= marqueeMinX &&
    nodeMinY <= marqueeMaxY &&
    nodeMaxY >= marqueeMinY
  );
}

/**
 * Check if a marquee is small enough to be considered a click (not a drag)
 */
export function isClickMarquee(width: number, height: number, threshold = 4): boolean {
  return width < threshold && height < threshold;
}

/**
 * Filter object IDs to only include selectable types (tokens and drawings)
 */
export function isSelectableObjectId(id: string): boolean {
  return id.startsWith("token:") || id.startsWith("drawing:");
}
