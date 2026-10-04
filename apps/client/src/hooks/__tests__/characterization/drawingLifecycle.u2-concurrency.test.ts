import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClientMessage } from "@herobyte/shared";
import { escapeRegistry } from "../../../features/interaction/useEscapeOwner";
import {
  flushDrawingFrame,
  middleSplitDrawing,
  mountDrawing,
  moveTo,
  pressAt,
  touchEvent,
} from "./drawingLifecycle.fixtures";

afterEach(cleanup);

describe("annotation live refs rather than rendered drawing state", () => {
  it("press, moves, and release in one event turn commit the complete new stroke once", () => {
    const mounted = mountDrawing();
    act(() => {
      mounted.setPointer({ x: 0, y: 0 });
      mounted.result.current.onMouseDown(mounted.stageRef);
      mounted.setPointer({ x: 10, y: 10 });
      mounted.result.current.onMouseMove(mounted.stageRef);
      mounted.setPointer({ x: 20, y: 20 });
      mounted.result.current.onMouseMove(mounted.stageRef);
      mounted.result.current.onMouseUp();
    });
    expect(mounted.sendMessage).toHaveBeenCalledTimes(1);
    expect(mounted.sendMessage).toHaveBeenCalledWith({
      t: "draw",
      drawing: expect.objectContaining({
        type: "freehand",
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
          { x: 20, y: 20 },
        ],
      }),
    });
    expect(mounted.onDrawingComplete).toHaveBeenCalledTimes(1);
    expect(mounted.result.current.isDrawing).toBe(false);
  });

  it.each(["rect", "eraser"] as const)(
    "same-turn cancel cannot rearm %s through later movement",
    async (drawTool) => {
      const mounted = mountDrawing({
        drawTool,
        drawWidth: 1,
        drawingObjects: [middleSplitDrawing()],
      });
      pressAt(mounted, { x: 0, y: 0 });
      moveTo(mounted, { x: 10, y: 10 });
      act(() => {
        mounted.result.current.cancel();
        mounted.setPointer({ x: 5, y: -1 });
        mounted.result.current.onMouseMove(mounted.stageRef);
        mounted.setPointer({ x: 5, y: 1 });
        mounted.result.current.onMouseMove(mounted.stageRef);
        mounted.result.current.onMouseUp();
      });
      await flushDrawingFrame();
      expect(mounted.sendMessage).not.toHaveBeenCalled();
      expect(mounted.onDrawingComplete).not.toHaveBeenCalled();
      expect(mounted.result.current.currentDrawing).toEqual([]);
      expect(mounted.result.current.isDrawing).toBe(false);
    },
  );

  it("ordinary snapshots, style changes, and callback replacement preserve held points", () => {
    const mounted = mountDrawing();
    const complete = vi.fn<(id: string) => void>();
    pressAt(mounted, { x: 0, y: 0 });
    moveTo(mounted, { x: 10, y: 10 });
    mounted.update({
      drawingObjects: [middleSplitDrawing()],
      drawColor: "#00ff00",
      onDrawingComplete: complete,
    });
    expect(mounted.result.current.isDrawing).toBe(true);
    moveTo(mounted, { x: 20, y: 20 });
    act(() => mounted.result.current.onMouseUp());
    expect(mounted.sendMessage).toHaveBeenCalledExactlyOnceWith({
      t: "draw",
      drawing: expect.objectContaining({
        color: "#00ff00",
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
          { x: 20, y: 20 },
        ],
      }),
    });
    expect(complete).toHaveBeenCalledTimes(1);
    expect(mounted.onDrawingComplete).not.toHaveBeenCalled();
  });

  it("disarms before a send callback can re-enter release and send the same stroke again", () => {
    const send = vi.fn<(message: ClientMessage) => void>();
    const mounted = mountDrawing({ sendMessage: send });
    send.mockImplementation(() => {
      if (send.mock.calls.length === 1) mounted.result.current.onMouseUp();
    });
    pressAt(mounted, { x: 0, y: 0 });
    moveTo(mounted, { x: 10, y: 10 });
    act(() => mounted.result.current.onMouseUp());
    expect(send).toHaveBeenCalledTimes(1);
    expect(mounted.onDrawingComplete).toHaveBeenCalledTimes(1);
  });

  it("clears refs on unmount so retained move/release callbacks cannot emit", async () => {
    const mounted = mountDrawing();
    pressAt(mounted, { x: 0, y: 0 });
    moveTo(mounted, { x: 10, y: 10 });
    const retained = mounted.result.current;
    mounted.unmount();
    mounted.setPointer({ x: 20, y: 20 });
    act(() => {
      retained.onMouseMove(mounted.stageRef);
      retained.onMouseUp();
    });
    await flushDrawingFrame();
    expect(mounted.sendMessage).not.toHaveBeenCalled();
    expect(mounted.onDrawingComplete).not.toHaveBeenCalled();
    expect(escapeRegistry.getPendingLabel()).toBeNull();
  });
});

describe("shared pending control uses the real drawing cancellation primitive", () => {
  it("publishes start/cancel/release scalar changes without notifying for each sample", () => {
    const mounted = mountDrawing();
    const changed = vi.fn();
    const unsubscribe = escapeRegistry.subscribe(changed);
    try {
      expect(escapeRegistry.getPendingLabel()).toBeNull();
      act(() => {
        mounted.setPointer({ x: 0, y: 0 });
        mounted.result.current.onMouseDown(mounted.stageRef);
        // Before React commits: a layout-effect-only publisher is too late.
        expect(escapeRegistry.getPendingLabel()).toBe("Cancel stroke");
        expect(changed).toHaveBeenCalledTimes(1);
      });
      moveTo(mounted, { x: 10, y: 10 });
      moveTo(mounted, { x: 20, y: 20 });
      expect(changed).toHaveBeenCalledTimes(1);
      act(() => {
        mounted.result.current.cancel(); // Also used directly by second-finger/OS routes.
        expect(escapeRegistry.getPendingLabel()).toBeNull();
        expect(changed).toHaveBeenCalledTimes(2);
      });
      expect(escapeRegistry.getPendingLabel()).toBeNull();
      expect(changed).toHaveBeenCalledTimes(2);
      act(() => mounted.result.current.onMouseUp());
      expect(mounted.sendMessage).not.toHaveBeenCalled();
      pressAt(mounted, { x: 30, y: 30 });
      act(() => {
        mounted.result.current.onMouseUp(); // Degenerate tap also clears availability.
        expect(escapeRegistry.getPendingLabel()).toBeNull();
      });
      expect(escapeRegistry.getPendingLabel()).toBeNull();
      expect(changed).toHaveBeenCalledTimes(4);
    } finally {
      unsubscribe();
    }
  });

  it("external Cancel while touch remains held rejects router move/release, then a new touch works", () => {
    const mounted = mountDrawing();
    mounted.setPointer({ x: 0, y: 0 });
    act(() => mounted.result.current.touch.onTouchStart(touchEvent(1)));
    mounted.setPointer({ x: 10, y: 10 });
    act(() => mounted.result.current.touch.onTouchMove(touchEvent(1)));
    act(() => {
      expect(escapeRegistry.cancelPending()).toBe(true);
      mounted.setPointer({ x: 20, y: 20 });
      mounted.result.current.touch.onTouchMove(touchEvent(1));
      mounted.setPointer({ x: 30, y: 30 });
      mounted.result.current.touch.onTouchMove(touchEvent(1));
      mounted.result.current.touch.onTouchEnd();
    });
    expect(mounted.sendMessage).not.toHaveBeenCalled();
    expect(mounted.camera.end).toHaveBeenCalledTimes(1);
    mounted.setPointer({ x: 40, y: 40 });
    act(() => mounted.result.current.touch.onTouchStart(touchEvent(1)));
    mounted.setPointer({ x: 60, y: 60 });
    act(() => mounted.result.current.touch.onTouchMove(touchEvent(1)));
    act(() => mounted.result.current.touch.onTouchEnd());
    expect(mounted.sendMessage).toHaveBeenCalledExactlyOnceWith({
      t: "draw",
      drawing: expect.objectContaining({
        type: "freehand",
        points: [
          { x: 40, y: 40 },
          { x: 60, y: 60 },
        ],
      }),
    });
  });
});
