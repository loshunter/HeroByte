/**
 * Characterization tests for DrawingMessageHandler
 *
 * These tests capture the original behavior of drawing message handling
 * from messageRouter.ts before extraction.
 *
 * Source: apps/server/src/ws/messageRouter.ts
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
 * @module ws/handlers/__tests__/DrawingMessageHandler.test
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { DrawingMessageHandler } from "../DrawingMessageHandler.js";
import type { RoomState, Drawing } from "@shared";
import type { MapService } from "../../../domains/map/service.js";
import type { SelectionService } from "../../../domains/selection/service.js";
import type { RoomService } from "../../../domains/room/service.js";

describe("DrawingMessageHandler", () => {
  let handler: DrawingMessageHandler;
  let mockMapService: MapService;
  let mockSelectionService: SelectionService;
  let mockRoomService: RoomService;
  let state: RoomState;

  beforeEach(() => {
    // Create mock state
    state = {
      players: [],
      tokens: [],
      npcs: [],
      characters: [],
      props: [],
      map: { background: null, gridSize: 50, gridSquareSize: 5 },
      drawings: [],
      selected: [],
      combatActive: false,
      currentTurnCharacterId: undefined,
    } as unknown as RoomState;

    // Create mock services
    mockMapService = {
      addDrawing: vi.fn((state: RoomState, drawing: Drawing, owner: string) => {
        state.drawings.push({ ...drawing, owner });
      }),
      replacePlayerDrawings: vi.fn((state: RoomState, owner: string, drawings: Drawing[]) => {
        state.drawings = state.drawings.filter((d) => d.owner !== owner);
        drawings.forEach((d) => state.drawings.push({ ...d, owner }));
      }),
      undoDrawing: vi.fn(() => true),
      redoDrawing: vi.fn(() => true),
      clearDrawings: vi.fn((state: RoomState) => {
        state.drawings = [];
      }),
      selectDrawing: vi.fn(() => true),
      deselectDrawing: vi.fn((state: RoomState, owner: string) => {}),
      moveDrawing: vi.fn(() => true),
      deleteDrawing: vi.fn((state: RoomState, id: string) => {
        const index = state.drawings.findIndex((d) => d.id === id);
        if (index !== -1) {
          state.drawings.splice(index, 1);
          return true;
        }
        return false;
      }),
      handlePartialErase: vi.fn(() => true),
    } as unknown as MapService;

    mockSelectionService = {
      removeObject: vi.fn((state: RoomState, id: string) => {}),
    } as unknown as SelectionService;

    mockRoomService = {
      getState: vi.fn(() => state),
      saveState: vi.fn(),
    } as unknown as RoomService;

    handler = new DrawingMessageHandler(mockMapService, mockSelectionService, mockRoomService);
  });

  describe("handleDraw", () => {
    it("should add drawing and broadcast", () => {
      const drawing = { id: "draw1", type: "line" } as Drawing;
      const result = handler.handleDraw(state, drawing, "player1");

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(false);
      expect(mockMapService.addDrawing).toHaveBeenCalledWith(state, drawing, "player1");
    });
  });

  describe("handleSyncPlayerDrawings", () => {
    it("should replace player drawings, remove old selections, and save", () => {
      state.drawings = [
        { id: "old1", owner: "player1" } as Drawing,
        { id: "old2", owner: "player2" } as Drawing,
      ];

      const newDrawings = [{ id: "new1" } as Drawing];
      const result = handler.handleSyncPlayerDrawings(state, "player1", newDrawings);

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(true);
      expect(mockMapService.replacePlayerDrawings).toHaveBeenCalledWith(
        state,
        "player1",
        newDrawings,
      );
      expect(mockSelectionService.removeObject).toHaveBeenCalledWith(state, "old1");
    });
  });

  describe("handleUndoDrawing", () => {
    it("should undo drawing and broadcast on success", () => {
      const result = handler.handleUndoDrawing(state, "player1");

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(false);
      expect(mockMapService.undoDrawing).toHaveBeenCalledWith(state, "player1");
    });

    it("should not broadcast on failure", () => {
      mockMapService.undoDrawing = vi.fn(() => false);

      const result = handler.handleUndoDrawing(state, "player1");

      expect(result.broadcast).toBe(false);
      expect(result.save).toBe(false);
    });
  });

  describe("handleRedoDrawing", () => {
    it("should redo drawing and broadcast on success", () => {
      const result = handler.handleRedoDrawing(state, "player1");

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(false);
      expect(mockMapService.redoDrawing).toHaveBeenCalledWith(state, "player1");
    });

    it("should not broadcast on failure", () => {
      mockMapService.redoDrawing = vi.fn(() => false);

      const result = handler.handleRedoDrawing(state, "player1");

      expect(result.broadcast).toBe(false);
      expect(result.save).toBe(false);
    });
  });

  describe("handleClearDrawings", () => {
    it("should allow DM to clear all drawings", () => {
      state.drawings = [
        { id: "draw1", owner: "player1" } as Drawing,
        { id: "draw2", owner: "player2" } as Drawing,
      ];

      const result = handler.handleClearDrawings(state, "dmPlayer", true);

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(false);
      expect(mockMapService.clearDrawings).toHaveBeenCalledWith(state);
      expect(mockSelectionService.removeObject).toHaveBeenCalledWith(state, "draw1");
      expect(mockSelectionService.removeObject).toHaveBeenCalledWith(state, "draw2");
    });

    it("should reject non-DM clearing drawings", () => {
      state.drawings = [{ id: "draw1", owner: "player1" } as Drawing];

      const result = handler.handleClearDrawings(state, "player1", false);

      expect(result.broadcast).toBe(false);
      expect(result.save).toBe(false);
      expect(mockMapService.clearDrawings).not.toHaveBeenCalled();
    });
  });

  describe("handleSelectDrawing", () => {
    it("should select drawing and broadcast on success", () => {
      const result = handler.handleSelectDrawing(state, "draw1", "player1");

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(false);
      expect(mockMapService.selectDrawing).toHaveBeenCalledWith(state, "draw1", "player1");
    });

    it("should not broadcast on failure", () => {
      mockMapService.selectDrawing = vi.fn(() => false);

      const result = handler.handleSelectDrawing(state, "draw1", "player1");

      expect(result.broadcast).toBe(false);
      expect(result.save).toBe(false);
    });
  });

  describe("handleDeselectDrawing", () => {
    it("should deselect drawing and broadcast", () => {
      const result = handler.handleDeselectDrawing(state, "player1");

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(false);
      expect(mockMapService.deselectDrawing).toHaveBeenCalledWith(state, "player1");
    });
  });

  describe("handleMoveDrawing", () => {
    it("should move drawing and broadcast on success", () => {
      const result = handler.handleMoveDrawing(state, "draw1", 10, 20, "player1");

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(false);
      expect(mockMapService.moveDrawing).toHaveBeenCalledWith(state, "draw1", 10, 20, "player1");
    });

    it("should not broadcast on failure", () => {
      mockMapService.moveDrawing = vi.fn(() => false);

      const result = handler.handleMoveDrawing(state, "draw1", 10, 20, "player1");

      expect(result.broadcast).toBe(false);
      expect(result.save).toBe(false);
    });
  });

  describe("handleDeleteDrawing", () => {
    it("should delete drawing, remove from selection, and broadcast", () => {
      state.drawings = [{ id: "draw1", owner: "player1" } as Drawing];

      const result = handler.handleDeleteDrawing(state, "draw1");

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(false);
      expect(mockMapService.deleteDrawing).toHaveBeenCalledWith(state, "draw1");
      expect(mockSelectionService.removeObject).toHaveBeenCalledWith(state, "draw1");
    });

    it("should not broadcast if drawing not found", () => {
      const result = handler.handleDeleteDrawing(state, "nonexistent");

      expect(result.broadcast).toBe(false);
      expect(result.save).toBe(false);
      expect(mockSelectionService.removeObject).not.toHaveBeenCalled();
    });
  });

  describe("handleErasePartial", () => {
    it("should handle partial erase, remove from selection, and broadcast", () => {
      const segments = [{ id: "seg1" }] as any[];

      const result = handler.handleErasePartial(state, "draw1", segments, "player1");

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(false);
      expect(mockMapService.handlePartialErase).toHaveBeenCalledWith(
        state,
        "draw1",
        segments,
        "player1",
      );
      expect(mockSelectionService.removeObject).toHaveBeenCalledWith(state, "draw1");
    });

    it("should not broadcast on failure", () => {
      mockMapService.handlePartialErase = vi.fn(() => false);
      const segments = [{ id: "seg1" }] as any[];

      const result = handler.handleErasePartial(state, "draw1", segments, "player1");

      expect(result.broadcast).toBe(false);
      expect(result.save).toBe(false);
      expect(mockSelectionService.removeObject).not.toHaveBeenCalled();
    });
  });
});
