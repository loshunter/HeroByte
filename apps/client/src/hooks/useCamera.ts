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

  // The camera a gesture last SAW. A gesture computes each frame from the
  // camera it started on; when something else moved the camera meanwhile (the
  // phone's move-pad follow gliding, a travel arrival, a wheel zoom mid-pan)
  // the next frame would snap it straight back — a visible flash-and-revert
  // per step. Instead the gesture shifts its origin by the outside delta: the
  // outside change stands, the finger's own travel is kept in full (nothing
  // absorbed, however many frames the outside writer takes), and the map keeps
  // moving from where it is.
  const seen = useRef<Camera | null>(null);
  const commit = (next: Camera) => {
    seen.current = next;
    setCam(next);
  };
  const absorbOutsideChange = () => {
    if (!camOrigin.current || !seen.current || cam === seen.current) return;
    camOrigin.current = {
      x: camOrigin.current.x + (cam.x - seen.current.x),
      y: camOrigin.current.y + (cam.y - seen.current.y),
      scale: cam.scale,
    };
    seen.current = cam;
  };
  // A finger resting on the phone's d-pad is a touch too, but not on the map:
  // only the touches that STARTED on the stage are the gesture (else a thumb
  // on the pad plus one finger on the map read as a pinch).
  const stageTouches = (evt: TouchEvent): TouchList =>
    evt.targetTouches && evt.targetTouches.length > 0 ? evt.targetTouches : evt.touches;

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

    // Plain setCam: a wheel zoom during a mouse pan is an OUTSIDE change to
    // the pan, which then shifts its origin rather than reverting the zoom.
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
      seen.current = cam;
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
      absorbOutsideChange();

      const dx = p.x - dragOrigin.current.x;
      const dy = p.y - dragOrigin.current.y;

      commit({
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
    const touches = stageTouches(event.evt);

    if (touches.length === 1 && shouldPan) {
      // Single finger pan
      setIsPanning(true);
      camOrigin.current = cam;
      seen.current = cam;
      dragOrigin.current = { x: touches[0].clientX, y: touches[0].clientY };
    } else if (touches.length === 2) {
      // Two finger pinch
      event.evt.preventDefault(); // Stop browser zoom
      const p1 = { x: touches[0].clientX, y: touches[0].clientY };
      const p2 = { x: touches[1].clientX, y: touches[1].clientY };

      lastCenter.current = getCenter(p1, p2);
      lastDist.current = getDistance(p1, p2);
      camOrigin.current = cam;
      seen.current = cam;
    }
  };

  /**
   * Handle touch move (Pan or Pinch)
   */
  const onTouchMove = (
    event: KonvaEventObject<TouchEvent>,
    _stageRef: RefObject<Konva.Stage | null>,
  ) => {
    const touches = stageTouches(event.evt);

    if (touches.length === 1 && isPanning && dragOrigin.current && camOrigin.current) {
      // Single finger pan
      const p = { x: touches[0].clientX, y: touches[0].clientY };
      absorbOutsideChange();
      const dx = p.x - dragOrigin.current.x;
      const dy = p.y - dragOrigin.current.y;

      commit({
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
      absorbOutsideChange();

      /*
       * The world point the gesture grabbed, fixed at touchstart.
       *
       * This used to be derived from newCenter — the CURRENT midpoint measured
       * against the START camera — and then the centre travel was added back on
       * as `+ dx`. That counts the travel twice. The error works out to exactly
       *
       *     (c - c0) * (1 - scale/scale0)
       *
       * which is zero for a pure zoom (the centre never moves) and zero for a
       * pure two-finger drag (the scale never changes) — the two gestures
       * anyone tests deliberately. It only appears when you zoom AND slide at
       * once, which is what a real hand does: pinch to 2x while travelling
       * 100px and the map lands ~100px away from your fingers, sliding out from
       * under them mid-gesture. It is worst at the zoom limits, where the clamp
       * makes scale/scale0 diverge furthest from 1.
       *
       * Anchoring on the frozen start centre instead makes the invariant exact:
       * whatever was under the fingers when the pinch began stays under them,
       * at any scale, including while clamped.
       */
      const pointTo = {
        x: (lastCenter.current.x - camOrigin.current.x) / camOrigin.current.scale,
        y: (lastCenter.current.y - camOrigin.current.y) / camOrigin.current.scale,
      };

      const scale = camOrigin.current.scale * (newDist / lastDist.current);
      const clampedScale = Math.min(maxScale, Math.max(minScale, scale));

      const newPos = {
        x: newCenter.x - pointTo.x * clampedScale,
        y: newCenter.y - pointTo.y * clampedScale,
        scale: clampedScale,
      };

      commit(newPos);
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
