// ============================================================================
// CAMERA HOOK
// ============================================================================
// Manages camera state (pan and zoom) for the map canvas
// Extracted from MapBoard.tsx to follow single responsibility principle

import { useState, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";

export type Camera = { x: number; y: number; scale: number };

interface UseCameraOptions {
  minScale?: number;
  maxScale?: number;
  scaleBy?: number;
}

interface UseCameraReturn {
  cam: Camera;
  setCam: Dispatch<SetStateAction<Camera>>;
  isPanning: boolean;
  onWheel: (event: KonvaEventObject<WheelEvent>, stageRef: RefObject<Konva.Stage | null>) => void;
  onMouseDown: (
    event: KonvaEventObject<PointerEvent>,
    stageRef: RefObject<Konva.Stage | null>,
    shouldPan: boolean,
  ) => void;
  onMouseMove: (stageRef: RefObject<Konva.Stage | null>) => void;
  onMouseUp: () => void;
  toWorld: (sx: number, sy: number) => { x: number; y: number };
}

/**
 * Hook to manage camera state and pan/zoom controls
 */
export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const { minScale = 0.1, maxScale = 8, scaleBy = 1.08 } = options;

  // Camera state (pan and zoom)
  const [cam, setCam] = useState<Camera>({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);

  // Pan tracking
  const dragOrigin = useRef<{ x: number; y: number } | null>(null);
  const camOrigin = useRef<Camera | null>(null);

  /**
   * Convert screen coordinates to world coordinates
   */
  const toWorld = (sx: number, sy: number) => ({
    x: (sx - cam.x) / cam.scale,
    y: (sy - cam.y) / cam.scale,
  });

  /**
   * Zoom with mouse wheel, zooming toward cursor position
   */
  const onWheel = (
    event: KonvaEventObject<WheelEvent>,
    stageRef: RefObject<Konva.Stage | null>,
  ) => {
    event.evt.preventDefault();
    const oldScale = cam.scale;

    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return;

    const mouseWorld = {
      x: (pointer.x - cam.x) / oldScale,
      y: (pointer.y - cam.y) / oldScale,
    };

    const direction = event.evt.deltaY > 0 ? 1 : -1;
    const newScale = direction > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    const clamped = Math.min(maxScale, Math.max(minScale, newScale));

    const newPos = {
      x: pointer.x - mouseWorld.x * clamped,
      y: pointer.y - mouseWorld.y * clamped,
    };

    setCam({ x: newPos.x, y: newPos.y, scale: clamped });
  };

  /**
   * Start panning on mouse down
   */
  const onMouseDown = (
    event: KonvaEventObject<PointerEvent>,
    stageRef: RefObject<Konva.Stage | null>,
    shouldPan: boolean,
  ) => {
    const originalEvent = event.evt;
    const isSpace =
      "code" in originalEvent && (originalEvent as unknown as KeyboardEvent).code === "Space";
    const middleClick = "buttons" in originalEvent && originalEvent.buttons === 4;

    if (shouldPan || isSpace || middleClick) {
      setIsPanning(true);
      camOrigin.current = cam;
      dragOrigin.current = stageRef.current?.getPointerPosition() || null;
    }
  };

  /**
   * Update camera position while panning
   */
  const onMouseMove = (stageRef: RefObject<Konva.Stage | null>) => {
    if (isPanning && dragOrigin.current && camOrigin.current) {
      const p = stageRef.current?.getPointerPosition();
      if (!p) return;

      const dx = p.x - dragOrigin.current.x;
      const dy = p.y - dragOrigin.current.y;

      setCam({
        ...camOrigin.current,
        x: camOrigin.current.x + dx,
        y: camOrigin.current.y + dy,
      });
    }
  };

  /**
   * Stop panning on mouse up
   */
  const onMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      dragOrigin.current = null;
      camOrigin.current = null;
    }
  };

  return {
    cam,
    setCam,
    isPanning,
    onWheel,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    toWorld,
  };
}
