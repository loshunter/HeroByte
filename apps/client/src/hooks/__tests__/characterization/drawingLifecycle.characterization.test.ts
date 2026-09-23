// U2 baseline at 44c6ab82, before changing annotation cancellation.
import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  flushDrawingFrame,
  middleSplitDrawing,
  mountDrawing,
  moveTo,
  pressAt,
  touchEvent,
} from "./drawingLifecycle.fixtures";

afterEach(cleanup);

describe("annotation lifecycle before U2 extraction", () => {
  it("commits all freehand world samples once when released before the preview frame", async () => {
    const mounted = mountDrawing({ toWorld: (x, y) => ({ x: x * 2 + 10, y: y * 2 - 5 }) });
    pressAt(mounted, { x: 10, y: 20 });
    moveTo(mounted, { x: 30, y: 40 });
    moveTo(mounted, { x: 50, y: 60 });
    expect(mounted.sendMessage).not.toHaveBeenCalled();

    act(() => mounted.result.current.onMouseUp());
    await flushDrawingFrame();
    act(() => mounted.result.current.onMouseUp());

    expect(mounted.sendMessage).toHaveBeenCalledTimes(1);
    expect(mounted.sendMessage).toHaveBeenCalledWith({
      t: "draw",
      drawing: {
        id: expect.any(String),
        type: "freehand",
        points: [
          { x: 30, y: 35 },
          { x: 70, y: 75 },
          { x: 110, y: 115 },
        ],
        color: "#ff8800",
        width: 3,
        opacity: 0.8,
        filled: false,
      },
    });
    const message = mounted.sendMessage.mock.calls[0]?.[0];
    if (message?.t !== "draw") throw new Error("Expected a draw message");
    expect(mounted.onDrawingComplete).toHaveBeenCalledTimes(1);
    expect(mounted.onDrawingComplete).toHaveBeenCalledWith(message.drawing.id);
    expect(mounted.result.current.currentDrawing).toEqual([]);
    expect(mounted.result.current.currentTemplate).toBeUndefined();
    expect(mounted.result.current.isDrawing).toBe(false);
  });

  it("commits the snapped cone preview and clears its geometry and metadata", async () => {
    const mounted = mountDrawing({ drawTool: "template-cone" });
    pressAt(mounted, { x: 131, y: 119 });
    moveTo(mounted, { x: 281, y: 119 });
    await flushDrawingFrame();
    const preview = mounted.result.current.currentDrawing;
    expect(preview).toHaveLength(3);
    expect(preview[0]).toEqual({ x: 125, y: 125 });
    expect(mounted.result.current.currentTemplate).toEqual({ kind: "cone", sizeFeet: 15 });
    expect(mounted.sendMessage).not.toHaveBeenCalled();

    act(() => mounted.result.current.onMouseUp());

    expect(mounted.sendMessage).toHaveBeenCalledTimes(1);
    expect(mounted.sendMessage).toHaveBeenCalledWith({
      t: "draw",
      drawing: {
        id: expect.any(String),
        type: "template",
        points: preview,
        color: "#ff8800",
        width: 3,
        opacity: 0.8,
        filled: true,
        template: { kind: "cone", sizeFeet: 15 },
      },
    });
    const message = mounted.sendMessage.mock.calls[0]?.[0];
    if (message?.t !== "draw") throw new Error("Expected a draw message");
    expect(mounted.onDrawingComplete).toHaveBeenCalledTimes(1);
    expect(mounted.onDrawingComplete).toHaveBeenCalledWith(message.drawing.id);
    expect(mounted.result.current.currentDrawing).toEqual([]);
    expect(mounted.result.current.currentTemplate).toBeUndefined();
    expect(mounted.result.current.isDrawing).toBe(false);
  });

  it("cancel followed immediately by release discards a template and its queued frame", async () => {
    const mounted = mountDrawing({ drawTool: "template-cone" });
    pressAt(mounted, { x: 100, y: 100 });
    moveTo(mounted, { x: 250, y: 100 });
    await flushDrawingFrame();
    expect(mounted.result.current.currentTemplate).toBeDefined();
    moveTo(mounted, { x: 300, y: 100 });

    act(() => {
      mounted.result.current.cancel();
      mounted.result.current.onMouseUp();
    });
    await flushDrawingFrame();
    act(() => mounted.result.current.onMouseUp());

    expect(mounted.sendMessage).not.toHaveBeenCalled();
    expect(mounted.onDrawingComplete).not.toHaveBeenCalled();
    expect(mounted.result.current.currentDrawing).toEqual([]);
    expect(mounted.result.current.currentTemplate).toBeUndefined();
    expect(mounted.result.current.isDrawing).toBe(false);
  });

  it("BASELINE BUG: same-turn movement after cancel can rebuild and commit freehand points", () => {
    const mounted = mountDrawing();
    pressAt(mounted, { x: 0, y: 0 });
    moveTo(mounted, { x: 10, y: 10 });

    // One act deliberately keeps the pre-cancel render's callbacks. Two movement
    // samples reach freehand's minimum size; a single sample would hide the send.
    act(() => {
      mounted.result.current.cancel();
      mounted.setPointer({ x: 20, y: 20 });
      mounted.result.current.onMouseMove(mounted.stageRef);
      mounted.setPointer({ x: 30, y: 30 });
      mounted.result.current.onMouseMove(mounted.stageRef);
      mounted.result.current.onMouseUp();
    });

    expect(mounted.sendMessage).toHaveBeenCalledTimes(1);
    expect(mounted.sendMessage).toHaveBeenCalledWith({
      t: "draw",
      drawing: expect.objectContaining({
        type: "freehand",
        points: [
          { x: 20, y: 20 },
          { x: 30, y: 30 },
        ],
      }),
    });
    expect(mounted.onDrawingComplete).toHaveBeenCalledTimes(1);
  });

  it("leaving and re-entering Draw while held discards the previous stroke", async () => {
    const mounted = mountDrawing();
    pressAt(mounted, { x: 0, y: 0 });
    moveTo(mounted, { x: 30, y: 30 });

    mounted.update({ drawMode: false });
    expect(mounted.result.current.currentDrawing).toEqual([]);
    expect(mounted.result.current.isDrawing).toBe(false);
    mounted.update({ drawMode: true });
    moveTo(mounted, { x: 60, y: 60 });
    act(() => mounted.result.current.onMouseUp());
    await flushDrawingFrame();

    expect(mounted.sendMessage).not.toHaveBeenCalled();
    expect(mounted.onDrawingComplete).not.toHaveBeenCalled();
    expect(mounted.result.current.currentDrawing).toEqual([]);
    expect(mounted.result.current.currentTemplate).toBeUndefined();
  });

  it("BASELINE BUG: changing freehand to rectangle while held commits the old points as a rectangle", () => {
    const mounted = mountDrawing();
    pressAt(mounted, { x: 10, y: 20 });
    moveTo(mounted, { x: 40, y: 60 });

    mounted.update({ drawTool: "rect" });
    expect(mounted.result.current.isDrawing).toBe(true);
    act(() => mounted.result.current.onMouseUp());

    expect(mounted.sendMessage).toHaveBeenCalledTimes(1);
    expect(mounted.sendMessage).toHaveBeenCalledWith({
      t: "draw",
      drawing: expect.objectContaining({
        type: "rect",
        points: [
          { x: 10, y: 20 },
          { x: 40, y: 60 },
        ],
      }),
    });
    expect(mounted.onDrawingComplete).toHaveBeenCalledTimes(1);
  });

  it("normal eraser release sends real partial segments and never creates an eraser drawing", () => {
    const mounted = mountDrawing({
      drawTool: "eraser",
      drawWidth: 1,
      drawingObjects: [middleSplitDrawing()],
    });
    pressAt(mounted, { x: 5, y: -1 });
    moveTo(mounted, { x: 5, y: 1 });
    expect(mounted.sendMessage).not.toHaveBeenCalled();

    act(() => mounted.result.current.onMouseUp());

    const segmentStyle = {
      type: "freehand",
      color: "#ff00ff",
      width: 1,
      opacity: 0.8,
      filled: false,
      owner: "player-1",
    };
    expect(mounted.sendMessage).toHaveBeenCalledTimes(1);
    expect(mounted.sendMessage).toHaveBeenCalledWith({
      t: "erase-partial",
      deleteId: "drawing-1",
      segments: [
        {
          ...segmentStyle,
          points: [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
            { x: 4, y: 0 },
          ],
        },
        {
          ...segmentStyle,
          points: [
            { x: 6, y: 0 },
            { x: 8, y: 0 },
            { x: 10, y: 0 },
          ],
        },
      ],
    });
    expect(mounted.onDrawingComplete).not.toHaveBeenCalled();
    expect(mounted.result.current.currentDrawing).toEqual([]);
    expect(mounted.result.current.isDrawing).toBe(false);
  });

  it("the real touch adapters cancel drawing on a second finger and keep forwarding camera events", async () => {
    const mounted = mountDrawing();
    mounted.setPointer({ x: 10, y: 20 });
    act(() => mounted.result.current.touch.onTouchStart(touchEvent(1)));
    mounted.setPointer({ x: 40, y: 60 });
    act(() => mounted.result.current.touch.onTouchMove(touchEvent(1)));
    await flushDrawingFrame();
    expect(mounted.result.current.currentDrawing).toEqual([
      { x: 10, y: 20 },
      { x: 40, y: 60 },
    ]);
    const secondFinger = touchEvent(2);
    const pinchMove = touchEvent(2);

    act(() => {
      mounted.result.current.touch.onTouchStart(secondFinger);
      mounted.result.current.touch.onTouchMove(pinchMove);
      mounted.result.current.touch.onTouchMove(touchEvent(1));
      mounted.result.current.touch.onTouchEnd();
    });
    await flushDrawingFrame();

    expect(mounted.sendMessage).not.toHaveBeenCalled();
    expect(mounted.onDrawingComplete).not.toHaveBeenCalled();
    expect(mounted.result.current.currentDrawing).toEqual([]);
    expect(mounted.result.current.isDrawing).toBe(false);
    expect(mounted.camera.start).toHaveBeenLastCalledWith(secondFinger, mounted.stageRef, false);
    expect(mounted.camera.move).toHaveBeenCalledWith(pinchMove, mounted.stageRef);
    expect(mounted.camera.end).toHaveBeenCalledTimes(1);
  });
});
