/**
 * Marquee Selection Types
 * Used for drag-to-select multiple objects functionality
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Marquee selection state during an active drag operation
 */
export interface MarqueeState {
  /** Starting point of the marquee drag */
  start: Point;
  /** Current pointer position during drag */
  current: Point;
}

/**
 * Rectangular bounds of the marquee selection area
 */
export interface MarqueeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
