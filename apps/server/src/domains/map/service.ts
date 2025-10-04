// ============================================================================
// MAP DOMAIN - SERVICE
// ============================================================================
// Handles map-related features: background, grid, drawings, pointers

import type { Drawing } from "@shared";
import type { RoomState } from "../room/model.js";

/**
 * Map service - manages map background, grid, drawings, and pointers
 */
export class MapService {
  private getRedoStack(state: RoomState, ownerUid: string): Drawing[] {
    if (!state.drawingRedoStacks[ownerUid]) {
      state.drawingRedoStacks[ownerUid] = [];
    }
    return state.drawingRedoStacks[ownerUid]!;
  }

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
  addDrawing(state: RoomState, drawing: Drawing, ownerUid: string): void {
    // Add owner to drawing for undo tracking
    state.drawings.push({ ...drawing, owner: ownerUid });
    // Clear redo stack whenever a new drawing is created
    state.drawingRedoStacks[ownerUid] = [];
  }

  /**
   * Undo the last drawing by a specific player
   * Removes the most recent drawing created by that player
   */
  undoDrawing(state: RoomState, ownerUid: string): boolean {
    // Find the last drawing by this player
    let lastIndex = -1;
    for (let i = state.drawings.length - 1; i >= 0; i--) {
      if (state.drawings[i].owner === ownerUid) {
        lastIndex = i;
        break;
      }
    }

    // Remove the drawing if found
    if (lastIndex !== -1) {
      const [removed] = state.drawings.splice(lastIndex, 1);
      const snapshot: Drawing = { ...removed, selectedBy: undefined };
      this.getRedoStack(state, ownerUid).push(snapshot);
      return true;
    }

    return false;
  }

  /**
   * Redo the most recently undone drawing for a player
   */
  redoDrawing(state: RoomState, ownerUid: string): boolean {
    const stack = this.getRedoStack(state, ownerUid);
    const drawing = stack.pop();
    if (drawing) {
      const restored: Drawing = { ...drawing, selectedBy: undefined };
      state.drawings.push(restored);
      return true;
    }
    return false;
  }

  /**
   * Clear all drawings
   */
  clearDrawings(state: RoomState): void {
    state.drawings = [];
    state.drawingRedoStacks = {};
  }

  /**
   * Select a drawing for editing
   * Deselects any other drawings by this player
   */
  selectDrawing(state: RoomState, drawingId: string, playerUid: string): boolean {
    // First, deselect any drawings currently selected by this player
    state.drawings.forEach((d) => {
      if (d.selectedBy === playerUid) {
        delete d.selectedBy;
      }
    });

    // Then select the requested drawing
    const drawing = state.drawings.find((d) => d.id === drawingId);
    if (drawing) {
      drawing.selectedBy = playerUid;
      return true;
    }
    return false;
  }

  /**
   * Deselect all drawings by a player
   */
  deselectDrawing(state: RoomState, playerUid: string): void {
    state.drawings.forEach((d) => {
      if (d.selectedBy === playerUid) {
        delete d.selectedBy;
      }
    });
  }

  /**
   * Move a drawing by a delta amount
   * Only the player who selected it can move it
   */
  moveDrawing(
    state: RoomState,
    drawingId: string,
    dx: number,
    dy: number,
    playerUid: string,
  ): boolean {
    const drawing = state.drawings.find((d) => d.id === drawingId);
    if (drawing && drawing.selectedBy === playerUid) {
      // Move all points by the delta
      drawing.points = drawing.points.map((p) => ({
        x: p.x + dx,
        y: p.y + dy,
      }));
      return true;
    }
    return false;
  }

  /**
   * Delete a specific drawing
   */
  deleteDrawing(state: RoomState, drawingId: string): boolean {
    const index = state.drawings.findIndex((d) => d.id === drawingId);
    if (index !== -1) {
      state.drawings.splice(index, 1);
      return true;
    }
    return false;
  }
}
