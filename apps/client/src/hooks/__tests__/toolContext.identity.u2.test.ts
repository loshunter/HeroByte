// Desired identity contract. Destination: hooks/__tests__/toolContext.identity.u2.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { RoomSnapshot } from "@herobyte/shared";
import { useToolMode } from "../useToolMode";
import { dismissalFocus } from "../../features/interaction/dismissalFocus";
import { frameQueue, launcher, panel } from "../../features/interaction/__tests__/focusFixtures";
import { mountDrawing, pressAt, moveTo } from "./characterization/drawingLifecycle.fixtures";

let queue: ReturnType<typeof frameQueue>;
beforeEach(() => {
  queue = frameQueue();
});
afterEach(() => {
  cleanup();
  dismissalFocus.invalidate();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function pendingReturn() {
  // The real drawing driver also schedules preview frames. Settle its preview
  // before creating the independent pending dismissal ticket; no stroke commits.
  act(() => queue.flush());
  const opener = launcher();
  const { frame } = panel();
  const returned = vi.spyOn(opener, "focus");
  expect(
    dismissalFocus.request({
      frame,
      close: () => frame.remove(),
      resolveTarget: () => opener,
    }),
  ).toBe(true);
  expect(queue.count()).toBe(1);
  expect(document.activeElement).toBe(document.body);
  return { opener, returned };
}

function expectReturnCancelled(ticket: ReturnType<typeof pendingReturn>) {
  act(() => queue.flush());
  expect(ticket.returned).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(document.body);
  expect(queue.count()).toBe(0);
}

function expectReturnPreserved(ticket: ReturnType<typeof pendingReturn>) {
  expect(queue.count()).toBe(1);
  act(() => queue.flush());
  expect(ticket.returned).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
  expect(document.activeElement).toBe(ticket.opener);
  expect(queue.count()).toBe(0);
}

const FIRST = "first-owner";
const SECOND = "second-owner";
function raster(uid = FIRST, background: string | undefined = "raster-a"): RoomSnapshot {
  return {
    users: [uid],
    players: [{ uid, name: "Owner", isDM: true }],
    characters: [],
    tokens: [],
    pointers: [],
    diceRolls: [],
    gridSize: 50,
    mapBackground: background,
    // Deliberately no document, compiled source or Atlas node identity.
  } as RoomSnapshot;
}

function mount(value: RoomSnapshot | null = raster()) {
  const tool = renderHook(
    ({ value, uid }: { value: RoomSnapshot | null; uid: string }) =>
      useToolMode({
        snapshot: value,
        uid,
        isDM: Boolean(value?.players.find((player) => player.uid === uid)?.isDM),
      }),
    { initialProps: { value, uid: FIRST } },
  );
  act(() => tool.result.current.setActiveTool("draw"));
  const drawing = mountDrawing();
  pressAt(drawing, { x: 20, y: 20 });
  moveTo(drawing, { x: 40, y: 40 });
  expect(drawing.result.current.isDrawing).toBe(true);
  return { tool, drawing };
}

function residualRelease(drawing: ReturnType<typeof mountDrawing>) {
  moveTo(drawing, { x: 80, y: 80 });
  act(() => drawing.result.current.onMouseUp());
}

function nextStroke(drawing: ReturnType<typeof mountDrawing>) {
  pressAt(drawing, { x: 120, y: 120 });
  moveTo(drawing, { x: 160, y: 160 });
  act(() => drawing.result.current.onMouseUp());
  expect(drawing.sendMessage).toHaveBeenCalledTimes(1);
}

describe("raster surface identity cancels the real annotation driver", () => {
  it.each(["raster-b", undefined])(
    "replacement/removal cancels without changing Draw: %s",
    (background) => {
      const { tool, drawing } = mount();
      const ticket = pendingReturn();
      // Do not call raster(FIRST, undefined): its default would create raster-a.
      tool.rerender({ value: { ...raster(), mapBackground: background }, uid: FIRST });
      expect(drawing.result.current.isDrawing).toBe(false);
      expect(tool.result.current.activeTool).toBe("draw");
      expectReturnCancelled(ticket);
      residualRelease(drawing);
      expect(drawing.sendMessage).not.toHaveBeenCalled();
      nextStroke(drawing);
    },
  );

  it("a same-background snapshot revision preserves the held stroke and focus ticket", () => {
    const { tool, drawing } = mount();
    const ticket = pendingReturn();
    tool.rerender({ value: { ...raster(), stateVersion: 2 }, uid: FIRST });
    expect(drawing.result.current.isDrawing).toBe(true);
    expect(tool.result.current.activeTool).toBe("draw");
    expectReturnPreserved(ticket);
    residualRelease(drawing);
    expect(drawing.sendMessage).toHaveBeenCalledTimes(1);
  });
});

describe("explicit UID changes precede unknown-roster handling", () => {
  it.each(["null", "missing-own-row"] as const)(
    "new UID cancels immediately during a %s gap",
    (gap) => {
      const { tool, drawing } = mount();
      const oldTicket = pendingReturn();
      const value = gap === "null" ? null : raster(FIRST);
      tool.rerender({ value, uid: SECOND });
      expect(drawing.result.current.isDrawing).toBe(false);
      expect(tool.result.current.activeTool).toBeNull();
      expectReturnCancelled(oldTicket);
      residualRelease(drawing);
      expect(drawing.sendMessage).not.toHaveBeenCalled();

      const gapTicket = pendingReturn();
      tool.rerender({ value, uid: SECOND });
      expectReturnPreserved(gapTicket);
      // A first known snapshot for SECOND must seed a new baseline rather than
      // compare the old user's role/surface and cancel the new user's next work.
      act(() => tool.result.current.setActiveTool("draw"));
      pressAt(drawing, { x: 120, y: 120 });
      moveTo(drawing, { x: 160, y: 160 });
      const newTicket = pendingReturn();
      const next = raster(SECOND, "second-raster");
      next.players = next.players.map((player) => ({ ...player, isDM: false }));
      tool.rerender({ value: next, uid: SECOND });
      expect(tool.result.current.activeTool).toBe("draw");
      expect(drawing.result.current.isDrawing).toBe(true);
      expectReturnPreserved(newTicket);
      residualRelease(drawing);
      expect(drawing.sendMessage).toHaveBeenCalledTimes(1);
    },
  );

  it.each([null, { ...raster(), players: [] }])(
    "same UID unknown gap retains pending work (%#)",
    (value) => {
      const { tool, drawing } = mount();
      const ticket = pendingReturn();
      tool.rerender({ value, uid: FIRST });
      expect(tool.result.current.activeTool).toBe("draw");
      expect(drawing.result.current.isDrawing).toBe(true);
      expectReturnPreserved(ticket);
      residualRelease(drawing);
      expect(drawing.sendMessage).toHaveBeenCalledTimes(1);
    },
  );

  it("an explicit UID change is known even if neither user's roster has loaded", () => {
    const { tool, drawing } = mount(null);
    const ticket = pendingReturn();
    tool.rerender({ value: null, uid: SECOND });
    expect(tool.result.current.activeTool).toBeNull();
    expect(drawing.result.current.isDrawing).toBe(false);
    expectReturnCancelled(ticket);
    residualRelease(drawing);
    expect(drawing.sendMessage).not.toHaveBeenCalled();
  });
});
