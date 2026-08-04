import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import type { SceneObject } from "@herobyte/shared";
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
        gridSize: 50,
        gridSquareSize: 5,
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
        gridSize: 50,
        gridSquareSize: 5,
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
        gridSize: 50,
        gridSquareSize: 5,
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
        gridSize: 50,
        gridSquareSize: 5,
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

describe("useDrawingTool - area templates (S6)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mountTemplateTool(drawTool: string, stage: ReturnType<typeof createStageStub>) {
    const sendMessage = vi.fn();
    const onDrawingComplete = vi.fn();
    const hook = renderHook(() =>
      useDrawingTool({
        drawMode: true,
        drawTool: drawTool as never,
        drawColor: "#ff8800",
        drawWidth: 3,
        drawOpacity: 0.8,
        drawFilled: false,
        gridSize: 50,
        gridSquareSize: 5,
        toWorld: (x: number, y: number) => ({ x, y }),
        sendMessage,
        onDrawingComplete,
        drawingObjects: [],
      }),
    );
    return { ...hook, sendMessage, onDrawingComplete, stage };
  }

  /**
   * The preview is batched through requestAnimationFrame (so a drag does not
   * re-render per mouse event), so every assertion on `currentDrawing` has to
   * let a frame land first.
   */
  async function flushFrame() {
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });
  }

  async function drawTemplate(drawTool: string, from: Pointer, to: Pointer) {
    const stage = createStageStub([from, to, to]);
    const mounted = mountTemplateTool(drawTool, stage);
    act(() => mounted.result.current.onMouseDown({ current: stage } as never));
    act(() => mounted.result.current.onMouseMove({ current: stage } as never));
    await flushFrame();
    return mounted;
  }

  it("previews the SNAPPED polygon while dragging, not the raw drag", async () => {
    const { result } = await drawTemplate("template-cone", { x: 131, y: 119 }, { x: 281, y: 119 });

    // Origin snapped to the cell centre at (125,125); a cone is a triangle.
    expect(result.current.currentDrawing).toHaveLength(3);
    expect(result.current.currentDrawing[0]).toEqual({ x: 125, y: 125 });
    expect(result.current.currentTemplate).toEqual({ kind: "cone", sizeFeet: 15 });
  });

  it("commits exactly the polygon it previewed", async () => {
    const mounted = await drawTemplate("template-circle", { x: 100, y: 100 }, { x: 250, y: 100 });
    const previewed = mounted.result.current.currentDrawing;

    act(() => mounted.result.current.onMouseUp());

    expect(mounted.sendMessage).toHaveBeenCalledTimes(1);
    const [message] = mounted.sendMessage.mock.calls[0];
    expect(message.t).toBe("draw");
    expect(message.drawing.type).toBe("template");
    expect(message.drawing.points).toEqual(previewed);
    expect(message.drawing.template).toEqual({ kind: "circle", sizeFeet: 15 });
    expect(message.drawing.filled).toBe(true);
    expect(mounted.onDrawingComplete).toHaveBeenCalledWith(message.drawing.id);
  });

  it("commits nothing for a tap that never moved", () => {
    const stage = createStageStub([{ x: 100, y: 100 }]);
    const mounted = mountTemplateTool("template-square", stage);
    act(() => mounted.result.current.onMouseDown({ current: stage } as never));
    act(() => mounted.result.current.onMouseUp());

    expect(mounted.sendMessage).not.toHaveBeenCalled();
    expect(mounted.onDrawingComplete).not.toHaveBeenCalled();
  });

  it("clears the preview after committing", async () => {
    const mounted = await drawTemplate("template-line", { x: 100, y: 100 }, { x: 250, y: 100 });
    act(() => mounted.result.current.onMouseUp());

    expect(mounted.result.current.currentDrawing).toEqual([]);
    expect(mounted.result.current.currentTemplate).toBeUndefined();
  });

  it("abandons the template when a second finger cancels the stroke", async () => {
    const mounted = await drawTemplate("template-cone", { x: 100, y: 100 }, { x: 250, y: 100 });
    act(() => mounted.result.current.cancel());

    expect(mounted.result.current.currentDrawing).toEqual([]);
    expect(mounted.result.current.currentTemplate).toBeUndefined();
    expect(mounted.sendMessage).not.toHaveBeenCalled();
  });

  it("leaves currentTemplate undefined for a plain drawing tool", async () => {
    const mounted = await drawTemplate("rect", { x: 100, y: 100 }, { x: 250, y: 100 });

    expect(mounted.result.current.currentTemplate).toBeUndefined();
    act(() => mounted.result.current.onMouseUp());
    const [message] = mounted.sendMessage.mock.calls[0];
    expect(message.drawing.type).toBe("rect");
    expect(message.drawing.template).toBeUndefined();
  });
});
