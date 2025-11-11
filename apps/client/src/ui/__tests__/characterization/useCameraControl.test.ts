import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCameraControl } from "../../../hooks/useCameraControl";
import type { CameraCommand } from "../../MapBoard.types";
import type { RoomSnapshot } from "@shared";

describe("useCameraControl", () => {
  const mockOnCameraChange = vi.fn();
  const mockOnCameraCommandHandled = vi.fn();

  const mockSnapshot: Partial<RoomSnapshot> = {
    tokens: [
      { id: "token-1", x: 10, y: 20, owner: "player-1", name: "Hero", color: "#ff0000" },
      { id: "token-2", x: 5, y: 8, owner: "player-2", name: "Villain", color: "#0000ff" },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial camera state", () => {
    it("should initialize camera with default values", () => {
      const { result } = renderHook(() =>
        useCameraControl({
          cameraCommand: null,
          onCameraCommandHandled: mockOnCameraCommandHandled,
          snapshot: mockSnapshot as RoomSnapshot,
          gridSize: 50,
          w: 800,
          h: 600,
          onCameraChange: mockOnCameraChange,
        }),
      );

      expect(result.current.cam).toEqual({
        x: 0,
        y: 0,
        scale: 1,
      });
      expect(result.current.isPanning).toBe(false);
    });

    it("should call onCameraChange when camera state changes", async () => {
      renderHook(() =>
        useCameraControl({
          cameraCommand: null,
          onCameraCommandHandled: mockOnCameraCommandHandled,
          snapshot: mockSnapshot as RoomSnapshot,
          gridSize: 50,
          w: 800,
          h: 600,
          onCameraChange: mockOnCameraChange,
        }),
      );

      // Should be called once on mount with initial camera state
      await waitFor(() => {
        expect(mockOnCameraChange).toHaveBeenCalledWith({
          x: 0,
          y: 0,
          scale: 1,
        });
      });
    });
  });

  describe("camera commands", () => {
    describe("reset command", () => {
      it("should reset camera to default position and scale", async () => {
        const resetCommand: CameraCommand = { type: "reset" };

        const { result } = renderHook(() =>
          useCameraControl({
            cameraCommand: resetCommand,
            onCameraCommandHandled: mockOnCameraCommandHandled,
            snapshot: mockSnapshot as RoomSnapshot,
            gridSize: 50,
            w: 800,
            h: 600,
            onCameraChange: mockOnCameraChange,
          }),
        );

        await waitFor(() => {
          expect(result.current.cam).toEqual({
            x: 0,
            y: 0,
            scale: 1,
          });
          expect(mockOnCameraCommandHandled).toHaveBeenCalled();
        });
      });

      it("should reset camera even if already at default position", async () => {
        const resetCommand: CameraCommand = { type: "reset" };

        renderHook(() =>
          useCameraControl({
            cameraCommand: resetCommand,
            onCameraCommandHandled: mockOnCameraCommandHandled,
            snapshot: mockSnapshot as RoomSnapshot,
            gridSize: 50,
            w: 800,
            h: 600,
            onCameraChange: mockOnCameraChange,
          }),
        );

        await waitFor(() => {
          expect(mockOnCameraCommandHandled).toHaveBeenCalled();
        });
      });
    });

    describe("focus-token command", () => {
      it("should focus on a token and center it in the viewport", async () => {
        const focusCommand: CameraCommand = { type: "focus-token", tokenId: "token-1" };
        const windowAlertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

        const { result } = renderHook(() =>
          useCameraControl({
            cameraCommand: focusCommand,
            onCameraCommandHandled: mockOnCameraCommandHandled,
            snapshot: mockSnapshot as RoomSnapshot,
            gridSize: 50,
            w: 800,
            h: 600,
            onCameraChange: mockOnCameraChange,
          }),
        );

        await waitFor(() => {
          // Token at (10, 20) with gridSize 50
          // centerX = 10 * 50 + 50/2 = 525
          // centerY = 20 * 50 + 50/2 = 1025
          // newX = 800/2 - 525 * 1 = 400 - 525 = -125
          // newY = 600/2 - 1025 * 1 = 300 - 1025 = -725
          expect(result.current.cam).toEqual({
            x: -125,
            y: -725,
            scale: 1,
          });
          expect(mockOnCameraCommandHandled).toHaveBeenCalled();
          expect(windowAlertSpy).not.toHaveBeenCalled();
        });

        windowAlertSpy.mockRestore();
      });

      it("should focus on a different token", async () => {
        const focusCommand: CameraCommand = { type: "focus-token", tokenId: "token-2" };
        const windowAlertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

        const { result } = renderHook(() =>
          useCameraControl({
            cameraCommand: focusCommand,
            onCameraCommandHandled: mockOnCameraCommandHandled,
            snapshot: mockSnapshot as RoomSnapshot,
            gridSize: 50,
            w: 800,
            h: 600,
            onCameraChange: mockOnCameraChange,
          }),
        );

        await waitFor(() => {
          // Token at (5, 8) with gridSize 50
          // centerX = 5 * 50 + 50/2 = 275
          // centerY = 8 * 50 + 50/2 = 425
          // newX = 800/2 - 275 * 1 = 400 - 275 = 125
          // newY = 600/2 - 425 * 1 = 300 - 425 = -125
          expect(result.current.cam).toEqual({
            x: 125,
            y: -125,
            scale: 1,
          });
          expect(mockOnCameraCommandHandled).toHaveBeenCalled();
          expect(windowAlertSpy).not.toHaveBeenCalled();
        });

        windowAlertSpy.mockRestore();
      });

      it("should alert and handle command if token not found", async () => {
        const focusCommand: CameraCommand = { type: "focus-token", tokenId: "nonexistent-token" };
        const windowAlertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

        renderHook(() =>
          useCameraControl({
            cameraCommand: focusCommand,
            onCameraCommandHandled: mockOnCameraCommandHandled,
            snapshot: mockSnapshot as RoomSnapshot,
            gridSize: 50,
            w: 800,
            h: 600,
            onCameraChange: mockOnCameraChange,
          }),
        );

        await waitFor(() => {
          expect(windowAlertSpy).toHaveBeenCalledWith("Token not found.");
          expect(mockOnCameraCommandHandled).toHaveBeenCalled();
        });

        windowAlertSpy.mockRestore();
      });

      it("should handle empty tokens array", async () => {
        const focusCommand: CameraCommand = { type: "focus-token", tokenId: "token-1" };
        const windowAlertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

        renderHook(() =>
          useCameraControl({
            cameraCommand: focusCommand,
            onCameraCommandHandled: mockOnCameraCommandHandled,
            snapshot: { ...mockSnapshot, tokens: [] } as RoomSnapshot,
            gridSize: 50,
            w: 800,
            h: 600,
            onCameraChange: mockOnCameraChange,
          }),
        );

        await waitFor(() => {
          expect(windowAlertSpy).toHaveBeenCalledWith("Token not found.");
          expect(mockOnCameraCommandHandled).toHaveBeenCalled();
        });

        windowAlertSpy.mockRestore();
      });
    });

    describe("no command", () => {
      it("should not call onCameraCommandHandled when no command", () => {
        renderHook(() =>
          useCameraControl({
            cameraCommand: null,
            onCameraCommandHandled: mockOnCameraCommandHandled,
            snapshot: mockSnapshot as RoomSnapshot,
            gridSize: 50,
            w: 800,
            h: 600,
            onCameraChange: mockOnCameraChange,
          }),
        );

        // onCameraCommandHandled should not be called when cameraCommand is null
        expect(mockOnCameraCommandHandled).not.toHaveBeenCalled();
      });
    });
  });

  describe("camera handlers", () => {
    it("should expose camera handlers from useCamera", () => {
      const { result } = renderHook(() =>
        useCameraControl({
          cameraCommand: null,
          onCameraCommandHandled: mockOnCameraCommandHandled,
          snapshot: mockSnapshot as RoomSnapshot,
          gridSize: 50,
          w: 800,
          h: 600,
          onCameraChange: mockOnCameraChange,
        }),
      );

      expect(result.current.handleWheel).toBeDefined();
      expect(result.current.handleCameraMouseDown).toBeDefined();
      expect(result.current.handleCameraMouseMove).toBeDefined();
      expect(result.current.handleCameraMouseUp).toBeDefined();
      expect(result.current.toWorld).toBeDefined();
    });
  });

  describe("camera state updates", () => {
    it("should notify parent when camera changes via setCam", async () => {
      const { result } = renderHook(() =>
        useCameraControl({
          cameraCommand: null,
          onCameraCommandHandled: mockOnCameraCommandHandled,
          snapshot: mockSnapshot as RoomSnapshot,
          gridSize: 50,
          w: 800,
          h: 600,
          onCameraChange: mockOnCameraChange,
        }),
      );

      // Clear initial call
      mockOnCameraChange.mockClear();

      // Update camera state
      act(() => {
        result.current.setCam({ x: 100, y: 200, scale: 1.5 });
      });

      await waitFor(() => {
        expect(mockOnCameraChange).toHaveBeenCalledWith({
          x: 100,
          y: 200,
          scale: 1.5,
        });
      });
    });
  });
});
