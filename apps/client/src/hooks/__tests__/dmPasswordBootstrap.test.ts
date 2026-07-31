/**
 * The first-time DM password flow: a table created without the optional DM
 * password used to be a dead end (elevation failed with "No DM password
 * configured. Use set-dm-password to create one." — a wire message no UI
 * sent). These tests pin the recovery path: the failure routes into the
 * modal, flips it to bootstrap mode, and set-dm-password goes out.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RoomSnapshot, ServerMessage } from "@herobyte/shared";
import { useDMManagement } from "../useDMManagement.js";
import { useServerEventHandlers } from "../useServerEventHandlers.js";

const NO_DM_PASSWORD_REASON = "No DM password configured. Use set-dm-password to create one.";

function makeToast() {
  return {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
    messages: [],
  };
}

function makeSnapshot(isDM: boolean): RoomSnapshot {
  return {
    players: [{ uid: "uid-1", isDM }],
  } as unknown as RoomSnapshot;
}

describe("useDMManagement — DM password bootstrap", () => {
  it("flips the modal to bootstrap mode when elevation fails for lack of a DM password", () => {
    const { result } = renderHook(() =>
      useDMManagement({
        snapshot: makeSnapshot(false),
        uid: "uid-1",
        sendMessage: vi.fn(),
        toast: makeToast(),
      }),
    );

    act(() => {
      result.current.handleToggleDM(true);
    });
    expect(result.current.modalState.mode).toBe("elevate");

    act(() => {
      result.current.modalActions.onElevate("a-guess-pw");
    });
    act(() => {
      result.current.onElevationFailed(NO_DM_PASSWORD_REASON);
    });

    expect(result.current.modalState.mode).toBe("bootstrap");
    expect(result.current.modalState.isOpen).toBe(true);
    expect(result.current.modalState.isLoading).toBe(false);
    expect(result.current.modalState.error).toBeNull();
  });

  it("surfaces any other elevation failure inline instead of flipping modes", () => {
    const { result } = renderHook(() =>
      useDMManagement({
        snapshot: makeSnapshot(false),
        uid: "uid-1",
        sendMessage: vi.fn(),
        toast: makeToast(),
      }),
    );

    act(() => {
      result.current.handleToggleDM(true);
    });
    act(() => {
      result.current.modalActions.onElevate("wrong-pw");
    });
    act(() => {
      result.current.onElevationFailed("Invalid DM password");
    });

    expect(result.current.modalState.mode).toBe("elevate");
    expect(result.current.modalState.error).toBe("Invalid DM password");
    expect(result.current.modalState.isLoading).toBe(false);
  });

  it("sends set-dm-password when the bootstrap form submits", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() =>
      useDMManagement({
        snapshot: makeSnapshot(false),
        uid: "uid-1",
        sendMessage,
        toast: makeToast(),
      }),
    );

    act(() => {
      result.current.modalActions.onBootstrap("brand-new-dm-pw");
    });

    expect(sendMessage).toHaveBeenCalledWith({
      t: "set-dm-password",
      dmPassword: "brand-new-dm-pw",
    });
    expect(result.current.modalState.isLoading).toBe(true);
  });

  it("rejects a too-short bootstrap password client-side", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() =>
      useDMManagement({
        snapshot: makeSnapshot(false),
        uid: "uid-1",
        sendMessage,
        toast: makeToast(),
      }),
    );

    act(() => {
      result.current.modalActions.onBootstrap("short");
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(result.current.modalState.error).toBe("DM password needs at least 8 characters.");
  });

  it("resets a dismissed bootstrap modal back to elevate mode", () => {
    const { result } = renderHook(() =>
      useDMManagement({
        snapshot: makeSnapshot(false),
        uid: "uid-1",
        sendMessage: vi.fn(),
        toast: makeToast(),
      }),
    );

    act(() => {
      result.current.onElevationFailed(NO_DM_PASSWORD_REASON);
    });
    expect(result.current.modalState.mode).toBe("bootstrap");

    act(() => {
      result.current.modalActions.onClose();
    });
    expect(result.current.modalState.isOpen).toBe(false);
    expect(result.current.modalState.mode).toBe("elevate");
  });
});

describe("useServerEventHandlers — dm-elevation-failed routing", () => {
  function capture() {
    let handler: ((message: ServerMessage) => void) | null = null;
    const registerServerEventHandler = vi.fn((h: (message: ServerMessage) => void) => {
      handler = h;
    });
    return { registerServerEventHandler, dispatch: (m: ServerMessage) => handler?.(m) };
  }

  it("routes the reason to onDMElevationFailed and suppresses the toast", () => {
    const { registerServerEventHandler, dispatch } = capture();
    const toast = makeToast();
    const onDMElevationFailed = vi.fn();

    renderHook(() =>
      useServerEventHandlers({
        registerServerEventHandler,
        toast,
        sendMessage: vi.fn(),
        onDMElevationFailed,
      }),
    );

    act(() => {
      dispatch({ t: "dm-elevation-failed", reason: NO_DM_PASSWORD_REASON } as ServerMessage);
    });

    expect(onDMElevationFailed).toHaveBeenCalledWith(NO_DM_PASSWORD_REASON);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("keeps the error toast when no callback is wired", () => {
    const { registerServerEventHandler, dispatch } = capture();
    const toast = makeToast();

    renderHook(() =>
      useServerEventHandlers({
        registerServerEventHandler,
        toast,
        sendMessage: vi.fn(),
      }),
    );

    act(() => {
      dispatch({ t: "dm-elevation-failed", reason: "Invalid DM password" } as ServerMessage);
    });

    expect(toast.error).toHaveBeenCalledWith("DM elevation failed: Invalid DM password", 5000);
  });
});
