/**
 * MobileScreen: the full-height surface for things you read.
 *
 * Geometry (full-height, opaque, ≥44px exit) is a layout-engine fact that
 * jsdom cannot see — apps/e2e/mobile/mobile-shell.spec.ts measures it. What
 * belongs here is the contract jsdom CAN see: the exit always works, the
 * drag-down is an enhancement with a threshold, and a screen announces
 * itself as an open panel so the CRT filter softens over it.
 */

import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MobileScreen } from "../MobileScreen";
import { openPanelCount, resetPanelPresence } from "../../../components/effects/panelPresence";

afterEach(() => {
  cleanup();
  resetPanelPresence();
});

const renderScreen = (onClose = vi.fn()) => {
  render(
    <MobileScreen title="Roll Log" surface="log" onClose={onClose}>
      <p>the content</p>
    </MobileScreen>,
  );
  return onClose;
};

const header = () => document.querySelector(".mobile-screen__header") as HTMLElement;

const drag = (from: number, to: number, release = true) => {
  fireEvent.touchStart(header(), { touches: [{ clientY: from }] });
  fireEvent.touchMove(header(), { touches: [{ clientY: to }] });
  if (release) fireEvent.touchEnd(header(), { changedTouches: [{ clientY: to }] });
};

describe("MobileScreen", () => {
  it("is a labelled dialog carrying its surface attribute", () => {
    renderScreen();

    const dialog = screen.getByRole("dialog", { name: "Roll Log" });
    expect(dialog).toHaveAttribute("data-mobile-surface", "log");
    expect(screen.getByText("the content")).toBeInTheDocument();
  });

  it("closes from the ✕, which is the contract the drag only enhances", () => {
    const onClose = renderScreen();

    fireEvent.click(screen.getByRole("button", { name: "Close Roll Log" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("dismisses on a drag past the threshold, and only past it", () => {
    const onClose = renderScreen();

    drag(100, 160); // 60px: an adjustment, not an exit
    expect(onClose).not.toHaveBeenCalled();

    drag(100, 250); // 150px: past DISMISS_DRAG_PX
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("an upward drag is not a dismissal", () => {
    const onClose = renderScreen();

    drag(250, 40);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("follows the finger while dragging and settles back on a short release", () => {
    renderScreen();
    const dialog = screen.getByRole("dialog", { name: "Roll Log" });

    fireEvent.touchStart(header(), { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(header(), { touches: [{ clientY: 150 }] });
    expect((dialog as HTMLElement).style.transform).toBe("translateY(50px)");

    fireEvent.touchEnd(header(), { changedTouches: [{ clientY: 150 }] });
    expect((dialog as HTMLElement).style.transform).toBe("");
  });

  it("a second finger cancels the drag instead of dismissing", () => {
    const onClose = renderScreen();

    fireEvent.touchStart(header(), { touches: [{ clientY: 100 }] });
    // The second finger lands: touches.length is 2 on this touchstart.
    fireEvent.touchStart(header(), { touches: [{ clientY: 100 }, { clientY: 110 }] });
    fireEvent.touchEnd(header(), { changedTouches: [{ clientY: 300 }] });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("touchcancel resets the drag without dismissing", () => {
    const onClose = renderScreen();
    const dialog = screen.getByRole("dialog", { name: "Roll Log" });

    fireEvent.touchStart(header(), { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(header(), { touches: [{ clientY: 260 }] });
    fireEvent.touchCancel(header());

    expect((dialog as HTMLElement).style.transform).toBe("");
    expect(onClose).not.toHaveBeenCalled();
    // ...and the dead gesture leaves no state behind: the next release with no
    // start recorded is a no-op, not a dismissal.
    fireEvent.touchEnd(header(), { changedTouches: [{ clientY: 300 }] });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("announces itself as an open panel for as long as it is mounted", () => {
    expect(openPanelCount()).toBe(0);
    const { unmount } = render(
      <MobileScreen title="Party Members" surface="party" onClose={vi.fn()}>
        <p>rows</p>
      </MobileScreen>,
    );
    expect(openPanelCount()).toBe(1);
    unmount();
    expect(openPanelCount()).toBe(0);
  });
});
