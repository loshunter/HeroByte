import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileDiceRoller } from "../MobileDiceRoller";
import { MobileResultOverlay } from "../MobileResultOverlay";
import { escapeRegistry } from "../../../features/interaction/useEscapeOwner";
import { dismissalFocus } from "../../../features/interaction/dismissalFocus";
import { serverRoll } from "./mobileDiceFrames.fixtures";

beforeEach(() => dismissalFocus.invalidate());
afterEach(() => {
  cleanup();
  dismissalFocus.invalidate();
  vi.restoreAllMocks();
});

describe("mobile Dice/Result remain passive content panels", () => {
  it.each(["dice", "result"] as const)(
    "%s neither cancels on opening nor gains Escape close/focus",
    (kind) => {
      let pending = true;
      const cancel = vi.fn(() => {
        pending = false;
      });
      const release = escapeRegistry.register(() => ({
        kind: "gesture",
        name: "held-map",
        active: pending,
        order: 20,
        handle: cancel,
      }));
      const close = vi.fn();
      const request = vi.spyOn(dismissalFocus, "request");
      try {
        const view = render(
          kind === "dice" ? (
            <MobileDiceRoller isConnected onClose={close} />
          ) : (
            <MobileResultOverlay result={serverRoll()} onClose={close} />
          ),
        );
        expect(cancel).not.toHaveBeenCalled();
        fireEvent.keyDown(document.body, { key: "Escape" });
        expect(cancel).toHaveBeenCalledExactlyOnceWith("escape");
        expect(close).not.toHaveBeenCalled();
        fireEvent.keyDown(document.body, { key: "Escape" });
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(close).not.toHaveBeenCalled();
        // The visible frame also excludes hidden canvas history, regardless of focused button.
        const button = screen.getByRole("button", {
          name: kind === "dice" ? /✕ CLOSE/ : "Close roll result",
        });
        button.focus();
        expect(
          escapeRegistry.canHandleShortcut(
            new KeyboardEvent("keydown", { key: "z", ctrlKey: true }),
            {
              root: null,
              anchor: document.body,
            },
          ),
        ).toBe(false);
        fireEvent.click(button);
        expect(close).toHaveBeenCalledTimes(1);
        expect(request).not.toHaveBeenCalled();
        view.unmount();
        expect(request).not.toHaveBeenCalled();
      } finally {
        act(() => release());
      }
    },
  );

  it.each(["dice", "result"] as const)(
    "%s preserves its raw backdrop close and acquires no focus ticket",
    (kind) => {
      const close = vi.fn();
      const request = vi.spyOn(dismissalFocus, "request");
      render(
        kind === "dice" ? (
          <MobileDiceRoller isConnected onClose={close} />
        ) : (
          <MobileResultOverlay result={serverRoll()} onClose={close} />
        ),
      );
      const backdrop = screen.getByTestId(kind === "dice" ? "dice-roller" : "mobile-roll-result");
      fireEvent.pointerDown(backdrop);
      fireEvent.click(backdrop);
      expect(close).toHaveBeenCalledTimes(1);
      expect(request).not.toHaveBeenCalled();
    },
  );
});
