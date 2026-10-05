// ============================================================================
// MAP DOMAIN - SERVICE
// ============================================================================
// Handles map-related features: background, grid, drawings, pointers

import { isDrawingLocked, lockedPieceIds } from "../room/locking/pieceLock.js";
import { randomUUID } from "crypto";
import type { Drawing, DrawingSegmentPayload, Pointer } from "@herobyte/shared";
import type { RoomState } from "../room/model.js";
import { cloneDrawing, recordUserOperation, redoDrawing, undoDrawing } from "./drawingHistory.js";

/**
 * Map service - manages map background, grid, drawings, and pointers
 */
export class MapService {
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
  placePointer(state: RoomState, uid: string, x: number, y: number): Pointer | undefined {
    const player = state.players.find((p) => p.uid === uid);
    const name = player?.name ?? uid.slice(0, 6);
    const now = Date.now();
    // Add new pointer with unique ID based on timestamp
    const pointerId = `${uid}-${now}`;
    const pointer: Pointer = { uid, x, y, timestamp: now, id: pointerId, name };
    state.pointers.push(pointer);
    return pointer;
  }

  /**
   * Add a drawing to the canvas
   */
  addDrawing(state: RoomState, drawing: Drawing, ownerUid: string): void {
    if (state.drawings.some((existing) => existing.id === drawing.id)) return;
    const drawingWithOwner: Drawing = { ...drawing, owner: ownerUid };
    const stored = cloneDrawing(drawingWithOwner);
    state.drawings.push(stored);
    recordUserOperation(state, ownerUid, { type: "add", drawing: stored });
  }

  /**
   * Undo the last drawing by a specific player
   * Removes the most recent drawing created by that player
   */
  undoDrawing(state: RoomState, ownerUid: string): boolean {
    return undoDrawing(state, ownerUid);
  }

  /**
   * Redo the most recently undone drawing for a player
   */
  redoDrawing(state: RoomState, ownerUid: string): boolean {
    return redoDrawing(state, ownerUid);
  }

  /**
   * Clear all drawings except locked ones (a lock is lifted before anything removes
   * the piece)
   */
  clearDrawings(state: RoomState): void {
    const locked = lockedPieceIds(state);
    state.drawings = state.drawings.filter((drawing) => locked.has(`drawing:${drawing.id}`));
    state.drawingUndoStacks = {};
    state.drawingRedoStacks = {};
  }

  /**
   * Replace all drawings owned by a player (used for imports)
   */
  replacePlayerDrawings(state: RoomState, ownerUid: string, drawings: Drawing[]): void {
    // The player's locked drawings stay as they are; the imported set joins them, minus
    // the file's own copy of a locked one (character files keep drawing ids, and that
    // copy would otherwise land beside it, unlocked, under a fresh id).
    const keptLocked = new Set(
      state.drawings
        .filter((drawing) => drawing.owner === ownerUid && isDrawingLocked(state, drawing.id))
        .map((drawing) => drawing.id),
    );
    state.drawings = state.drawings.filter(
      (drawing) => drawing.owner !== ownerUid || keptLocked.has(drawing.id),
    );
    const ids = new Set(state.drawings.map((drawing) => drawing.id));
    const incoming = drawings.filter(
      (drawing) => !(typeof drawing.id === "string" && keptLocked.has(drawing.id.trim())),
    );

    const sanitized: Drawing[] = incoming.map((drawing) => {
      let id = typeof drawing.id === "string" ? drawing.id.trim() : "";
      // Preserve imported geometry while keeping IDs unique across owners and
      // within this batch. Existing IDs owned by this importer remain reusable.
      while (!id || ids.has(id)) id = randomUUID();
      ids.add(id);
      const sanitizedDrawing: Drawing = {
        ...drawing,
        id,
        owner: ownerUid,
        selectedBy: undefined,
      };
      return cloneDrawing(sanitizedDrawing);
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
    isDM = false,
  ): boolean {
    const drawing = state.drawings.find((d) => d.id === drawingId);
    // Selecting a drawing claims nothing: only its owner, the DM, or anyone for an
    // owner-less drawing moves it; a locked one moves for no one.
    if (!drawing || isDrawingLocked(state, drawingId)) return false;
    if (
      drawing.selectedBy === playerUid &&
      (isDM || !drawing.owner || drawing.owner === playerUid)
    ) {
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
   * Delete a specific drawing.
   *
   * Ownership-gated, matching `handlePartialErase` below and the behaviour the
   * player guide already promises ("you can erase and move only your own
   * drawings"). It was not: any player could delete any other player's work by
   * id, and the eraser reaches this path for every non-freehand shape it
   * crosses — so one stroke over a neighbour's circle removed it for the whole
   * table. A DM is exempt: `clear-drawings` is already theirs, and tidying the
   * map is the job.
   *
   * Unowned drawings (no `owner`) stay deletable by anyone: they predate owner
   * stamping, and orphaning them would leave marks nobody can remove.
   */
  deleteDrawing(state: RoomState, drawingId: string, actorUid?: string, isDM = false): boolean {
    const index = state.drawings.findIndex((d) => d.id === drawingId);
    if (index === -1) {
      return false;
    }
    const drawing = state.drawings[index];
    if (!isDM && actorUid !== undefined && drawing.owner && drawing.owner !== actorUid) {
      return false;
    }
    state.drawings.splice(index, 1);
    return true;
  }

  /**
   * Handle partial erase operations for freehand drawings
   * Removes the original drawing and replaces it with sanitized segments.
   * Gated like `deleteDrawing`: the owner, anyone for an owner-less line, or a
   * DM (who erased a whole shape of anyone's but was silently refused a cut
   * through a player's freehand line). The pieces stay the original owner's.
   */
  handlePartialErase(
    state: RoomState,
    deleteId: string,
    segments: DrawingSegmentPayload[],
    ownerUid: string,
    isDM = false,
  ): boolean {
    const index = state.drawings.findIndex((drawing) => drawing.id === deleteId);
    if (index === -1) {
      return false;
    }

    const original = state.drawings[index];
    if (!isDM && original.owner && original.owner !== ownerUid) {
      return false;
    }

    const originalClone = cloneDrawing(original);
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
        owner: original.owner || ownerUid,
      };
      state.drawings.push(newDrawing);
      createdSegments.push(cloneDrawing(newDrawing));
    }

    recordUserOperation(state, ownerUid, {
      type: "partial-erase",
      original: originalClone,
      segments: createdSegments,
    });

    return true;
  }
}
