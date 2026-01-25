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
  onTouchStart: (
    event: KonvaEventObject<TouchEvent>,
    stageRef: RefObject<Konva.Stage | null>,
    shouldPan: boolean,
  ) => void;
  onTouchMove: (
    event: KonvaEventObject<TouchEvent>,
    stageRef: RefObject<Konva.Stage | null>,
  ) => void;
  onTouchEnd: () => void;
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

  // Touch tracking (Pinch zoom)
  const lastCenter = useRef<{ x: number; y: number } | null>(null);
  const lastDist = useRef<number>(0);

  /**
   * Convert screen coordinates to world coordinates
   */
  const toWorld = (sx: number, sy: number) => ({
    x: (sx - cam.x) / cam.scale,
    y: (sy - cam.y) / cam.scale,
  });

  function getDistance(p1: { x: number; y: number }, p2: { x: number; y: number }) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  function getCenter(p1: { x: number; y: number }, p2: { x: number; y: number }) {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    };
  }

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

  /**
   * Handle touch start (Pan or Pinch)
   */
  const onTouchStart = (
    event: KonvaEventObject<TouchEvent>,
    stageRef: RefObject<Konva.Stage | null>,
    shouldPan: boolean,
  ) => {
    const touches = event.evt.touches;

    if (touches.length === 1 && shouldPan) {
      // Single finger pan
      setIsPanning(true);
      camOrigin.current = cam;
      dragOrigin.current = { x: touches[0].clientX, y: touches[0].clientY };
    } else if (touches.length === 2) {
      // Two finger pinch
      event.evt.preventDefault(); // Stop browser zoom
      const p1 = { x: touches[0].clientX, y: touches[0].clientY };
      const p2 = { x: touches[1].clientX, y: touches[1].clientY };

      lastCenter.current = getCenter(p1, p2);
      lastDist.current = getDistance(p1, p2);
      camOrigin.current = cam;
    }
  };

  /**
   * Handle touch move (Pan or Pinch)
   */
  const onTouchMove = (
    event: KonvaEventObject<TouchEvent>,
    stageRef: RefObject<Konva.Stage | null>,
  ) => {
    const touches = event.evt.touches;

    if (touches.length === 1 && isPanning && dragOrigin.current && camOrigin.current) {
      // Single finger pan
      const p = { x: touches[0].clientX, y: touches[0].clientY };
      const dx = p.x - dragOrigin.current.x;
      const dy = p.y - dragOrigin.current.y;

      setCam({
        ...camOrigin.current,
        x: camOrigin.current.x + dx,
        y: camOrigin.current.y + dy,
      });
    } else if (touches.length === 2 && lastCenter.current && camOrigin.current) {
      // Two finger pinch zoom
      event.evt.preventDefault(); // Stop browser zoom

      const p1 = { x: touches[0].clientX, y: touches[0].clientY };
      const p2 = { x: touches[1].clientX, y: touches[1].clientY };

      const newCenter = getCenter(p1, p2);
      const newDist = getDistance(p1, p2);

      // Calculate scale change
      const pointTo = {
        x: (newCenter.x - camOrigin.current.x) / camOrigin.current.scale,
        y: (newCenter.y - camOrigin.current.y) / camOrigin.current.scale,
      };

      const scale = camOrigin.current.scale * (newDist / lastDist.current);
      const clampedScale = Math.min(maxScale, Math.max(minScale, scale));

      // Calculate new position to keep center stable
      const dx = newCenter.x - lastCenter.current.x;
      const dy = newCenter.y - lastCenter.current.y;

      const newPos = {
        x: newCenter.x - pointTo.x * clampedScale + dx,
        y: newCenter.y - pointTo.y * clampedScale + dy,
        scale: clampedScale,
      };

      setCam(newPos);
    }
  };

  /**
   * Handle touch end
   */
  const onTouchEnd = () => {
    setIsPanning(false);
    dragOrigin.current = null;
    camOrigin.current = null;
    lastCenter.current = null;
    lastDist.current = 0;
  };

  return {
    cam,
    setCam,
    isPanning,
    onWheel,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    toWorld,
  };
}
