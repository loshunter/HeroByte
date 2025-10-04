import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MapService } from "../map/service.ts";
import { createEmptyRoomState } from "../room/model.ts";

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
    service.setBackground(state, "bg");
    service.setGridSize(state, 64);
    service.placePointer(state, "uid-1", 5, 6);
    service.placePointer(state, "uid-1", 7, 8);

    expect(state.mapBackground).toBe("bg");
    expect(state.gridSize).toBe(64);
    expect(state.pointers).toHaveLength(1);
    expect(state.pointers[0]).toMatchObject({ uid: "uid-1", x: 7, y: 8 });
  });

  it("manages drawing lifecycle", () => {
    const state = createEmptyRoomState();

    service.addDrawing(state, baseDrawing(), "uid-1");
    service.addDrawing(state, { ...baseDrawing(), id: "drawing-2" }, "uid-2");
    expect(state.drawings).toHaveLength(2);
    expect(state.drawings[0]?.owner).toBe("uid-1");

    expect(service.undoDrawing(state, "uid-1")).toBe(true);
    expect(state.drawings).toHaveLength(1);

    service.clearDrawings(state);
    expect(state.drawings).toHaveLength(0);
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
});
