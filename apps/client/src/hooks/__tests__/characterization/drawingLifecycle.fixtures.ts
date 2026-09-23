// DRAFT ONLY; imports target hooks/__tests__/characterization/ on adoption.
import { act, renderHook } from "@testing-library/react";
import { vi } from "vitest";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { ClientMessage, SceneObject } from "@herobyte/shared";
import { useDrawingTool } from "../../useDrawingTool";
import { useArmedTouchTool } from "../../useArmedTouchTool";
import { useTouchGestureRouter } from "../../useTouchGestureRouter";

type DrawingOptions = Parameters<typeof useDrawingTool>[0];
export type Point = { x: number; y: number };

const unrelatedTool = () => {
  throw new Error("A drawing gesture reached an unrelated tool boundary");
};

export function mountDrawing(overrides: Partial<DrawingOptions> = {}) {
  let pointer: Point = { x: 0, y: 0 };
  const container = document.createElement("div");
  const stageRef = {
    current: {
      getPointerPosition: () => pointer,
      container: () => container,
    } as unknown as Konva.Stage,
  };
  const sendMessage = vi.fn<(message: ClientMessage) => void>();
  const onDrawingComplete = vi.fn<(id: string) => void>();
  const camera = { start: vi.fn(), move: vi.fn(), end: vi.fn() };
  let options: DrawingOptions = {
    drawMode: true,
    drawTool: "freehand",
    drawColor: "#ff8800",
    drawWidth: 3,
    drawOpacity: 0.8,
    drawFilled: false,
    gridSize: 50,
    gridSquareSize: 5,
    toWorld: (x, y) => ({ x, y }),
    sendMessage,
    onDrawingComplete,
    drawingObjects: [],
    ...overrides,
  };

  const hook = renderHook(
    (props: DrawingOptions) => {
      const drawing = useDrawingTool(props);
      const armed = useArmedTouchTool({
        drawMode: props.drawMode,
        selectMode: false,
        mapEditTouchMode: false,
        handleDrawMouseDown: drawing.onMouseDown,
        handleDrawMouseMove: drawing.onMouseMove,
        handleDrawMouseUp: drawing.onMouseUp,
        handleDrawCancel: drawing.cancel,
        handleMarqueePointerDown: unrelatedTool,
        handleMarqueePointerMove: unrelatedTool,
        handleMarqueePointerUp: unrelatedTool,
        handleMarqueeCancel: unrelatedTool,
        handleMapEditMouseDown: unrelatedTool,
        handleMapEditMouseMove: unrelatedTool,
        handleMapEditMouseUp: unrelatedTool,
        handleMapEditCancel: unrelatedTool,
      });
      const touch = useTouchGestureRouter({
        tool: armed,
        shouldPan: !props.drawMode,
        stageRef,
        onCameraStart: camera.start,
        onCameraMove: camera.move,
        onCameraEnd: camera.end,
      });
      return { ...drawing, touch };
    },
    { initialProps: options },
  );

  return {
    ...hook,
    stageRef,
    container,
    sendMessage,
    onDrawingComplete,
    camera,
    setPointer(next: Point) {
      pointer = next;
    },
    update(patch: Partial<DrawingOptions>) {
      options = { ...options, ...patch };
      hook.rerender(options);
    },
  };
}

export type MountedDrawing = ReturnType<typeof mountDrawing>;

export function pressAt(mounted: MountedDrawing, point: Point) {
  mounted.setPointer(point);
  act(() => mounted.result.current.onMouseDown(mounted.stageRef));
}

export function moveTo(mounted: MountedDrawing, point: Point) {
  mounted.setPointer(point);
  act(() => mounted.result.current.onMouseMove(mounted.stageRef));
}

// Use the actual animation-frame boundary; no fake drawing/scheduler logic.
export async function flushDrawingFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

export function touchEvent(fingers: number): KonvaEventObject<TouchEvent> {
  return {
    evt: {
      touches: { length: fingers },
      cancelable: true,
      preventDefault: vi.fn(),
    },
  } as unknown as KonvaEventObject<TouchEvent>;
}

// Existing partialErasing.test.ts middle-split geometry, now through the hook.
export function middleSplitDrawing(): SceneObject & { type: "drawing" } {
  return {
    id: "drawing:drawing-1",
    type: "drawing",
    owner: "player-1",
    locked: false,
    zIndex: 1,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: {
      drawing: {
        id: "drawing-1",
        type: "freehand",
        points: [0, 2, 4, 6, 8, 10].map((x) => ({ x, y: 0 })),
        color: "#ff00ff",
        width: 1,
        opacity: 0.8,
        filled: false,
        owner: "player-1",
      },
    },
  };
}
