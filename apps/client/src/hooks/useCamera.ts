// ============================================================================
// CAMERA HOOK
// ============================================================================
// Manages camera state (pan and zoom) for the map canvas
// Extracted from MapBoard.tsx to follow single responsibility principle

import { useState, useRef } from "react";

export type Camera = { x: number; y: number; scale: number };

interface UseCameraOptions {
  minScale?: number;
  maxScale?: number;
  scaleBy?: number;
}

interface UseCameraReturn {
  cam: Camera;
  setCam: React.Dispatch<React.SetStateAction<Camera>>;
  isPanning: boolean;
  onWheel: (e: any, stageRef: any) => void;
  onMouseDown: (e: any, stageRef: any, shouldPan: boolean) => void;
  onMouseMove: (stageRef: any) => void;
  onMouseUp: () => void;
  toWorld: (sx: number, sy: number) => { x: number; y: number };
}

/**
 * Hook to manage camera state and pan/zoom controls
 */
export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const {
    minScale = 0.1,
    maxScale = 8,
    scaleBy = 1.08,
  } = options;

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
  const onWheel = (e: any, stageRef: any) => {
    e.evt.preventDefault();
    const oldScale = cam.scale;

    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return;

    const mouseWorld = {
      x: (pointer.x - cam.x) / oldScale,
      y: (pointer.y - cam.y) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? 1 : -1;
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
  const onMouseDown = (e: any, stageRef: any, shouldPan: boolean) => {
    const isSpace = e.evt && (e.evt.code === "Space" || e.evt.buttons === 4);

    if (shouldPan || isSpace) {
      setIsPanning(true);
      camOrigin.current = cam;
      dragOrigin.current = stageRef.current?.getPointerPosition() || null;
    }
  };

  /**
   * Update camera position while panning
   */
  const onMouseMove = (stageRef: any) => {
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
