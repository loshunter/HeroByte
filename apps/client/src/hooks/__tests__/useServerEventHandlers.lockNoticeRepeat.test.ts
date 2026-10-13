// Four quick clicks on a locked door stacked four identical toasts down the corner
// (found live, 2026-10-12): every press says it, and nothing folded a repeat. A notice
// already on screen is not stacked again; once it has gone, the next press says it anew.

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useServerEventHandlers } from "../useServerEventHandlers.js";
import { announceLocked } from "../../features/locking/lockNotice";

function mount() {
  const toast = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
    messages: [],
  };
  renderHook(() =>
    useServerEventHandlers({ registerServerEventHandler: vi.fn(), toast, sendMessage: vi.fn() }),
  );
  return toast;
}

describe("a lock notice pressed again while its toast is up", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is not stacked again; after the toast's 4 s it is said anew", () => {
    const toast = mount();
    act(() => {
      announceLocked("This door is locked. Only the DM can open it.");
      announceLocked("This door is locked. Only the DM can open it.");
      announceLocked("This door is locked. Only the DM can open it.");
    });
    expect(toast.error).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(4000);
    act(() => announceLocked("This door is locked. Only the DM can open it."));
    expect(toast.error).toHaveBeenCalledTimes(2);
  });

  it("a different notice is still said at once", () => {
    const toast = mount();
    act(() => {
      announceLocked("This door is locked. Only the DM can open it.");
      announceLocked("Locked: unlock it first (Token Lock), then delete it.");
    });
    expect(toast.error).toHaveBeenCalledTimes(2);
  });
});
