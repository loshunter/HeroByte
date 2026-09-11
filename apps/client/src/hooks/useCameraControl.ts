import { useEffect, useRef, type RefObject } from "react";
import { useCamera } from "./useCamera.js";
import { motionDisabled } from "../features/juice/juiceSettings";
import type { CameraCommand } from "../ui/MapBoard.types";
import type { RoomSnapshot } from "@herobyte/shared";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";

/**
 * A `focus-point` that names a screen point (`at`) is the phone's move-pad
 * follow, and it can fire on every held step in a short landscape band; a
 * one-frame jump at that cadence is a strobe, so those commands GLIDE. The
 * ease lands exactly on the target (the last frame writes t = 1). Motion off
 * lands at once, and so does a runtime with no `requestAnimationFrame`. jsdom
 * HAS one and glides (the characterization test counts the frames); a hidden
 * tab has one that never fires, so a glide there freezes mid-ease until the
 * tab shows. Any command — a reset, a focus — cancels a glide in flight.
 */
export const CAMERA_GLIDE_MS = 120;

/**
 * Hook parameters for camera control
 */
export interface UseCameraControlParams {
  /**
   * Camera command to execute (reset, focus-token)
   */
  cameraCommand: CameraCommand | null;
  /**
   * Callback when camera command is handled
   */
  onCameraCommandHandled: () => void;
  /**
   * Current room snapshot (for token lookup)
   */
  snapshot: RoomSnapshot | null;
  /**
   * Grid size in pixels
   */
  gridSize: number;
  /**
   * Viewport width in pixels
   */
  w: number;
  /**
   * Viewport height in pixels
   */
  h: number;
  /**
   * Optional callback when camera state changes
   */
  onCameraChange?: (cam: { x: number; y: number; scale: number }) => void;
}

/**
 * Hook return value containing camera state and handlers
 */
export interface UseCameraControlReturn {
  /**
   * Current camera state (position and scale)
   */
  cam: { x: number; y: number; scale: number };
  /**
   * Update camera state
   */
  setCam: (
    cam:
      | { x: number; y: number; scale: number }
      | ((prev: { x: number; y: number; scale: number }) => {
          x: number;
          y: number;
          scale: number;
        }),
  ) => void;
  /**
   * Whether camera is currently panning
   */
  isPanning: boolean;
  /**
   * Wheel event handler (zoom)
   */
  handleWheel: (e: KonvaEventObject<WheelEvent>, stageRef: RefObject<Konva.Stage | null>) => void;
  /**
   * Mouse down handler (start pan)
   */
  handleCameraMouseDown: (
    e: KonvaEventObject<PointerEvent>,
    stageRef: RefObject<Konva.Stage | null>,
    shouldPan: boolean,
  ) => void;
  /**
   * Mouse move handler (pan)
   */
  handleCameraMouseMove: (stageRef: RefObject<Konva.Stage | null>) => void;
  /**
   * Mouse up handler (end pan)
   */
  handleCameraMouseUp: () => void;
  /**
   * Touch start handler (start pan/pinch)
   */
  handleTouchStart: (
    e: KonvaEventObject<TouchEvent>,
    stageRef: RefObject<Konva.Stage | null>,
    shouldPan: boolean,
  ) => void;
  /**
   * Touch move handler (pan/pinch)
   */
  handleTouchMove: (
    e: KonvaEventObject<TouchEvent>,
    stageRef: RefObject<Konva.Stage | null>,
  ) => void;
  /**
   * Touch end handler (end pan/pinch)
   */
  handleTouchEnd: () => void;
  /**
   * Convert screen coordinates to world coordinates
   */
  toWorld: (screenX: number, screenY: number) => { x: number; y: number };
}

/**
 * useCameraControl
 *
 * Manages camera control including commands (reset, focus) and change notifications.
 * Centralizes camera state management and command handling.
 *
 * Features:
 * - Camera reset command (reset to origin)
 * - Focus token command (center on specific token)
 * - Camera change notifications
 * - Pan/zoom handlers from useCamera
 *
 * @param params - Hook parameters
 * @returns Camera state and handlers
 */
export function useCameraControl({
  cameraCommand,
  onCameraCommandHandled,
  snapshot,
  gridSize,
  w,
  h,
  onCameraChange,
}: UseCameraControlParams): UseCameraControlReturn {
  // Camera controls (pan/zoom)
  const {
    cam,
    setCam,
    isPanning,
    onWheel: handleWheel,
    onMouseDown: handleCameraMouseDown,
    onMouseMove: handleCameraMouseMove,
    onMouseUp: handleCameraMouseUp,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    toWorld,
  } = useCamera();

  // Notify parent when camera changes
  useEffect(() => {
    onCameraChange?.(cam);
  }, [cam, onCameraChange]);

  const glideFrame = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (glideFrame.current !== null) cancelAnimationFrame(glideFrame.current);
    },
    [],
  );

  // Camera command handler
  useEffect(() => {
    if (!cameraCommand) return;
    // Whatever was gliding, this command supersedes it — a reset must not be
    // overwritten by a glide's remaining frames.
    if (glideFrame.current !== null) {
      cancelAnimationFrame(glideFrame.current);
      glideFrame.current = null;
    }

    if (cameraCommand.type === "reset") {
      setCam((prev) => ({ ...prev, x: 0, y: 0, scale: 1 }));
      onCameraCommandHandled();
      return;
    }

    if (cameraCommand.type === "focus-point") {
      // The producer places `at` inside the stage; only a nonsense value is
      // caught here (a negative or non-finite point would blank the map).
      const finite = (value: number | undefined, fallback: number) =>
        value !== undefined && Number.isFinite(value) ? Math.max(0, value) : fallback;
      const atX = finite(cameraCommand.at?.x, w / 2);
      const atY = finite(cameraCommand.at?.y, h / 2);
      const targetFor = (scale: number) => ({
        x: atX - cameraCommand.x * scale,
        y: atY - cameraCommand.y * scale,
      });
      const glide =
        cameraCommand.at !== undefined &&
        !motionDisabled() &&
        typeof requestAnimationFrame === "function";
      if (!glide) {
        setCam((prevCam) => ({ ...prevCam, ...targetFor(prevCam.scale) }));
      } else {
        // The clock is the frames' own: a start read elsewhere (performance.now
        // under jsdom) can precede or follow it by any amount.
        let start: number | null = null;
        let from: { x: number; y: number } | null = null;
        const frame = (now: number) => {
          start ??= now;
          const t = Math.max(0, Math.min(1, (now - start) / CAMERA_GLIDE_MS));
          const eased = 1 - (1 - t) ** 3;
          setCam((prevCam) => {
            from ??= { x: prevCam.x, y: prevCam.y };
            const target = targetFor(prevCam.scale);
            return {
              ...prevCam,
              x: from.x + (target.x - from.x) * eased,
              y: from.y + (target.y - from.y) * eased,
            };
          });
          glideFrame.current = t < 1 ? requestAnimationFrame(frame) : null;
        };
        glideFrame.current = requestAnimationFrame(frame);
      }
      onCameraCommandHandled();
      return;
    }

    if (cameraCommand.type === "focus-token") {
      const token = snapshot?.tokens?.find((t) => t.id === cameraCommand.tokenId);
      if (!token) {
        if (typeof window !== "undefined" && typeof window.alert === "function") {
          window.alert("Token not found.");
        }
        onCameraCommandHandled();
        return;
      }

      setCam((prevCam) => {
        const scale = prevCam.scale;
        const centerX = token.x * gridSize + gridSize / 2;
        const centerY = token.y * gridSize + gridSize / 2;
        const newX = w / 2 - centerX * scale;
        const newY = h / 2 - centerY * scale;
        return { ...prevCam, x: newX, y: newY };
      });

      onCameraCommandHandled();
    }
  }, [cameraCommand, gridSize, onCameraCommandHandled, setCam, snapshot?.tokens, w, h]);

  return {
    cam,
    setCam,
    isPanning,
    handleWheel,
    handleCameraMouseDown,
    handleCameraMouseMove,
    handleCameraMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    toWorld,
  };
}
