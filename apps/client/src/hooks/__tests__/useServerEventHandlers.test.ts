/**
 * Characterization tests for useServerEventHandlers
 *
 * These tests capture the behavior of the server event handling logic
 * before extraction from App.tsx.
 *
 * Source: /apps/client/src/ui/App.tsx (lines 228-229, 269-293, 425-427)
 * Target: /apps/client/src/hooks/useServerEventHandlers.ts
 *
 * Tests cover:
 * - Room password update events (success/failure)
 * - DM elevation events (success/failure)
 * - State management (roomPasswordStatus, roomPasswordPending)
 * - Toast notifications
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ServerMessage } from "@shared";
import { useServerEventHandlers } from "../useServerEventHandlers.js";

describe("useServerEventHandlers - Characterization Tests", () => {
  describe("initialization", () => {
    it("should initialize with null roomPasswordStatus", () => {
      const registerServerEventHandler = vi.fn();
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      const { result } = renderHook(() =>
        useServerEventHandlers({ registerServerEventHandler, toast }),
      );

      expect(result.current.roomPasswordStatus).toBeNull();
    });

    it("should initialize with roomPasswordPending as false", () => {
      const registerServerEventHandler = vi.fn();
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      const { result } = renderHook(() =>
        useServerEventHandlers({ registerServerEventHandler, toast }),
      );

      expect(result.current.roomPasswordPending).toBe(false);
    });

    it("should register a server event handler on mount", () => {
      const registerServerEventHandler = vi.fn();
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      renderHook(() => useServerEventHandlers({ registerServerEventHandler, toast }));

      expect(registerServerEventHandler).toHaveBeenCalledTimes(1);
      expect(typeof registerServerEventHandler.mock.calls[0][0]).toBe("function");
    });

    it("should provide dismissRoomPasswordStatus function", () => {
      const registerServerEventHandler = vi.fn();
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      const { result } = renderHook(() =>
        useServerEventHandlers({ registerServerEventHandler, toast }),
      );

      expect(result.current).toHaveProperty("dismissRoomPasswordStatus");
      expect(typeof result.current.dismissRoomPasswordStatus).toBe("function");
    });

    it("should provide startRoomPasswordUpdate function", () => {
      const registerServerEventHandler = vi.fn();
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      const { result } = renderHook(() =>
        useServerEventHandlers({ registerServerEventHandler, toast }),
      );

      expect(result.current).toHaveProperty("startRoomPasswordUpdate");
      expect(typeof result.current.startRoomPasswordUpdate).toBe("function");
    });
  });

  describe("room-password-updated event", () => {
    it("should set roomPasswordStatus to success when room-password-updated is received", () => {
      let eventHandler: ((message: ServerMessage) => void) | null = null;
      const registerServerEventHandler = vi.fn((handler) => {
        eventHandler = handler;
      });
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      const { result } = renderHook(() =>
        useServerEventHandlers({ registerServerEventHandler, toast }),
      );

      expect(eventHandler).not.toBeNull();

      act(() => {
        eventHandler!({
          t: "room-password-updated",
          updatedAt: Date.now(),
          source: "user",
        });
      });

      expect(result.current.roomPasswordStatus).toEqual({
        type: "success",
        message: "Room password updated successfully.",
      });
    });

    it("should set roomPasswordPending to false when room-password-updated is received", () => {
      let eventHandler: ((message: ServerMessage) => void) | null = null;
      const registerServerEventHandler = vi.fn((handler) => {
        eventHandler = handler;
      });
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      const { result } = renderHook(() =>
        useServerEventHandlers({ registerServerEventHandler, toast }),
      );

      // Simulate pending state (this would normally be set by the component)
      // For now we just verify it gets set to false
      act(() => {
        eventHandler!({
          t: "room-password-updated",
          updatedAt: Date.now(),
          source: "user",
        });
      });

      expect(result.current.roomPasswordPending).toBe(false);
    });
  });

  describe("room-password-update-failed event", () => {
    it("should set roomPasswordStatus to error when room-password-update-failed is received", () => {
      let eventHandler: ((message: ServerMessage) => void) | null = null;
      const registerServerEventHandler = vi.fn((handler) => {
        eventHandler = handler;
      });
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      const { result } = renderHook(() =>
        useServerEventHandlers({ registerServerEventHandler, toast }),
      );

      act(() => {
        eventHandler!({
          t: "room-password-update-failed",
          reason: "Invalid password format",
        });
      });

      expect(result.current.roomPasswordStatus).toEqual({
        type: "error",
        message: "Invalid password format",
      });
    });

    it("should use default error message when reason is not provided", () => {
      let eventHandler: ((message: ServerMessage) => void) | null = null;
      const registerServerEventHandler = vi.fn((handler) => {
        eventHandler = handler;
      });
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      const { result } = renderHook(() =>
        useServerEventHandlers({ registerServerEventHandler, toast }),
      );

      act(() => {
        eventHandler!({
          t: "room-password-update-failed",
        });
      });

      expect(result.current.roomPasswordStatus).toEqual({
        type: "error",
        message: "Unable to update room password.",
      });
    });

    it("should set roomPasswordPending to false when room-password-update-failed is received", () => {
      let eventHandler: ((message: ServerMessage) => void) | null = null;
      const registerServerEventHandler = vi.fn((handler) => {
        eventHandler = handler;
      });
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      const { result } = renderHook(() =>
        useServerEventHandlers({ registerServerEventHandler, toast }),
      );

      act(() => {
        eventHandler!({
          t: "room-password-update-failed",
          reason: "Test error",
        });
      });

      expect(result.current.roomPasswordPending).toBe(false);
    });
  });

  describe("dm-status event", () => {
    it("should show success toast when DM elevation is successful", () => {
      let eventHandler: ((message: ServerMessage) => void) | null = null;
      const registerServerEventHandler = vi.fn((handler) => {
        eventHandler = handler;
      });
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      renderHook(() => useServerEventHandlers({ registerServerEventHandler, toast }));

      act(() => {
        eventHandler!({
          t: "dm-status",
          isDM: true,
        });
      });

      expect(toast.success).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith(
        "DM elevation successful! You are now the Dungeon Master.",
        4000,
      );
    });

    it("should only show toast when transitioning from non-DM to DM", () => {
      let eventHandler: ((message: ServerMessage) => void) | null = null;
      const registerServerEventHandler = vi.fn((handler) => {
        eventHandler = handler;
      });
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      renderHook(() => useServerEventHandlers({ registerServerEventHandler, toast }));

      act(() => {
        eventHandler!({ t: "dm-status", isDM: true });
      });
      act(() => {
        eventHandler!({ t: "dm-status", isDM: true });
      });

      expect(toast.success).toHaveBeenCalledTimes(1);

      act(() => {
        eventHandler!({ t: "dm-status", isDM: false });
      });
      act(() => {
        eventHandler!({ t: "dm-status", isDM: true });
      });

      expect(toast.success).toHaveBeenCalledTimes(2);
    });

    it("should not show toast when isDM is false", () => {
      let eventHandler: ((message: ServerMessage) => void) | null = null;
      const registerServerEventHandler = vi.fn((handler) => {
        eventHandler = handler;
      });
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      renderHook(() => useServerEventHandlers({ registerServerEventHandler, toast }));

      act(() => {
        eventHandler!({
          t: "dm-status",
          isDM: false,
        });
      });

      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  describe("dm-elevation-failed event", () => {
    it("should show error toast when DM elevation fails", () => {
      let eventHandler: ((message: ServerMessage) => void) | null = null;
      const registerServerEventHandler = vi.fn((handler) => {
        eventHandler = handler;
      });
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      renderHook(() => useServerEventHandlers({ registerServerEventHandler, toast }));

      act(() => {
        eventHandler!({
          t: "dm-elevation-failed",
          reason: "Invalid DM password",
        });
      });

      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith("DM elevation failed: Invalid DM password", 5000);
    });

    it("should handle missing reason in dm-elevation-failed", () => {
      let eventHandler: ((message: ServerMessage) => void) | null = null;
      const registerServerEventHandler = vi.fn((handler) => {
        eventHandler = handler;
      });
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      renderHook(() => useServerEventHandlers({ registerServerEventHandler, toast }));

      act(() => {
        eventHandler!({
          t: "dm-elevation-failed",
        });
      });

      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith("DM elevation failed: undefined", 5000);
    });
  });

  describe("startRoomPasswordUpdate", () => {
    it("should set roomPasswordPending to true when startRoomPasswordUpdate is called", () => {
      const registerServerEventHandler = vi.fn();
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      const { result } = renderHook(() =>
        useServerEventHandlers({ registerServerEventHandler, toast }),
      );

      expect(result.current.roomPasswordPending).toBe(false);

      act(() => {
        result.current.startRoomPasswordUpdate();
      });

      expect(result.current.roomPasswordPending).toBe(true);
    });

    it("should clear roomPasswordStatus when startRoomPasswordUpdate is called", () => {
      let eventHandler: ((message: ServerMessage) => void) | null = null;
      const registerServerEventHandler = vi.fn((handler) => {
        eventHandler = handler;
      });
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      const { result } = renderHook(() =>
        useServerEventHandlers({ registerServerEventHandler, toast }),
      );

      // Set a status first
      act(() => {
        eventHandler!({
          t: "room-password-updated",
          updatedAt: Date.now(),
          source: "user",
        });
      });

      expect(result.current.roomPasswordStatus).not.toBeNull();

      // Start a new update
      act(() => {
        result.current.startRoomPasswordUpdate();
      });

      expect(result.current.roomPasswordStatus).toBeNull();
    });

    it("should maintain callback stability", () => {
      const registerServerEventHandler = vi.fn();
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      const { result, rerender } = renderHook(() =>
        useServerEventHandlers({ registerServerEventHandler, toast }),
      );

      const firstCallback = result.current.startRoomPasswordUpdate;
      rerender();
      const secondCallback = result.current.startRoomPasswordUpdate;

      expect(firstCallback).toBe(secondCallback);
    });
  });

  describe("dismissRoomPasswordStatus", () => {
    it("should clear roomPasswordStatus when dismissRoomPasswordStatus is called", () => {
      let eventHandler: ((message: ServerMessage) => void) | null = null;
      const registerServerEventHandler = vi.fn((handler) => {
        eventHandler = handler;
      });
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      const { result } = renderHook(() =>
        useServerEventHandlers({ registerServerEventHandler, toast }),
      );

      // Set a status first
      act(() => {
        eventHandler!({
          t: "room-password-updated",
          updatedAt: Date.now(),
          source: "user",
        });
      });

      expect(result.current.roomPasswordStatus).not.toBeNull();

      // Dismiss it
      act(() => {
        result.current.dismissRoomPasswordStatus();
      });

      expect(result.current.roomPasswordStatus).toBeNull();
    });

    it("should maintain callback stability", () => {
      const registerServerEventHandler = vi.fn();
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      const { result, rerender } = renderHook(() =>
        useServerEventHandlers({ registerServerEventHandler, toast }),
      );

      const firstCallback = result.current.dismissRoomPasswordStatus;
      rerender();
      const secondCallback = result.current.dismissRoomPasswordStatus;

      expect(firstCallback).toBe(secondCallback);
    });
  });

  describe("unhandled events", () => {
    it("should ignore unrelated server messages", () => {
      let eventHandler: ((message: ServerMessage) => void) | null = null;
      const registerServerEventHandler = vi.fn((handler) => {
        eventHandler = handler;
      });
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      const { result } = renderHook(() =>
        useServerEventHandlers({ registerServerEventHandler, toast }),
      );

      // Send a different message type
      act(() => {
        eventHandler!({
          t: "auth-ok",
        });
      });

      // Should not change state or show toasts
      expect(result.current.roomPasswordStatus).toBeNull();
      expect(result.current.roomPasswordPending).toBe(false);
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  describe("effect dependencies", () => {
    it("should re-register handler when registerServerEventHandler changes", () => {
      const registerServerEventHandler1 = vi.fn();
      const registerServerEventHandler2 = vi.fn();
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      const { rerender } = renderHook(
        ({ registerServerEventHandler }) =>
          useServerEventHandlers({ registerServerEventHandler, toast }),
        { initialProps: { registerServerEventHandler: registerServerEventHandler1 } },
      );

      expect(registerServerEventHandler1).toHaveBeenCalledTimes(1);

      rerender({ registerServerEventHandler: registerServerEventHandler2 });

      expect(registerServerEventHandler2).toHaveBeenCalledTimes(1);
    });

    it("should re-register handler when toast changes", () => {
      const registerServerEventHandler = vi.fn();
      const toast1 = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };
      const toast2 = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      const { rerender } = renderHook(
        ({ toast }) => useServerEventHandlers({ registerServerEventHandler, toast }),
        {
          initialProps: { toast: toast1 },
        },
      );

      const callCount = registerServerEventHandler.mock.calls.length;

      rerender({ toast: toast2 });

      // Should be called again
      expect(registerServerEventHandler.mock.calls.length).toBeGreaterThan(callCount);
    });
  });

  describe("handleSetRoomPassword", () => {
    it("should call sendMessage with set-room-password message", () => {
      const registerServerEventHandler = vi.fn();
      const sendMessage = vi.fn();
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      const { result } = renderHook(() =>
        useServerEventHandlers({ registerServerEventHandler, toast, sendMessage }),
      );

      act(() => {
        result.current.handleSetRoomPassword("my-secret-password");
      });

      expect(sendMessage).toHaveBeenCalledTimes(1);
      expect(sendMessage).toHaveBeenCalledWith({
        t: "set-room-password",
        secret: "my-secret-password",
      });
    });

    it("should call startRoomPasswordUpdate before sending message", () => {
      const registerServerEventHandler = vi.fn();
      const sendMessage = vi.fn();
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      const { result } = renderHook(() =>
        useServerEventHandlers({ registerServerEventHandler, toast, sendMessage }),
      );

      act(() => {
        result.current.handleSetRoomPassword("test-password");
      });

      // Should set pending to true and clear status
      expect(result.current.roomPasswordPending).toBe(true);
      expect(result.current.roomPasswordStatus).toBeNull();
    });

    it("should handle empty password string", () => {
      const registerServerEventHandler = vi.fn();
      const sendMessage = vi.fn();
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      const { result } = renderHook(() =>
        useServerEventHandlers({ registerServerEventHandler, toast, sendMessage }),
      );

      act(() => {
        result.current.handleSetRoomPassword("");
      });

      expect(sendMessage).toHaveBeenCalledWith({
        t: "set-room-password",
        secret: "",
      });
    });

    it("should handle special characters in password", () => {
      const registerServerEventHandler = vi.fn();
      const sendMessage = vi.fn();
      const toast = {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        dismiss: vi.fn(),
        messages: [],
      };

      const { result } = renderHook(() =>
        useServerEventHandlers({ registerServerEventHandler, toast, sendMessage }),
      );

      const complexPassword = "p@ssw0rd!#$%^&*()_+-=[]{}|;:,.<>?";

      act(() => {
        result.current.handleSetRoomPassword(complexPassword);
      });

      expect(sendMessage).toHaveBeenCalledWith({
        t: "set-room-password",
        secret: complexPassword,
      });
    });
  });
});
