import { useEffect, type RefObject } from "react";
import { useCamera } from "./useCamera.js";
import type { CameraCommand } from "../ui/MapBoard.types";
import type { RoomSnapshot } from "@shared";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";

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
    toWorld,
  } = useCamera();

  // Notify parent when camera changes
  useEffect(() => {
    onCameraChange?.(cam);
  }, [cam, onCameraChange]);

  // Camera command handler
  useEffect(() => {
    if (!cameraCommand) return;

    if (cameraCommand.type === "reset") {
      setCam((prev) => ({ ...prev, x: 0, y: 0, scale: 1 }));
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
    toWorld,
  };
}
