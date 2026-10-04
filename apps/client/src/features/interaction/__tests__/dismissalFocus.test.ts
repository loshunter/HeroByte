// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDismissalFocus, type DismissalFocus } from "../dismissalFocus";
import { frameQueue, launcher, panel } from "./focusFixtures";

let focus: DismissalFocus;
let queue: ReturnType<typeof frameQueue>;
beforeEach(() => {
  queue = frameQueue();
  focus = createDismissalFocus();
});
afterEach(() => {
  focus.invalidate();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("one explicit post-removal attempt", () => {
  it("returns to the exact portal-independent launcher only after frame removal", () => {
    const other = launcher();
    const target = launcher();
    const { frame } = panel();
    const returned = vi.spyOn(target, "focus");
    const unrelated = vi.spyOn(other, "focus");
    const close = vi.fn(() => frame.remove());
    expect(focus.request({ frame, close, resolveTarget: () => target })).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
    expect(returned).not.toHaveBeenCalled();
    queue.flush();
    expect(returned).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    expect(document.activeElement).toBe(target);
    expect(unrelated).not.toHaveBeenCalled();
    queue.flush();
    expect(returned).toHaveBeenCalledTimes(1);
  });

  it("an ignored close expires once and cannot restore after a later unrelated unmount", () => {
    const target = launcher();
    const { frame } = panel();
    const returned = vi.spyOn(target, "focus");
    const close = vi.fn();
    focus.request({ frame, close, resolveTarget: () => target });
    expect(focus.request({ frame, close, resolveTarget: () => target })).toBe(false);
    expect(close).toHaveBeenCalledTimes(1);
    queue.flush();
    frame.remove();
    queue.flush();
    expect(returned).not.toHaveBeenCalled();
    expect(queue.count()).toBe(0);
  });

  it("invalidation for a newer open abandons an older dismissal", () => {
    const target = launcher();
    const { frame } = panel();
    const returned = vi.spyOn(target, "focus");
    focus.request({ frame, close: () => frame.remove(), resolveTarget: () => target });
    focus.invalidate();
    panel();
    queue.flush();
    expect(returned).not.toHaveBeenCalled();
  });

  it("a throwing close cleans up its ticket rather than leaving future focus work", () => {
    const target = launcher();
    const { frame } = panel();
    expect(() =>
      focus.request({
        frame,
        resolveTarget: () => target,
        close: () => {
          throw new Error("close failed");
        },
      }),
    ).toThrow("close failed");
    frame.remove();
    queue.flush();
    expect(document.activeElement).not.toBe(target);
    expect(queue.count()).toBe(0);
  });
});

describe("later intent takes precedence", () => {
  it("pointerdown on a nonfocusable canvas abandons return even while focus stays on body", () => {
    const target = launcher();
    const { frame } = panel();
    const canvas = document.createElement("canvas");
    document.body.append(canvas);
    const returned = vi.spyOn(target, "focus");
    focus.request({ frame, close: () => frame.remove(), resolveTarget: () => target });
    expect(document.activeElement).toBe(document.body);
    canvas.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    queue.flush();
    expect(returned).not.toHaveBeenCalled();
  });

  it("subsequent focus elsewhere is preserved", () => {
    const target = launcher();
    const elsewhere = launcher();
    const { frame } = panel();
    const returned = vi.spyOn(target, "focus");
    focus.request({ frame, close: () => frame.remove(), resolveTarget: () => target });
    elsewhere.focus();
    queue.flush();
    expect(document.activeElement).toBe(elsewhere);
    expect(returned).not.toHaveBeenCalled();
  });

  it("the dismissal's own pointerdown is not mistaken for subsequent intent", () => {
    const target = launcher();
    const { frame } = panel();
    const closeButton = launcher(frame);
    closeButton.addEventListener("pointerdown", () => {
      focus.request({ frame, close: () => frame.remove(), resolveTarget: () => target });
    });
    closeButton.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    queue.flush();
    expect(document.activeElement).toBe(target);
  });

  it("ticket listeners exist only while a return is pending", () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const target = launcher();
    const { frame } = panel();
    expect(add.mock.calls.filter(([name]) => name === "pointerdown")).toHaveLength(0);
    focus.request({ frame, close: () => frame.remove(), resolveTarget: () => target });
    queue.flush();
    for (const name of ["pointerdown", "focusin"]) {
      const additions = add.mock.calls.filter(([key]) => key === name);
      const removals = remove.mock.calls.filter(([key]) => key === name);
      expect(additions).toHaveLength(1);
      expect(removals).toHaveLength(1);
      expect(removals[0][1]).toBe(additions[0][1]);
      expect(removals[0][2]).toBe(true);
    }
  });
});

describe("invalid launchers are discarded", () => {
  it.each([
    "detached",
    "disabled",
    "aria-disabled",
    "hidden",
    "display",
    "visibility",
    "inert",
    "aria-hidden",
    "no-rect",
  ])("does not focus a %s launcher", (reason) => {
    const host = document.createElement("div");
    document.body.append(host);
    const target = launcher(host);
    const { frame } = panel();
    const returned = vi.spyOn(target, "focus");
    focus.request({ frame, close: () => frame.remove(), resolveTarget: () => target });
    if (reason === "detached") target.remove();
    if (reason === "disabled") target.disabled = true;
    if (reason === "aria-disabled") target.setAttribute("aria-disabled", "true");
    if (reason === "hidden") host.hidden = true;
    if (reason === "display") host.style.display = "none";
    if (reason === "visibility") target.style.visibility = "hidden";
    if (reason === "inert") host.setAttribute("inert", "");
    if (reason === "aria-hidden") host.setAttribute("aria-hidden", "true");
    if (reason === "no-rect")
      vi.mocked(target.getClientRects).mockReturnValue({
        length: 0,
        item: () => null,
        [Symbol.iterator]: () => [][Symbol.iterator](),
      });
    queue.flush();
    expect(returned).not.toHaveBeenCalled();
  });
});
