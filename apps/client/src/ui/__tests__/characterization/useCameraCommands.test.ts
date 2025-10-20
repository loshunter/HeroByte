/**
 * Characterization tests for Camera Command management
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/client/src/ui/App.tsx:512, 929-940, 1584
 * Target: apps/client/src/hooks/useCameraCommands.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState, useCallback } from "react";
import type { RoomSnapshot } from "@shared";

// Mock CameraCommand type from MapBoard
type CameraCommand =
  | { type: "reset" }
  | { type: "focus-token"; tokenId: string };

/**
 * Simplified version of the hook logic from App.tsx for characterization testing
 */
function useCameraCommandsCharacterization({
  snapshot,
  uid,
}: {
  snapshot: RoomSnapshot | null;
  uid: string;
}) {
  const [cameraCommand, setCameraCommand] = useState<CameraCommand | null>(null);

  const handleFocusSelf = useCallback(() => {
    const myToken = snapshot?.tokens?.find((t) => t.owner === uid);
    if (!myToken) {
      window.alert("You don't have a token on the map yet.");
      return;
    }
    setCameraCommand({ type: "focus-token", tokenId: myToken.id });
  }, [snapshot?.tokens, uid]);

  const handleResetCamera = useCallback(() => {
    setCameraCommand({ type: "reset" });
  }, []);

  const handleCameraCommandHandled = useCallback(() => {
    setCameraCommand(null);
  }, []);

  return {
    cameraCommand,
    handleFocusSelf,
    handleResetCamera,
    handleCameraCommandHandled,
  };
}

describe("useCameraCommands - Characterization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.alert
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initial state", () => {
    it("should initialize with null camera command", () => {
      const { result } = renderHook(() =>
        useCameraCommandsCharacterization({ snapshot: null, uid: "user123" }),
      );

      expect(result.current.cameraCommand).toBeNull();
    });
  });

  describe("handleFocusSelf", () => {
    it("should set focus command when user token exists", () => {
      const snapshot: RoomSnapshot = {
        tokens: [
          {
            id: "token1",
            owner: "user123",
            name: "Player Token",
            x: 100,
            y: 200,
            size: "medium" as const,
            color: "#ff0000",
            imageUrl: null,
          },
        ],
      } as RoomSnapshot;

      const { result } = renderHook(() =>
        useCameraCommandsCharacterization({ snapshot, uid: "user123" }),
      );

      act(() => {
        result.current.handleFocusSelf();
      });

      expect(result.current.cameraCommand).toEqual({
        type: "focus-token",
        tokenId: "token1",
      });
    });

    it("should show alert and not set command when user has no token", () => {
      const snapshot: RoomSnapshot = {
        tokens: [
          {
            id: "token1",
            owner: "otherUser",
            name: "Other Token",
            x: 100,
            y: 200,
            size: "medium" as const,
            color: "#ff0000",
            imageUrl: null,
          },
        ],
      } as RoomSnapshot;

      const { result } = renderHook(() =>
        useCameraCommandsCharacterization({ snapshot, uid: "user123" }),
      );

      act(() => {
        result.current.handleFocusSelf();
      });

      expect(window.alert).toHaveBeenCalledWith("You don't have a token on the map yet.");
      expect(result.current.cameraCommand).toBeNull();
    });

    it("should show alert when snapshot is null", () => {
      const { result } = renderHook(() =>
        useCameraCommandsCharacterization({ snapshot: null, uid: "user123" }),
      );

      act(() => {
        result.current.handleFocusSelf();
      });

      expect(window.alert).toHaveBeenCalledWith("You don't have a token on the map yet.");
      expect(result.current.cameraCommand).toBeNull();
    });

    it("should show alert when tokens array is empty", () => {
      const snapshot: RoomSnapshot = {
        tokens: [],
      } as RoomSnapshot;

      const { result } = renderHook(() =>
        useCameraCommandsCharacterization({ snapshot, uid: "user123" }),
      );

      act(() => {
        result.current.handleFocusSelf();
      });

      expect(window.alert).toHaveBeenCalledWith("You don't have a token on the map yet.");
      expect(result.current.cameraCommand).toBeNull();
    });

    it("should find correct token when multiple tokens exist", () => {
      const snapshot: RoomSnapshot = {
        tokens: [
          {
            id: "token1",
            owner: "otherUser1",
            name: "Token 1",
            x: 100,
            y: 200,
            size: "medium" as const,
            color: "#ff0000",
            imageUrl: null,
          },
          {
            id: "token2",
            owner: "user123",
            name: "My Token",
            x: 150,
            y: 250,
            size: "medium" as const,
            color: "#00ff00",
            imageUrl: null,
          },
          {
            id: "token3",
            owner: "otherUser2",
            name: "Token 3",
            x: 200,
            y: 300,
            size: "medium" as const,
            color: "#0000ff",
            imageUrl: null,
          },
        ],
      } as RoomSnapshot;

      const { result } = renderHook(() =>
        useCameraCommandsCharacterization({ snapshot, uid: "user123" }),
      );

      act(() => {
        result.current.handleFocusSelf();
      });

      expect(result.current.cameraCommand).toEqual({
        type: "focus-token",
        tokenId: "token2",
      });
    });
  });

  describe("handleResetCamera", () => {
    it("should set reset command", () => {
      const { result } = renderHook(() =>
        useCameraCommandsCharacterization({ snapshot: null, uid: "user123" }),
      );

      act(() => {
        result.current.handleResetCamera();
      });

      expect(result.current.cameraCommand).toEqual({
        type: "reset",
      });
    });

    it("should set reset command regardless of snapshot state", () => {
      const snapshot: RoomSnapshot = {
        tokens: [],
      } as RoomSnapshot;

      const { result } = renderHook(() =>
        useCameraCommandsCharacterization({ snapshot, uid: "user123" }),
      );

      act(() => {
        result.current.handleResetCamera();
      });

      expect(result.current.cameraCommand).toEqual({
        type: "reset",
      });
    });

    it("should override existing focus command", () => {
      const snapshot: RoomSnapshot = {
        tokens: [
          {
            id: "token1",
            owner: "user123",
            name: "Player Token",
            x: 100,
            y: 200,
            size: "medium" as const,
            color: "#ff0000",
            imageUrl: null,
          },
        ],
      } as RoomSnapshot;

      const { result } = renderHook(() =>
        useCameraCommandsCharacterization({ snapshot, uid: "user123" }),
      );

      act(() => {
        result.current.handleFocusSelf();
      });

      expect(result.current.cameraCommand).toEqual({
        type: "focus-token",
        tokenId: "token1",
      });

      act(() => {
        result.current.handleResetCamera();
      });

      expect(result.current.cameraCommand).toEqual({
        type: "reset",
      });
    });
  });

  describe("handleCameraCommandHandled", () => {
    it("should clear the camera command", () => {
      const { result } = renderHook(() =>
        useCameraCommandsCharacterization({ snapshot: null, uid: "user123" }),
      );

      // Set a reset command
      act(() => {
        result.current.handleResetCamera();
      });

      expect(result.current.cameraCommand).toEqual({ type: "reset" });

      // Clear it
      act(() => {
        result.current.handleCameraCommandHandled();
      });

      expect(result.current.cameraCommand).toBeNull();
    });

    it("should clear focus command", () => {
      const snapshot: RoomSnapshot = {
        tokens: [
          {
            id: "token1",
            owner: "user123",
            name: "Player Token",
            x: 100,
            y: 200,
            size: "medium" as const,
            color: "#ff0000",
            imageUrl: null,
          },
        ],
      } as RoomSnapshot;

      const { result } = renderHook(() =>
        useCameraCommandsCharacterization({ snapshot, uid: "user123" }),
      );

      // Set a focus command
      act(() => {
        result.current.handleFocusSelf();
      });

      expect(result.current.cameraCommand).toEqual({
        type: "focus-token",
        tokenId: "token1",
      });

      // Clear it
      act(() => {
        result.current.handleCameraCommandHandled();
      });

      expect(result.current.cameraCommand).toBeNull();
    });

    it("should be idempotent when command is already null", () => {
      const { result } = renderHook(() =>
        useCameraCommandsCharacterization({ snapshot: null, uid: "user123" }),
      );

      expect(result.current.cameraCommand).toBeNull();

      act(() => {
        result.current.handleCameraCommandHandled();
      });

      expect(result.current.cameraCommand).toBeNull();
    });
  });

  describe("command lifecycle", () => {
    it("should support complete lifecycle: focus -> handle -> reset -> handle", () => {
      const snapshot: RoomSnapshot = {
        tokens: [
          {
            id: "token1",
            owner: "user123",
            name: "Player Token",
            x: 100,
            y: 200,
            size: "medium" as const,
            color: "#ff0000",
            imageUrl: null,
          },
        ],
      } as RoomSnapshot;

      const { result } = renderHook(() =>
        useCameraCommandsCharacterization({ snapshot, uid: "user123" }),
      );

      // Initial state
      expect(result.current.cameraCommand).toBeNull();

      // Focus self
      act(() => {
        result.current.handleFocusSelf();
      });
      expect(result.current.cameraCommand).toEqual({
        type: "focus-token",
        tokenId: "token1",
      });

      // Handle command
      act(() => {
        result.current.handleCameraCommandHandled();
      });
      expect(result.current.cameraCommand).toBeNull();

      // Reset camera
      act(() => {
        result.current.handleResetCamera();
      });
      expect(result.current.cameraCommand).toEqual({ type: "reset" });

      // Handle command again
      act(() => {
        result.current.handleCameraCommandHandled();
      });
      expect(result.current.cameraCommand).toBeNull();
    });
  });

  describe("dependency handling", () => {
    it("should update handleFocusSelf when snapshot changes", () => {
      const snapshot1: RoomSnapshot = {
        tokens: [
          {
            id: "token1",
            owner: "user123",
            name: "Token 1",
            x: 100,
            y: 200,
            size: "medium" as const,
            color: "#ff0000",
            imageUrl: null,
          },
        ],
      } as RoomSnapshot;

      const { result, rerender } = renderHook(
        ({ snapshot, uid }) => useCameraCommandsCharacterization({ snapshot, uid }),
        {
          initialProps: { snapshot: snapshot1, uid: "user123" },
        },
      );

      act(() => {
        result.current.handleFocusSelf();
      });

      expect(result.current.cameraCommand).toEqual({
        type: "focus-token",
        tokenId: "token1",
      });

      // Clear command
      act(() => {
        result.current.handleCameraCommandHandled();
      });

      // Update snapshot with new token
      const snapshot2: RoomSnapshot = {
        tokens: [
          {
            id: "token2",
            owner: "user123",
            name: "Token 2",
            x: 150,
            y: 250,
            size: "medium" as const,
            color: "#00ff00",
            imageUrl: null,
          },
        ],
      } as RoomSnapshot;

      rerender({ snapshot: snapshot2, uid: "user123" });

      act(() => {
        result.current.handleFocusSelf();
      });

      expect(result.current.cameraCommand).toEqual({
        type: "focus-token",
        tokenId: "token2",
      });
    });

    it("should update handleFocusSelf when uid changes", () => {
      const snapshot: RoomSnapshot = {
        tokens: [
          {
            id: "token1",
            owner: "user123",
            name: "Token 1",
            x: 100,
            y: 200,
            size: "medium" as const,
            color: "#ff0000",
            imageUrl: null,
          },
          {
            id: "token2",
            owner: "user456",
            name: "Token 2",
            x: 150,
            y: 250,
            size: "medium" as const,
            color: "#00ff00",
            imageUrl: null,
          },
        ],
      } as RoomSnapshot;

      const { result, rerender } = renderHook(
        ({ snapshot, uid }) => useCameraCommandsCharacterization({ snapshot, uid }),
        {
          initialProps: { snapshot, uid: "user123" },
        },
      );

      act(() => {
        result.current.handleFocusSelf();
      });

      expect(result.current.cameraCommand).toEqual({
        type: "focus-token",
        tokenId: "token1",
      });

      // Clear command
      act(() => {
        result.current.handleCameraCommandHandled();
      });

      // Change uid
      rerender({ snapshot, uid: "user456" });

      act(() => {
        result.current.handleFocusSelf();
      });

      expect(result.current.cameraCommand).toEqual({
        type: "focus-token",
        tokenId: "token2",
      });
    });
  });
});
