import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { RoomSnapshot } from "@herobyte/shared";
import { useToolMode } from "../useToolMode";
import { mountDrawing, pressAt, moveTo } from "./characterization/drawingLifecycle.fixtures";

afterEach(cleanup);
const UID = "role-owner";
function snapshot(isDM = true, scene = "map-a"): RoomSnapshot {
  return {
    users: [UID],
    players: [{ uid: UID, name: "Owner", isDM }],
    characters: [],
    tokens: [],
    pointers: [],
    diceRolls: [],
    gridSize: 50,
    liveMapDocumentId: isDM ? scene : undefined,
    compiledScene: {
      schemaVersion: 1,
      sourceDocumentId: scene,
      sourceRevision: 1,
      compiledAt: 0,
      width: 1000,
      height: 1000,
      walls: [],
      doors: [],
      lights: [],
    },
  };
}
function mount() {
  const tool = renderHook(
    ({ value }: { value: RoomSnapshot | null }) =>
      useToolMode({
        snapshot: value,
        uid: UID,
        isDM: Boolean(value?.players.find((p) => p.uid === UID)?.isDM),
      }),
    { initialProps: { value: snapshot() as RoomSnapshot | null } },
  );
  act(() => tool.result.current.setActiveTool("draw"));
  const drawing = mountDrawing();
  pressAt(drawing, { x: 20, y: 20 });
  moveTo(drawing, { x: 40, y: 40 });
  expect(drawing.result.current.isDrawing).toBe(true);
  return { tool, drawing };
}
function release(drawing: ReturnType<typeof mountDrawing>) {
  moveTo(drawing, { x: 80, y: 80 });
  act(() => drawing.result.current.onMouseUp());
}
function nextStroke(drawing: ReturnType<typeof mountDrawing>) {
  pressAt(drawing, { x: 120, y: 120 });
  moveTo(drawing, { x: 160, y: 160 });
  act(() => drawing.result.current.onMouseUp());
  expect(drawing.sendMessage).toHaveBeenCalledTimes(1);
}

describe("real tool context cancels the actual annotation driver", () => {
  it.each(["resize", "orientationchange"])(
    "%s disarms residual release but retains Draw",
    (event) => {
      const { tool, drawing } = mount();
      act(() => window.dispatchEvent(new Event(event)));
      expect(drawing.result.current.isDrawing).toBe(false);
      expect(tool.result.current.activeTool).toBe("draw");
      release(drawing);
      expect(drawing.sendMessage).not.toHaveBeenCalled();
      nextStroke(drawing);
    },
  );

  it("a new source document cancels, while revision-only broadcasts preserve a stroke", () => {
    const { tool, drawing } = mount();
    tool.rerender({ value: { ...snapshot(), stateVersion: 2 } });
    expect(drawing.result.current.isDrawing).toBe(true);
    release(drawing);
    expect(drawing.sendMessage).toHaveBeenCalledTimes(1);
    drawing.sendMessage.mockClear();
    pressAt(drawing, { x: 20, y: 20 });
    tool.rerender({ value: snapshot(true, "map-b") });
    expect(drawing.result.current.isDrawing).toBe(false);
    expect(tool.result.current.activeTool).toBe("draw");
    release(drawing);
    expect(drawing.sendMessage).not.toHaveBeenCalled();
    nextStroke(drawing);
  });

  it.each([null, { ...snapshot(), players: [] }])(
    "unknown roster gaps do not demote; confirmed role loss disarms (%#)",
    (gap) => {
      const { tool, drawing } = mount();
      tool.rerender({ value: gap });
      expect(drawing.result.current.isDrawing).toBe(true);
      expect(tool.result.current.activeTool).toBe("draw");
      tool.rerender({ value: snapshot(false) });
      expect(drawing.result.current.isDrawing).toBe(false);
      expect(tool.result.current.activeTool).toBeNull();
      release(drawing);
      expect(drawing.sendMessage).not.toHaveBeenCalled();
    },
  );
});
