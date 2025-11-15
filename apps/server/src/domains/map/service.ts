// ============================================================================
// MAP DOMAIN - SERVICE
// ============================================================================
// Handles map-related features: background, grid, drawings, pointers

import { randomUUID } from "crypto";
import type { Drawing, DrawingSegmentPayload } from "@shared";
import type { RoomState } from "../room/model.js";
import type { DrawingOperation, DrawingOperationStack } from "./types.js";

/**
 * Map service - manages map background, grid, drawings, and pointers
 */
export class MapService {
  private getUndoStack(state: RoomState, ownerUid: string): DrawingOperationStack {
    if (!state.drawingUndoStacks[ownerUid]) {
      state.drawingUndoStacks[ownerUid] = [];
    }
    return state.drawingUndoStacks[ownerUid]!;
  }

  private getRedoStack(state: RoomState, ownerUid: string): DrawingOperationStack {
    if (!state.drawingRedoStacks[ownerUid]) {
      state.drawingRedoStacks[ownerUid] = [];
    }
    return state.drawingRedoStacks[ownerUid]!;
  }

  private clearRedoStack(state: RoomState, ownerUid: string): void {
    const stack = this.getRedoStack(state, ownerUid);
    stack.length = 0;
  }

  private cloneDrawing(drawing: Drawing): Drawing {
    const { selectedBy: _omitSelection, ...rest } = drawing;
    const clonedPoints = Array.isArray(drawing.points)
      ? drawing.points.map((point) => ({ x: point.x, y: point.y }))
      : [];
    return {
      ...rest,
      points: clonedPoints,
    };
  }

  private cloneOperation(operation: DrawingOperation): DrawingOperation {
    switch (operation.type) {
      case "add":
        return { type: "add", drawing: this.cloneDrawing(operation.drawing) };
      case "erase":
        return { type: "erase", drawing: this.cloneDrawing(operation.drawing) };
      case "partial-erase":
        return {
          type: "partial-erase",
          original: this.cloneDrawing(operation.original),
          segments: operation.segments.map((segment) => this.cloneDrawing(segment)),
        };
      default: {
        const exhaustive: never = operation;
        return exhaustive;
      }
    }
  }

  private recordUserOperation(
    state: RoomState,
    ownerUid: string,
    operation: DrawingOperation,
  ): void {
    const undoStack = this.getUndoStack(state, ownerUid);
    undoStack.push(this.cloneOperation(operation));
    this.clearRedoStack(state, ownerUid);
  }

  /**
   * Set map background image
   */
  setBackground(state: RoomState, backgroundData: string | null): void {
    state.mapBackground = backgroundData ?? undefined;
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
    const drawingWithOwner: Drawing = { ...drawing, owner: ownerUid };
    const stored = this.cloneDrawing(drawingWithOwner);
    state.drawings.push(stored);
    this.recordUserOperation(state, ownerUid, { type: "add", drawing: stored });
  }

  /**
   * Undo the last drawing by a specific player
   * Removes the most recent drawing created by that player
   */
  undoDrawing(state: RoomState, ownerUid: string): boolean {
    const undoStack = this.getUndoStack(state, ownerUid);
    const operation = undoStack.pop();
    if (!operation) {
      return false;
    }

    const applied = this.applyUndoOperation(state, ownerUid, operation);
    if (!applied) {
      undoStack.push(operation);
      return false;
    }

    this.getRedoStack(state, ownerUid).push(this.cloneOperation(operation));
    return true;
  }

  /**
   * Redo the most recently undone drawing for a player
   */
  redoDrawing(state: RoomState, ownerUid: string): boolean {
    const redoStack = this.getRedoStack(state, ownerUid);
    const operation = redoStack.pop();
    if (!operation) {
      return false;
    }

    const applied = this.applyRedoOperation(state, ownerUid, operation);
    if (!applied) {
      redoStack.push(operation);
      return false;
    }

    const undoStack = this.getUndoStack(state, ownerUid);
    undoStack.push(this.cloneOperation(operation));
    return true;
  }

  /**
   * Clear all drawings
   */
  clearDrawings(state: RoomState): void {
    state.drawings = [];
    state.drawingUndoStacks = {};
    state.drawingRedoStacks = {};
  }

  /**
   * Replace all drawings owned by a player (used for imports)
   */
  replacePlayerDrawings(state: RoomState, ownerUid: string, drawings: Drawing[]): void {
    state.drawings = state.drawings.filter((drawing) => drawing.owner !== ownerUid);

    const sanitized: Drawing[] = drawings.map((drawing) => {
      const sanitizedDrawing: Drawing = {
        ...drawing,
        id:
          typeof drawing.id === "string" && drawing.id.trim().length > 0
            ? drawing.id.trim()
            : randomUUID(),
        owner: ownerUid,
        selectedBy: undefined,
      };
      return this.cloneDrawing(sanitizedDrawing);
    });

    state.drawings.push(...sanitized);
    state.drawingUndoStacks[ownerUid] = [];
    state.drawingRedoStacks[ownerUid] = [];
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

    const originalClone = this.cloneDrawing(original);
    state.drawings.splice(index, 1);

    const createdSegments: Drawing[] = [];
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
      createdSegments.push(this.cloneDrawing(newDrawing));
    }

    this.recordUserOperation(state, ownerUid, {
      type: "partial-erase",
      original: originalClone,
      segments: createdSegments,
    });

    return true;
  }

  private applyUndoOperation(
    state: RoomState,
    ownerUid: string,
    operation: DrawingOperation,
  ): boolean {
    switch (operation.type) {
      case "add":
        return this.removeDrawingById(state, operation.drawing.id);

      case "erase":
        this.restoreDrawing(state, operation.drawing);
        return true;

      case "partial-erase":
        this.removeSegmentDrawings(state, operation.segments);
        this.restoreDrawing(state, operation.original);
        return true;
    }
    return false;
  }

  private applyRedoOperation(
    state: RoomState,
    ownerUid: string,
    operation: DrawingOperation,
  ): boolean {
    switch (operation.type) {
      case "add":
        this.restoreDrawing(state, operation.drawing);
        return true;

      case "erase":
        return this.removeDrawingById(state, operation.drawing.id);

      case "partial-erase": {
        const removed = this.removeDrawingById(state, operation.original.id);
        // Even if original is already absent, continue applying segments
        for (const segment of operation.segments) {
          this.restoreDrawing(state, segment);
        }
        return removed || operation.segments.length > 0;
      }
    }
    return false;
  }

  private removeDrawingById(state: RoomState, drawingId: string): boolean {
    const index = state.drawings.findIndex((candidate) => candidate.id === drawingId);
    if (index === -1) {
      return false;
    }
    state.drawings.splice(index, 1);
    return true;
  }

  private restoreDrawing(state: RoomState, drawing: Drawing): void {
    const exists = state.drawings.some((candidate) => candidate.id === drawing.id);
    if (exists) {
      return;
    }
    state.drawings.push(this.cloneDrawing(drawing));
  }

  private removeSegmentDrawings(state: RoomState, segments: Drawing[]): void {
    const ids = new Set(segments.map((segment) => segment.id));
    if (ids.size === 0) {
      return;
    }
    state.drawings = state.drawings.filter((drawing) => !ids.has(drawing.id));
  }
}
