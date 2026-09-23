import type { DrawingType } from "./drawingTypes.js";
import type { AreaTemplate } from "./areaTemplates.js";

/**
 * Drawing: Represents any drawing on the map canvas
 * Supports multiple tool types: freehand, line, rectangle, circle, etc.
 */
export interface Drawing {
  id: string; // Unique identifier
  owner?: string; // UID of player who created this drawing
  type: DrawingType; // Drawing tool type
  points: { x: number; y: number }[]; // Path points or shape bounds
  color: string; // Line/fill color
  width: number; // Line thickness
  opacity: number; // Opacity (0-1)
  filled?: boolean; // For shapes: filled vs outline only
  selectedBy?: string; // UID of player who has this drawing selected (for editing)
  /**
   * Present only on `type: "template"`. Describes the area — "20 ft cone" —
   * for the readout; `points` remains the authority on where it sits, so
   * dragging a placed template never makes this stale.
   */
  template?: AreaTemplate;
}

/**
 * DrawingSegmentPayload: Data required to create a new drawing segment generated
 * after a partial erase operation. Server will assign a fresh id and owner.
 */
export type DrawingSegmentPayload = Omit<Drawing, "id">;

export interface DrawingHistoryCapabilities {
  canUndo: boolean;
  canRedo: boolean;
}
