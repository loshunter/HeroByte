// @vitest-environment jsdom
import { StrictMode, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDismissalFocus, type DismissalFocus } from "../dismissalFocus";
import { activatePanelLauncher, useExplicitDismissal } from "../useExplicitDismissal";
import { frameQueue, launcher, visible } from "./focusFixtures";

let focus: DismissalFocus;
let queue: ReturnType<typeof frameQueue>;
beforeEach(() => {
  queue = frameQueue();
  focus = createDismissalFocus();
});
afterEach(() => {
  cleanup();
  focus.invalidate();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function Frame({ close }: { close: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const dismiss = useExplicitDismissal(ref, close, undefined, focus);
  return createPortal(
    <div ref={ref} role="dialog">
      <input aria-label="Auto focused child" autoFocus />
      <button onClick={dismiss}>Explicit close</button>
    </div>,
    document.body,
  );
}

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={(event) => activatePanelLauncher(event, () => setOpen(true), focus)}>
        Open panel
      </button>
      <button onClick={() => setOpen(false)}>Raw close</button>
      {open && <Frame close={() => setOpen(false)} />}
    </>
  );
}

describe("capture before autofocus; restore only on explicit dismissal", () => {
  it("a portalled autofocus child never replaces the exact return launcher", () => {
    render(<Harness />);
    const opener = visible(screen.getByRole("button", { name: "Open panel" }));
    const returned = vi.spyOn(opener, "focus");
    fireEvent.click(opener);
    expect(document.activeElement).toBe(screen.getByRole("textbox"));
    returned.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Explicit close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(returned).not.toHaveBeenCalled();
    act(() => queue.flush());
    expect(returned).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    expect(document.activeElement).toBe(opener);
  });

  it.each([false, true])(
    "raw close and unmount never manufacture a ticket, StrictMode=%s",
    (strict) => {
      const view = render(
        strict ? (
          <StrictMode>
            <Harness />
          </StrictMode>
        ) : (
          <Harness />
        ),
      );
      const opener = visible(screen.getByRole("button", { name: "Open panel" }));
      fireEvent.click(opener);
      const returned = vi.spyOn(opener, "focus");
      fireEvent.click(screen.getByRole("button", { name: "Raw close" }));
      expect(queue.count()).toBe(0);
      act(() => queue.flush());
      expect(returned).not.toHaveBeenCalled();
      view.unmount();
      expect(returned).not.toHaveBeenCalled();
    },
  );

  it("immediate reopen invalidates the old ticket and preserves the new child's focus", () => {
    render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    );
    const opener = visible(screen.getByRole("button", { name: "Open panel" }));
    fireEvent.click(opener);
    const firstChild = screen.getByRole("textbox");
    fireEvent.click(screen.getByRole("button", { name: "Explicit close" }));
    expect(queue.count()).toBe(1);
    fireEvent.click(opener);
    const secondChild = screen.getByRole("textbox");
    expect(secondChild).not.toBe(firstChild);
    const returned = vi.spyOn(opener, "focus");
    act(() => queue.flush());
    expect(document.activeElement).toBe(secondChild);
    expect(returned).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Explicit close" }));
    act(() => queue.flush());
    expect(document.activeElement).toBe(opener);
    expect(returned).toHaveBeenCalledTimes(1);
  });

  it("rerenders update the close callback without recapturing a focused child", () => {
    const opener = launcher();
    opener.focus();
    const oldClose = vi.fn();
    const newClose = vi.fn();
    const view = render(<Frame close={oldClose} />);
    const child = screen.getByRole("textbox");
    view.rerender(
      <Frame
        close={() => {
          newClose();
          view.unmount();
        }}
      />,
    );
    expect(document.activeElement).toBe(child);
    fireEvent.click(screen.getByRole("button", { name: "Explicit close" }));
    act(() => queue.flush());
    expect(oldClose).not.toHaveBeenCalled();
    expect(newClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(opener);
  });

  it("launcher activation focuses only that currentTarget before invoking open", () => {
    const wrong = launcher();
    const target = launcher();
    const open = vi.fn(() => {
      expect(document.activeElement).toBe(target);
    });
    wrong.focus();
    activatePanelLauncher({ currentTarget: target }, open, focus);
    expect(open).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(target);
  });
});
