/**
 * DrawingMessageHandler
 *
 * Handles all drawing-related messages from clients.
 * Manages drawing operations including add, sync, undo/redo, select/deselect,
 * move, delete, and partial erase.
 *
 * Extracted from: apps/server/src/ws/messageRouter.ts
 * - draw (lines 563-566)
 * - sync-player-drawings (lines 568-579)
 * - undo-drawing (lines 581-585)
 * - redo-drawing (lines 587-591)
 * - clear-drawings (lines 593-603)
 * - select-drawing (lines 605-609)
 * - deselect-drawing (lines 611-614)
 * - move-drawing (lines 687-691)
 * - delete-drawing (lines 693-698)
 * - erase-partial (lines 700-707)
 *
 * Extraction date: 2025-11-14
 *
 * @module ws/handlers/DrawingMessageHandler
 */

import type { RoomState, Drawing, DrawingSegmentPayload } from "@shared";
import type { MapService } from "../../domains/map/service.js";
import type { SelectionService } from "../../domains/selection/service.js";
import type { RoomService } from "../../domains/room/service.js";

/**
 * Result of handling a drawing message
 */
export interface DrawingMessageResult {
  /** Whether a broadcast is needed */
  broadcast: boolean;
  /** Whether state should be saved */
  save: boolean;
}

/**
 * Handler for drawing-related messages
 */
export class DrawingMessageHandler {
  private mapService: MapService;
  private selectionService: SelectionService;
  private roomService: RoomService;

  constructor(
    mapService: MapService,
    selectionService: SelectionService,
    roomService: RoomService,
  ) {
    this.mapService = mapService;
    this.selectionService = selectionService;
    this.roomService = roomService;
  }

  /**
   * Handle draw message
   *
   * Adds a new drawing to the map.
   *
   * @param state - Current room state
   * @param drawing - Drawing data
   * @param senderUid - UID of the drawing owner
   * @returns Result indicating if broadcast/save is needed
   */
  handleDraw(state: RoomState, drawing: Drawing, senderUid: string): DrawingMessageResult {
    this.mapService.addDrawing(state, drawing, senderUid);
    return { broadcast: true, save: false };
  }

  /**
   * Handle sync-player-drawings message
   *
   * Replaces all of a player's drawings with a new set.
   * Removes old drawings from selection before replacing.
   *
   * @param state - Current room state
   * @param senderUid - UID of the player
   * @param drawings - New drawings to sync
   * @returns Result indicating if broadcast/save is needed
   */
  handleSyncPlayerDrawings(
    state: RoomState,
    senderUid: string,
    drawings: Drawing[],
  ): DrawingMessageResult {
    const removedIds = state.drawings
      .filter((drawing) => drawing.owner === senderUid)
      .map((drawing) => drawing.id);
    this.mapService.replacePlayerDrawings(state, senderUid, drawings);
    for (const id of removedIds) {
      this.selectionService.removeObject(state, id);
    }
    return { broadcast: true, save: true };
  }

  /**
   * Handle undo-drawing message
   *
   * Undoes the last drawing action for a player.
   *
   * @param state - Current room state
   * @param senderUid - UID of the player
   * @returns Result indicating if broadcast/save is needed
   */
  handleUndoDrawing(state: RoomState, senderUid: string): DrawingMessageResult {
    if (this.mapService.undoDrawing(state, senderUid)) {
      return { broadcast: true, save: false };
    }
    return { broadcast: false, save: false };
  }

  /**
   * Handle redo-drawing message
   *
   * Redoes the last undone drawing action for a player.
   *
   * @param state - Current room state
   * @param senderUid - UID of the player
   * @returns Result indicating if broadcast/save is needed
   */
  handleRedoDrawing(state: RoomState, senderUid: string): DrawingMessageResult {
    if (this.mapService.redoDrawing(state, senderUid)) {
      return { broadcast: true, save: false };
    }
    return { broadcast: false, save: false };
  }

  /**
   * Handle clear-drawings message
   *
   * Clears all drawings from the map.
   * Only DMs can clear all drawings.
   *
   * @param state - Current room state
   * @param senderUid - UID of the sender
   * @param isDM - Whether sender is DM
   * @returns Result indicating if broadcast/save is needed
   */
  handleClearDrawings(state: RoomState, senderUid: string, isDM: boolean): DrawingMessageResult {
    if (!isDM) {
      console.warn(`Non-DM ${senderUid} attempted to clear all drawings`);
      return { broadcast: false, save: false };
    }
    for (const drawing of state.drawings) {
      this.selectionService.removeObject(state, drawing.id);
    }
    this.mapService.clearDrawings(state);
    return { broadcast: true, save: false };
  }

  /**
   * Handle select-drawing message
   *
   * Selects a drawing for a player.
   *
   * @param state - Current room state
   * @param id - Drawing ID
   * @param senderUid - UID of the player
   * @returns Result indicating if broadcast/save is needed
   */
  handleSelectDrawing(state: RoomState, id: string, senderUid: string): DrawingMessageResult {
    if (this.mapService.selectDrawing(state, id, senderUid)) {
      return { broadcast: true, save: false };
    }
    return { broadcast: false, save: false };
  }

  /**
   * Handle deselect-drawing message
   *
   * Deselects the current drawing for a player.
   *
   * @param state - Current room state
   * @param senderUid - UID of the player
   * @returns Result indicating if broadcast/save is needed
   */
  handleDeselectDrawing(state: RoomState, senderUid: string): DrawingMessageResult {
    this.mapService.deselectDrawing(state, senderUid);
    return { broadcast: true, save: false };
  }

  /**
   * Handle move-drawing message
   *
   * Moves a drawing by a delta.
   *
   * @param state - Current room state
   * @param id - Drawing ID
   * @param dx - Delta X
   * @param dy - Delta Y
   * @param senderUid - UID of the player
   * @returns Result indicating if broadcast/save is needed
   */
  handleMoveDrawing(
    state: RoomState,
    id: string,
    dx: number,
    dy: number,
    senderUid: string,
  ): DrawingMessageResult {
    if (this.mapService.moveDrawing(state, id, dx, dy, senderUid)) {
      return { broadcast: true, save: false };
    }
    return { broadcast: false, save: false };
  }

  /**
   * Handle delete-drawing message
   *
   * Deletes a drawing and removes it from selection.
   *
   * @param state - Current room state
   * @param id - Drawing ID
   * @returns Result indicating if broadcast/save is needed
   */
  handleDeleteDrawing(state: RoomState, id: string): DrawingMessageResult {
    if (this.mapService.deleteDrawing(state, id)) {
      this.selectionService.removeObject(state, id);
      return { broadcast: true, save: false };
    }
    return { broadcast: false, save: false };
  }

  /**
   * Handle erase-partial message
   *
   * Handles partial erase of a drawing (splits it into segments).
   *
   * @param state - Current room state
   * @param deleteId - ID of drawing to erase
   * @param segments - New segments after erase
   * @param senderUid - UID of the player
   * @returns Result indicating if broadcast/save is needed
   */
  handleErasePartial(
    state: RoomState,
    deleteId: string,
    segments: DrawingSegmentPayload[],
    senderUid: string,
  ): DrawingMessageResult {
    if (this.mapService.handlePartialErase(state, deleteId, segments, senderUid)) {
      this.selectionService.removeObject(state, deleteId);
      return { broadcast: true, save: false };
    }
    return { broadcast: false, save: false };
  }
}
