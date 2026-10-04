// Desired contract: an explicit tool transition supersedes a pending panel return.
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useToolMode } from "../useToolMode";
import { dismissalFocus } from "../../features/interaction/dismissalFocus";
import { frameQueue, launcher, panel } from "../../features/interaction/__tests__/focusFixtures";

afterEach(() => {
  cleanup();
  dismissalFocus.invalidate();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

it.each([null, "measure", "draw"] as const)(
  "pending panel return yields to a changed tool, while a repeated choice preserves it (%s)",
  (next) => {
    const queue = frameQueue();
    const tool = renderHook(() => useToolMode());
    act(() => tool.result.current.setActiveTool("draw"));
    const opener = launcher();
    const { frame } = panel();
    expect(
      dismissalFocus.request({
        frame,
        close: () => frame.remove(),
        resolveTarget: () => opener,
      }),
    ).toBe(true);
    expect(queue.count()).toBe(1);
    act(() => tool.result.current.setActiveTool(next));
    act(() => queue.flush());
    expect(tool.result.current.activeTool).toBe(next);
    expect(document.activeElement).toBe(next === "draw" ? opener : document.body);
  },
);
