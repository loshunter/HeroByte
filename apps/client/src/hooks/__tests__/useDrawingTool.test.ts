import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import type { SceneObject } from "@shared";
import { useDrawingTool } from "../useDrawingTool.js";
import * as splitModule from "../../features/drawing/utils/splitFreehandDrawing.js";

interface Pointer {
  x: number;
  y: number;
}

function createStageStub(points: Pointer[]) {
  const queue = [...points];
  return {
    getPointerPosition: () => {
      if (queue.length > 0) {
        return queue.shift()!;
      }
      return points[points.length - 1]!;
    },
  };
}

function createFreehandSceneObject(overrides: Partial<SceneObject & { type: "drawing" }> = {}) {
  return {
    id: "drawing:1",
    type: "drawing" as const,
    owner: "uid-1",
    locked: false,
    zIndex: 1,
    transform: {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    },
    data: {
      drawing: {
        id: "drawing-1",
        type: "freehand" as const,
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        color: "#ff00ff",
        width: 2,
        opacity: 1,
        owner: "uid-1",
      },
    },
    ...overrides,
  } satisfies SceneObject & { type: "drawing" };
}

describe("useDrawingTool - partial erase", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends erase-partial message when splitFreehandDrawing returns segments", () => {
    const sendMessage = vi.fn();
    const splitSpy = vi.spyOn(splitModule, "splitFreehandDrawing").mockReturnValue([
      {
        type: "freehand",
        points: [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
        ],
        color: "#ff00ff",
        width: 2,
        opacity: 1,
        owner: "uid-1",
      },
    ]);

    const drawingObjects = [createFreehandSceneObject()];
    const stage = createStageStub([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ]);

    const { result } = renderHook(() =>
      useDrawingTool({
        drawMode: true,
        drawTool: "eraser",
        drawColor: "#ffffff",
        drawWidth: 2,
        drawOpacity: 1,
        drawFilled: false,
        toWorld: (x, y) => ({ x, y }),
        sendMessage,
        drawingObjects,
      }),
    );

    act(() => {
      result.current.onMouseDown({ current: stage } as never);
    });
    act(() => {
      result.current.onMouseMove({ current: stage } as never);
    });
    act(() => {
      result.current.onMouseMove({ current: stage } as never);
    });
    act(() => {
      result.current.onMouseUp();
    });

    expect(splitSpy).toHaveBeenCalledWith(drawingObjects[0], expect.any(Array), 2);
    expect(sendMessage).toHaveBeenCalledWith({
      t: "erase-partial",
      deleteId: "drawing-1",
      segments: splitSpy.mock.results[0]?.value,
    });
  });

  it("falls back to delete-drawing when splitFreehandDrawing returns no segments", () => {
    const sendMessage = vi.fn();
    vi.spyOn(splitModule, "splitFreehandDrawing").mockReturnValue([]);

    const drawingObjects = [createFreehandSceneObject()];
    const stage = createStageStub([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ]);

    const { result } = renderHook(() =>
      useDrawingTool({
        drawMode: true,
        drawTool: "eraser",
        drawColor: "#ffffff",
        drawWidth: 2,
        drawOpacity: 1,
        drawFilled: false,
        toWorld: (x, y) => ({ x, y }),
        sendMessage,
        drawingObjects,
      }),
    );

    act(() => {
      result.current.onMouseDown({ current: stage } as never);
    });
    act(() => {
      result.current.onMouseMove({ current: stage } as never);
    });
    act(() => {
      result.current.onMouseMove({ current: stage } as never);
    });
    act(() => {
      result.current.onMouseUp();
    });

    expect(sendMessage).toHaveBeenCalledWith({ t: "delete-drawing", id: "drawing-1" });
  });

  it("does nothing when splitFreehandDrawing returns the untouched drawing", () => {
    const sendMessage = vi.fn();
    vi.spyOn(splitModule, "splitFreehandDrawing").mockReturnValue([
      {
        type: "freehand" as const,
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        color: "#ff00ff",
        width: 2,
        opacity: 1,
        owner: "uid-1",
      },
    ]);

    const drawingObjects = [createFreehandSceneObject()];
    const stage = createStageStub([
      { x: 0, y: 10 },
      { x: 5, y: 10 },
      { x: 10, y: 10 },
    ]);

    const { result } = renderHook(() =>
      useDrawingTool({
        drawMode: true,
        drawTool: "eraser",
        drawColor: "#ffffff",
        drawWidth: 2,
        drawOpacity: 1,
        drawFilled: false,
        toWorld: (x, y) => ({ x, y }),
        sendMessage,
        drawingObjects,
      }),
    );

    act(() => {
      result.current.onMouseDown({ current: stage } as never);
    });
    act(() => {
      result.current.onMouseMove({ current: stage } as never);
    });
    act(() => {
      result.current.onMouseMove({ current: stage } as never);
    });
    act(() => {
      result.current.onMouseUp();
    });

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("continues to delete non-freehand drawings when erasing", () => {
    const sendMessage = vi.fn();
    const drawingObjects = [
      createFreehandSceneObject({
        data: {
          drawing: {
            id: "drawing-1",
            type: "line",
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
            ],
            color: "#ff00ff",
            width: 2,
            opacity: 1,
            owner: "uid-1",
          },
        },
      }),
    ];

    const stage = createStageStub([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ]);

    const { result } = renderHook(() =>
      useDrawingTool({
        drawMode: true,
        drawTool: "eraser",
        drawColor: "#ffffff",
        drawWidth: 2,
        drawOpacity: 1,
        drawFilled: false,
        toWorld: (x, y) => ({ x, y }),
        sendMessage,
        drawingObjects,
      }),
    );

    act(() => {
      result.current.onMouseDown({ current: stage } as never);
    });
    act(() => {
      result.current.onMouseMove({ current: stage } as never);
    });
    act(() => {
      result.current.onMouseMove({ current: stage } as never);
    });
    act(() => {
      result.current.onMouseUp();
    });

    expect(sendMessage).toHaveBeenCalledWith({ t: "delete-drawing", id: "drawing-1" });
  });
});
