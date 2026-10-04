import { renderHook } from "@testing-library/react";
import { expect, vi } from "vitest";
import type {
  ClientMessage,
  Drawing,
  DrawingHistoryCapabilities,
  RoomSnapshot,
} from "@herobyte/shared";
import {
  useDrawingStateManager,
  type UseDrawingStateManagerReturn,
} from "../useDrawingStateManager";

export type SnapshotProjection = Pick<RoomSnapshot, "drawings" | "stateVersion" | "drawingHistory">;
export function frame(
  history?: DrawingHistoryCapabilities,
  drawings: Drawing[] = [],
  stateVersion = 1,
): SnapshotProjection {
  return { drawings, stateVersion, ...(history ? { drawingHistory: history } : {}) };
}
export const foreignDrawing: Drawing = {
  id: "someone-elses-drawing",
  owner: "other-player",
  type: "freehand",
  points: [
    { x: 0, y: 0 },
    { x: 8, y: 8 },
  ],
  color: "#ffffff",
  width: 3,
  opacity: 1,
};
export function mountManager(
  snapshot: SnapshotProjection | null = null,
  canClearDrawings?: boolean,
) {
  const sendMessage = vi.fn<(message: ClientMessage) => void>();
  const setActiveTool = vi.fn();
  const hook = renderHook(
    ({ current }: { current: SnapshotProjection | null }) =>
      useDrawingStateManager({
        sendMessage,
        setActiveTool,
        drawingHistory: current?.drawingHistory,
        canClearDrawings,
      }),
    { initialProps: { current: snapshot } },
  );
  return {
    ...hook,
    sendMessage,
    setActiveTool,
    incoming: (current: SnapshotProjection | null) => hook.rerender({ current }),
  };
}
export function expectCapabilities(
  manager: UseDrawingStateManagerReturn,
  canUndo: boolean,
  canRedo: boolean,
) {
  expect({ canUndo: manager.canUndo, canRedo: manager.canRedo }).toEqual({ canUndo, canRedo });
  expect({ canUndo: manager.toolbarProps.canUndo, canRedo: manager.toolbarProps.canRedo }).toEqual({
    canUndo,
    canRedo,
  });
}
