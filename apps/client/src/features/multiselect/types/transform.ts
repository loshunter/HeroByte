/**
 * Group Transform Types
 * Types for coordinating transforms across multiple selected objects
 */

import type { Point } from "./marquee.js";

/**
 * Transform data for a single object in a group transform
 */
export interface GroupTransformData {
  /** Scene object ID */
  objectId: string;
  /** Position when drag started */
  startPosition: Point;
  /** Current delta from start position */
  currentDelta: Point;
}

/**
 * Result of calculating a group transform
 */
export interface GroupTransformResult {
  /** Scene object ID */
  objectId: string;
  /** New position after transform */
  newPosition: Point;
}

/**
 * Map of object IDs to their start positions for group transforms
 */
export type DragStartPositions = Map<string, Point>;
