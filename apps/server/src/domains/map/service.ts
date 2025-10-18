// ============================================================================
// MAP DOMAIN - SERVICE
// ============================================================================
// Handles map-related features: background, grid, drawings, pointers

import { randomUUID } from "crypto";
import type { Drawing, DrawingSegmentPayload } from "@shared";
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
   * Update grid square size (how many feet per square)
   */
  setGridSquareSize(state: RoomState, size: number): void {
    state.gridSquareSize = size;
  }

  /**
   * Add pointer indicator (supports multiple simultaneous pointers)
   */
  placePointer(state: RoomState, uid: string, x: number, y: number): void {
    const player = state.players.find((p) => p.uid === uid);
    const name = player?.name ?? uid.slice(0, 6);
    const now = Date.now();
    // Add new pointer with unique ID based on timestamp
    const pointerId = `${uid}-${now}`;
    state.pointers.push({ uid, x, y, timestamp: now, id: pointerId, name });
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

  /**
   * Handle partial erase operations for freehand drawings
   * Removes the original drawing and replaces it with sanitized segments
   */
  handlePartialErase(
    state: RoomState,
    deleteId: string,
    segments: DrawingSegmentPayload[],
    ownerUid: string,
  ): boolean {
    const index = state.drawings.findIndex((drawing) => drawing.id === deleteId);
    if (index === -1) {
      return false;
    }

    const original = state.drawings[index];
    if (original.owner && original.owner !== ownerUid) {
      return false;
    }

    state.drawings.splice(index, 1);
    const redoStack = this.getRedoStack(state, ownerUid);
    redoStack.length = 0;

    if (segments.length === 0) {
      return true;
    }

    for (const segment of segments) {
      if (
        segment.type !== "freehand" ||
        !Array.isArray(segment.points) ||
        segment.points.length < 2
      ) {
        // Validation should prevent this, but guard defensively
        continue;
      }

      const clonedPoints = segment.points.map((point) => ({ x: point.x, y: point.y }));
      const newDrawing: Drawing = {
        id: randomUUID(),
        type: "freehand",
        points: clonedPoints,
        color: segment.color,
        width: segment.width,
        opacity: segment.opacity,
        filled: segment.filled,
        owner: ownerUid,
      };
      state.drawings.push(newDrawing);
    }

    return true;
  }
}
