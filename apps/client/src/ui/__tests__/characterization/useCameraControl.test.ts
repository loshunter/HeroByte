import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCameraControl } from "../../../hooks/useCameraControl";
import type { CameraCommand } from "../../MapBoard.types";
import type { RoomSnapshot } from "@herobyte/shared";
import { setMotionLevel } from "../../../features/juice/juiceSettings";

describe("useCameraControl", () => {
  const mockOnCameraChange = vi.fn();
  const mockOnCameraCommandHandled = vi.fn();

  const mockSnapshot: Partial<RoomSnapshot> = {
    tokens: [
      { id: "token-1", x: 10, y: 20, owner: "player-1", color: "#ff0000" },
      { id: "token-2", x: 5, y: 8, owner: "player-2", color: "#0000ff" },
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

    describe("focus-point command", () => {
      it("centres the world point in the whole stage by default — AT ONCE, no glide without `at`", () => {
        // Hoisted: an inline literal is a new command every render, and the
        // handler effect would re-fire forever (a real OOM while writing this).
        const command: CameraCommand = { type: "focus-point", x: 525, y: 1025 };
        const { result } = renderHook(() =>
          useCameraControl({
            cameraCommand: command,
            onCameraCommandHandled: mockOnCameraCommandHandled,
            snapshot: mockSnapshot as RoomSnapshot,
            gridSize: 50,
            w: 800,
            h: 600,
            onCameraChange: mockOnCameraChange,
          }),
        );
        // Synchronous: a travel arrival lands in the same commit, it does not tween.
        expect(result.current.cam).toEqual({ x: -125, y: -725, scale: 1 });
        expect(mockOnCameraCommandHandled).toHaveBeenCalled();
      });

      it("a reset issued during a glide wins: the glide's remaining frames are cancelled", async () => {
        const glide: CameraCommand = {
          type: "focus-point",
          x: 525,
          y: 1025,
          at: { x: 150, y: 236 },
        };
        let pending: CameraCommand | null = glide;
        const cancelled = vi.spyOn(window, "cancelAnimationFrame");
        try {
          const { result, rerender } = renderHook(() =>
            useCameraControl({
              cameraCommand: pending,
              onCameraCommandHandled: mockOnCameraCommandHandled,
              snapshot: mockSnapshot as RoomSnapshot,
              gridSize: 50,
              w: 375,
              h: 812,
              onCameraChange: mockOnCameraChange,
            }),
          );
          // One frame in, then the View button's reset.
          await act(async () => {
            await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
          });
          pending = { type: "reset" };
          rerender();
          expect(cancelled).toHaveBeenCalled();
          expect(result.current.cam).toEqual({ x: 0, y: 0, scale: 1 });
          // And it STAYS at the origin after the glide would have finished.
          await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 200));
          });
          expect(result.current.cam).toEqual({ x: 0, y: 0, scale: 1 });
        } finally {
          cancelled.mockRestore();
        }
      });

      it("unmounting mid-glide cancels the pending frame", async () => {
        const glide: CameraCommand = {
          type: "focus-point",
          x: 525,
          y: 1025,
          at: { x: 150, y: 236 },
        };
        const cancelled = vi.spyOn(window, "cancelAnimationFrame");
        try {
          const { unmount } = renderHook(() =>
            useCameraControl({
              cameraCommand: glide,
              onCameraCommandHandled: mockOnCameraCommandHandled,
              snapshot: mockSnapshot as RoomSnapshot,
              gridSize: 50,
              w: 375,
              h: 812,
              onCameraChange: mockOnCameraChange,
            }),
          );
          unmount();
          expect(cancelled).toHaveBeenCalled();
        } finally {
          cancelled.mockRestore();
        }
      });

      it("lands the world point on the `at` screen point — the phone's follow aims into the uncovered map", async () => {
        // A 375×812 stage: the point goes to screen (150, 236), not the
        // stage's middle (187.5, 406) — and the two axes are independent.
        const command: CameraCommand = {
          type: "focus-point",
          x: 525,
          y: 1025,
          at: { x: 150, y: 236 },
        };
        const { result } = renderHook(() =>
          useCameraControl({
            cameraCommand: command,
            onCameraCommandHandled: mockOnCameraCommandHandled,
            snapshot: mockSnapshot as RoomSnapshot,
            gridSize: 50,
            w: 375,
            h: 812,
            onCameraChange: mockOnCameraChange,
          }),
        );
        await waitFor(() => {
          expect(result.current.cam).toEqual({ x: 150 - 525, y: 236 - 1025, scale: 1 });
          expect(mockOnCameraCommandHandled).toHaveBeenCalled();
        });
      });

      it("`at` is a SCREEN point: at scale 2 the world point is scaled, the screen point is not", async () => {
        const command: CameraCommand = {
          type: "focus-point",
          x: 525,
          y: 1025,
          at: { x: 150, y: 236 },
        };
        let pending: CameraCommand | null = null;
        const { result, rerender } = renderHook(() =>
          useCameraControl({
            cameraCommand: pending,
            onCameraCommandHandled: mockOnCameraCommandHandled,
            snapshot: mockSnapshot as RoomSnapshot,
            gridSize: 50,
            w: 375,
            h: 812,
            onCameraChange: mockOnCameraChange,
          }),
        );
        act(() => result.current.setCam({ x: 0, y: 0, scale: 2 }));
        pending = command;
        rerender();
        await waitFor(() => {
          expect(result.current.cam).toEqual({ x: 150 - 1050, y: 236 - 2050, scale: 2 });
        });
      });

      it("a nonsense `at` (negative or not finite) is caught: negative clamps to the edge, NaN falls back to the centre", async () => {
        const command: CameraCommand = {
          type: "focus-point",
          x: 525,
          y: 1025,
          at: { x: -50, y: Number.NaN },
        };
        const { result } = renderHook(() =>
          useCameraControl({
            cameraCommand: command,
            onCameraCommandHandled: mockOnCameraCommandHandled,
            snapshot: mockSnapshot as RoomSnapshot,
            gridSize: 50,
            w: 375,
            h: 812,
            onCameraChange: mockOnCameraChange,
          }),
        );
        await waitFor(() => {
          expect(result.current.cam).toEqual({ x: 0 - 525, y: 406 - 1025, scale: 1 });
        });
      });

      it("an `at` command GLIDES (several frames, landing exactly) unless motion is off, then it lands at once", async () => {
        const command: CameraCommand = {
          type: "focus-point",
          x: 525,
          y: 1025,
          at: { x: 150, y: 236 },
        };
        const render = () =>
          renderHook(() =>
            useCameraControl({
              cameraCommand: command,
              onCameraCommandHandled: mockOnCameraCommandHandled,
              snapshot: mockSnapshot as RoomSnapshot,
              gridSize: 50,
              w: 375,
              h: 812,
              onCameraChange: mockOnCameraChange,
            }),
          );
        const glided = render();
        await waitFor(() => {
          expect(glided.result.current.cam).toEqual({ x: -375, y: -789, scale: 1 });
        });
        // Frames: the initial notification, then more than one step of the
        // ease — every one between the start and the target, never past it,
        // and never backwards (an overshooting or oscillating ease would land
        // exactly too and fool a final-value check).
        const ys = mockOnCameraChange.mock.calls.map(([cam]) => (cam as { y: number }).y);
        expect(ys.length).toBeGreaterThan(2);
        for (let i = 1; i < ys.length; i += 1) {
          expect(ys[i]).toBeLessThanOrEqual(ys[i - 1]!);
          expect(ys[i]).toBeGreaterThanOrEqual(-789);
        }
        glided.unmount();

        mockOnCameraChange.mockClear();
        setMotionLevel("off");
        try {
          const instant = render();
          // Synchronous: no frame needed.
          expect(instant.result.current.cam).toEqual({ x: -375, y: -789, scale: 1 });
          expect(mockOnCameraChange.mock.calls.length).toBeLessThanOrEqual(2);
        } finally {
          setMotionLevel("full");
        }
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
