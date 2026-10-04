// Do not adopt alongside contradictory baseline assertions or mark it.fails/skip.
import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { flushDrawingFrame, mountDrawing, moveTo, pressAt } from "./drawingLifecycle.fixtures";

afterEach(cleanup);

describe("annotation cancellation intended U2 behavior", () => {
  it("cancel rejects subsequent movement and release within the same React event turn", async () => {
    const mounted = mountDrawing();
    pressAt(mounted, { x: 0, y: 0 });
    moveTo(mounted, { x: 10, y: 10 });

    // No act boundary between cancel, moves and release. A rendered-state-only
    // guard cannot satisfy this: the current render still says isDrawing=true.
    act(() => {
      mounted.result.current.cancel();
      mounted.setPointer({ x: 20, y: 20 });
      mounted.result.current.onMouseMove(mounted.stageRef);
      mounted.setPointer({ x: 30, y: 30 });
      mounted.result.current.onMouseMove(mounted.stageRef);
      mounted.result.current.onMouseUp();
    });
    await flushDrawingFrame();

    expect(mounted.sendMessage).not.toHaveBeenCalled();
    expect(mounted.onDrawingComplete).not.toHaveBeenCalled();
    expect(mounted.result.current.currentDrawing).toEqual([]);
    expect(mounted.result.current.currentTemplate).toBeUndefined();
    expect(mounted.result.current.isDrawing).toBe(false);

    // Cancellation retains the armed tool; a deliberate new press still works.
    pressAt(mounted, { x: 50, y: 50 });
    moveTo(mounted, { x: 70, y: 70 });
    act(() => mounted.result.current.onMouseUp());
    expect(mounted.sendMessage).toHaveBeenCalledTimes(1);
    expect(mounted.sendMessage).toHaveBeenCalledWith({
      t: "draw",
      drawing: expect.objectContaining({
        type: "freehand",
        points: [
          { x: 50, y: 50 },
          { x: 70, y: 70 },
        ],
      }),
    });
  });

  it("changing drawing-tool identity discards held work and requires a new press", async () => {
    const mounted = mountDrawing();
    pressAt(mounted, { x: 10, y: 20 });
    moveTo(mounted, { x: 40, y: 60 });

    mounted.update({ drawTool: "rect" });
    expect(mounted.result.current.isDrawing).toBe(false);
    expect(mounted.result.current.currentDrawing).toEqual([]);
    moveTo(mounted, { x: 80, y: 90 });
    act(() => mounted.result.current.onMouseUp());
    await flushDrawingFrame();

    expect(mounted.sendMessage).not.toHaveBeenCalled();
    expect(mounted.onDrawingComplete).not.toHaveBeenCalled();
    expect(mounted.result.current.currentDrawing).toEqual([]);
    expect(mounted.result.current.currentTemplate).toBeUndefined();

    pressAt(mounted, { x: 100, y: 100 });
    moveTo(mounted, { x: 150, y: 150 });
    act(() => mounted.result.current.onMouseUp());
    expect(mounted.sendMessage).toHaveBeenCalledTimes(1);
    expect(mounted.sendMessage).toHaveBeenCalledWith({
      t: "draw",
      drawing: expect.objectContaining({
        type: "rect",
        points: [
          { x: 100, y: 100 },
          { x: 150, y: 150 },
        ],
      }),
    });
  });
});
