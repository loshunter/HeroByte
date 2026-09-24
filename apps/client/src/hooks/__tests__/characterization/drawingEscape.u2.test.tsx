// Destination: apps/client/src/hooks/__tests__/characterization/drawingEscape.u2.test.tsx
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type Konva from "konva";
import type { ClientMessage } from "@herobyte/shared";
import { useDrawingTool } from "../../useDrawingTool";
import { useToolMode } from "../../useToolMode";

afterEach(cleanup);

describe("real annotation and tool-mode Escape ownership", () => {
  it.each([false, true])(
    "first Escape cancels held drawing and a later Escape selects Move; driverFirst=%s",
    (driverFirst) => {
      let point = { x: 0, y: 0 };
      const stageRef = { current: { getPointerPosition: () => point } as unknown as Konva.Stage };
      const send = vi.fn<(message: ClientMessage) => void>();
      let mode: ReturnType<typeof useToolMode> | null = null;
      let drawing: ReturnType<typeof useDrawingTool> | null = null;
      function Driver({ drawMode }: { drawMode: boolean }) {
        drawing = useDrawingTool({
          drawMode,
          drawTool: "freehand",
          drawColor: "#ffaa00",
          drawWidth: 3,
          drawOpacity: 1,
          drawFilled: false,
          gridSize: 50,
          gridSquareSize: 5,
          toWorld: (x, y) => ({ x, y }),
          sendMessage: send,
          drawingObjects: [],
        });
        return null;
      }
      function Harness({ mounted }: { mounted: boolean }) {
        mode = useToolMode();
        return mounted ? <Driver drawMode={mode.drawMode} /> : null;
      }
      const currentMode = () => {
        if (!mode) throw new Error("Missing real mode hook");
        return mode;
      };
      const currentDrawing = () => {
        if (!drawing) throw new Error("Missing real drawing hook");
        return drawing;
      };
      const view = render(<Harness mounted={driverFirst} />);
      act(() => currentMode().setActiveTool("draw"));
      if (!driverFirst) view.rerender(<Harness mounted />);
      act(() => currentDrawing().onMouseDown(stageRef));
      point = { x: 10, y: 10 };
      act(() => currentDrawing().onMouseMove(stageRef));
      act(() => {
        fireEvent.keyDown(document.body, { key: "Escape" });
        point = { x: 20, y: 20 };
        currentDrawing().onMouseMove(stageRef);
        point = { x: 30, y: 30 };
        currentDrawing().onMouseMove(stageRef);
        currentDrawing().onMouseUp();
      });
      expect(currentMode().activeTool).toBe("draw");
      expect(currentDrawing().isDrawing).toBe(false);
      expect(currentDrawing().currentDrawing).toEqual([]);
      expect(send).not.toHaveBeenCalled();
      // A fresh stroke remains possible without reselecting Draw.
      point = { x: 40, y: 40 };
      act(() => currentDrawing().onMouseDown(stageRef));
      point = { x: 60, y: 60 };
      act(() => currentDrawing().onMouseMove(stageRef));
      act(() => currentDrawing().onMouseUp());
      expect(send).toHaveBeenCalledExactlyOnceWith({
        t: "draw",
        drawing: expect.objectContaining({
          type: "freehand",
          points: [
            { x: 40, y: 40 },
            { x: 60, y: 60 },
          ],
        }),
      });
      fireEvent.keyDown(document.body, { key: "Escape" });
      expect(currentMode().activeTool).toBeNull();
      expect(send).toHaveBeenCalledTimes(1);
    },
  );
});
