import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Player } from "@shared";
import { MapService } from "../map/service.js";
import { createEmptyRoomState } from "../room/model.js";

const baseDrawing = () => ({
  id: "drawing-1",
  type: "freehand" as const,
  points: [{ x: 0, y: 0 }],
  color: "#fff",
  width: 4,
  opacity: 1,
});

describe("MapService", () => {
  const service = new MapService();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("updates background, grid size, and pointers", () => {
    const state = createEmptyRoomState();
    state.players = [{ uid: "uid-1", name: "Alice" } as Player];
    service.setBackground(state, "bg");
    service.setGridSize(state, 64);
    service.setGridSquareSize(state, 10);
    service.placePointer(state, "uid-1", 5, 6);
    service.placePointer(state, "uid-1", 7, 8);

    expect(state.mapBackground).toBe("bg");
    expect(state.gridSize).toBe(64);
    expect(state.gridSquareSize).toBe(10);
    // Multiple pointers supported (temporary pulse behavior)
    expect(state.pointers).toHaveLength(2);
    expect(state.pointers[0]).toMatchObject({ uid: "uid-1", x: 5, y: 6, name: "Alice" });
    expect(state.pointers[1]).toMatchObject({ uid: "uid-1", x: 7, y: 8, name: "Alice" });
  });

  it("manages drawing lifecycle", () => {
    const state = createEmptyRoomState();

    service.addDrawing(state, baseDrawing(), "uid-1");
    service.addDrawing(state, { ...baseDrawing(), id: "drawing-2" }, "uid-2");
    expect(state.drawings).toHaveLength(2);
    expect(state.drawings[0]?.owner).toBe("uid-1");

    expect(service.undoDrawing(state, "uid-1")).toBe(true);
    expect(state.drawings).toHaveLength(1);
    expect(service.redoDrawing(state, "uid-1")).toBe(true);
    expect(state.drawings).toHaveLength(2);

    service.clearDrawings(state);
    expect(state.drawings).toHaveLength(0);
  });

  it("maintains redo stack per player", () => {
    const state = createEmptyRoomState();

    service.addDrawing(state, baseDrawing(), "uid-1");
    service.addDrawing(state, { ...baseDrawing(), id: "drawing-2" }, "uid-1");
    expect(service.undoDrawing(state, "uid-1")).toBe(true);
    expect(state.drawings.map((d) => d.id)).toEqual(["drawing-1"]);

    expect(service.redoDrawing(state, "uid-1")).toBe(true);
    expect(state.drawings.map((d) => d.id)).toEqual(["drawing-1", "drawing-2"]);

    // New drawing clears redo stack
    service.addDrawing(state, { ...baseDrawing(), id: "drawing-3" }, "uid-1");
    expect(service.redoDrawing(state, "uid-1")).toBe(false);
  });

  it("supports selecting, moving, and deselecting drawings", () => {
    const state = createEmptyRoomState();
    const drawing = baseDrawing();
    service.addDrawing(state, drawing, "uid-1");

    expect(service.selectDrawing(state, drawing.id, "uid-1")).toBe(true);
    expect(state.drawings[0]?.selectedBy).toBe("uid-1");

    expect(service.moveDrawing(state, drawing.id, 10, 20, "uid-1")).toBe(true);
    expect(state.drawings[0]?.points[0]).toEqual({ x: 10, y: 20 });

    service.deselectDrawing(state, "uid-1");
    expect(state.drawings[0]?.selectedBy).toBeUndefined();
  });

  it("deletes drawings when requested", () => {
    const state = createEmptyRoomState();
    service.addDrawing(state, baseDrawing(), "uid-1");
    expect(service.deleteDrawing(state, "drawing-1")).toBe(true);
    expect(state.drawings).toHaveLength(0);
  });

  it("handles partial erasing by replacing drawings with new segments", () => {
    const state = createEmptyRoomState();
    const original = {
      id: "drawing-1",
      type: "freehand" as const,
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
        { x: 10, y: 10 },
      ],
      color: "#00ff00",
      width: 3,
      opacity: 0.8,
    };
    service.addDrawing(state, original, "uid-1");
    state.drawingRedoStacks["uid-1"] = [{ ...original, owner: "uid-1" }];

    const segments = [
      {
        type: "freehand" as const,
        points: [
          { x: 0, y: 0 },
          { x: 5, y: 5 },
        ],
        color: "#00ff00",
        width: 3,
        opacity: 0.8,
      },
      {
        type: "freehand" as const,
        points: [
          { x: 5, y: 5 },
          { x: 10, y: 10 },
        ],
        color: "#00ff00",
        width: 3,
        opacity: 0.8,
      },
    ];

    expect(service.handlePartialErase(state, "drawing-1", segments, "uid-1")).toBe(true);

    expect(state.drawings).toHaveLength(2);
    const ids = state.drawings.map((d) => d.id);
    expect(ids).not.toContain("drawing-1");
    expect(new Set(ids).size).toBe(2);
    expect(state.drawings.every((d) => d.owner === "uid-1")).toBe(true);
    expect(state.drawings[0]?.points).toEqual(segments[0]?.points);
    expect(state.drawings[1]?.points).toEqual(segments[1]?.points);
    expect(state.drawingRedoStacks["uid-1"]).toEqual([]);
  });

  it("returns false when attempting partial erase on missing or unauthorized drawing", () => {
    const state = createEmptyRoomState();
    const segments = [
      {
        type: "freehand" as const,
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        color: "#ffffff",
        width: 2,
        opacity: 1,
      },
    ];

    expect(service.handlePartialErase(state, "missing", segments, "uid-1")).toBe(false);

    service.addDrawing(state, baseDrawing(), "owner-2");
    expect(service.handlePartialErase(state, "drawing-1", segments, "uid-1")).toBe(false);
  });
});
