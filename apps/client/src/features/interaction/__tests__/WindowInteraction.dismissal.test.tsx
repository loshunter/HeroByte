// @vitest-environment jsdom
import { StrictMode, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DraggableWindow } from "../../../components/dice/DraggableWindow";
import { dismissalFocus } from "../dismissalFocus";
import { activatePanelLauncher } from "../useExplicitDismissal";
import { frameQueue, visible } from "./focusFixtures";
import { viewport } from "./frameInteraction.fixtures";

let queue: ReturnType<typeof frameQueue>;
let initialViewport: [number, number];
beforeEach(() => {
  initialViewport = [window.innerWidth, window.innerHeight];
  viewport(1440, 900);
  vi.stubGlobal("matchMedia", undefined);
  queue = frameQueue();
  dismissalFocus.invalidate();
});
afterEach(() => {
  cleanup();
  dismissalFocus.invalidate();
  viewport(...initialViewport);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function Harness({ paletteOnClose = false }: { paletteOnClose?: boolean }) {
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  return (
    <>
      <button onClick={(event) => activatePanelLauncher(event, () => setOpen(true))}>
        Open Chat
      </button>
      <button onClick={() => setOpen(false)}>Raw close</button>
      {open && (
        <DraggableWindow
          title="Chat"
          zIndex={999}
          onClose={() => {
            setOpen(false);
            if (paletteOnClose) setPalette(true);
          }}
          interaction={{ behavior: "close", panel: "chat" }}
        >
          <input aria-label="Child" autoFocus />
        </DraggableWindow>
      )}
      {palette && (
        <DraggableWindow title="Draw" zIndex={200}>
          Palette body
        </DraggableWindow>
      )}
    </>
  );
}

describe("close-only frame child owns explicit focus behavior", () => {
  it.each(["X", "Escape"])(
    "%s closes once and returns after removal to the pre-autofocus launcher",
    (action) => {
      render(<Harness />);
      const opener = visible(screen.getByRole("button", { name: "Open Chat" }));
      fireEvent.click(opener);
      expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Child" }));
      const returned = vi.spyOn(opener, "focus");
      if (action === "X") fireEvent.click(screen.getByRole("button", { name: "Close Chat" }));
      else fireEvent.keyDown(screen.getByRole("textbox", { name: "Child" }), { key: "Escape" });
      expect(screen.queryByRole("button", { name: "Close Chat" })).toBeNull();
      expect(returned).not.toHaveBeenCalled();
      act(() => queue.flush());
      expect(returned).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
      expect(document.activeElement).toBe(opener);
    },
  );

  it("mounting a default-context palette does not invalidate the closing Chat's ticket", () => {
    render(<Harness paletteOnClose />);
    const opener = visible(screen.getByRole("button", { name: "Open Chat" }));
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole("button", { name: "Close Chat" }));
    expect(screen.getByText("Palette body")).toBeTruthy();
    expect(queue.count()).toBe(1);
    act(() => queue.flush());
    expect(document.activeElement).toBe(opener);
  });

  it("StrictMode raw close and automatic unmount never request focus return", () => {
    const view = render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    );
    const opener = visible(screen.getByRole("button", { name: "Open Chat" }));
    fireEvent.click(opener);
    const request = vi.spyOn(dismissalFocus, "request");
    const returned = vi.spyOn(opener, "focus");
    fireEvent.click(screen.getByRole("button", { name: "Raw close" }));
    act(() => queue.flush());
    expect(request).not.toHaveBeenCalled();
    expect(returned).not.toHaveBeenCalled();
    view.unmount();
    expect(request).not.toHaveBeenCalled();
    expect(returned).not.toHaveBeenCalled();
  });
});
