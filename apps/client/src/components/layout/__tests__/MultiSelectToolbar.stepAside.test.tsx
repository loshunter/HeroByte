// The selection bar stays under the floating windows (a bar over them covered their ✕,
// 3fd6c945) and steps aside from one over its strip, so 🔓 Unlock is never under Chat.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MultiSelectToolbar } from "../MultiSelectToolbar";
import { FLOATING_WINDOW_ATTR } from "../useSelectionBarLeft";

const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
  }) as DOMRect;

function mockRects(boxes: Map<string, DOMRect>) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const key = (this as HTMLElement).dataset.testid ?? "";
    return boxes.get(key) ?? rect(0, 0, 0, 0);
  });
}

function addWindow(testId: string) {
  const win = document.createElement("div");
  win.setAttribute(FLOATING_WINDOW_ATTR, "");
  win.dataset.testid = testId;
  document.body.appendChild(win);
  return win;
}

const bar = () => (
  <MultiSelectToolbar
    selectedObjectIds={["token:a"]}
    isDM
    topHeight={60}
    onLock={vi.fn()}
    onUnlock={vi.fn()}
  />
);

afterEach(() => {
  cleanup();
  document.querySelectorAll(`[${FLOATING_WINDOW_ATTR}]`).forEach((node) => node.remove());
  vi.restoreAllMocks();
});

describe("MultiSelectToolbar — steps aside from floating windows", () => {
  it("stays under the windows (z 1000), never above them", () => {
    render(bar());
    expect(screen.getByTestId("selection-bar").style.zIndex).toBe("1000");
  });

  it("sits left of Chat & Rolls docked over its strip at 1024 px", () => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1024);
    // Chat & Rolls at x = innerWidth - 420, 400 wide, from y 100; the bar 300 wide at y 80..128.
    mockRects(
      new Map([
        ["selection-bar", rect(362, 80, 300, 48)],
        ["chat", rect(604, 100, 400, 500)],
      ]),
    );
    addWindow("chat");
    render(bar());
    const style = screen.getByTestId("selection-bar").style;
    expect(style.transform).toBe("none");
    expect(parseFloat(style.left) + 300).toBeLessThanOrEqual(604 - 8);
  });

  it("stays centred when the only window is clear of its strip", () => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1024);
    mockRects(
      new Map([
        ["selection-bar", rect(362, 80, 300, 48)],
        ["low", rect(604, 300, 400, 300)],
      ]),
    );
    addWindow("low");
    render(bar());
    expect(screen.getByTestId("selection-bar").style.left).toBe("50%");
  });
});
