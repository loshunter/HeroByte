// ============================================================================
// MAP DOMAIN - SERVICE
// ============================================================================
// Handles map-related features: background, grid, drawings, pointers

import type { Drawing, Pointer } from "@shared";
import type { RoomState } from "../room/model.js";

/**
 * Map service - manages map background, grid, drawings, and pointers
 */
export class MapService {
  /**
   * Set map background image
   */
  setBackground(state: RoomState, backgroundData: string): void {
    state.mapBackground = backgroundData;
  }

  /**
   * Update grid size
   */
  setGridSize(state: RoomState, size: number): void {
    state.gridSize = size;
  }

  /**
   * Add or update pointer indicator
   */
  placePointer(state: RoomState, uid: string, x: number, y: number): void {
    // Remove old pointer from this user
    state.pointers = state.pointers.filter((p) => p.uid !== uid);
    // Add new pointer
    state.pointers.push({ uid, x, y, timestamp: Date.now() });
  }

  /**
   * Add a drawing to the canvas
   */
  addDrawing(state: RoomState, drawing: Drawing): void {
    state.drawings.push(drawing);
  }

  /**
   * Clear all drawings
   */
  clearDrawings(state: RoomState): void {
    state.drawings = [];
  }
}
