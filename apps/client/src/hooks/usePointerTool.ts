// ============================================================================
// POINTER TOOL HOOK
// ============================================================================
// Manages pointer and measure tool state
// Extracted from MapBoard.tsx to follow single responsibility principle

import { useState, useEffect } from "react";
import type { ClientMessage } from "@shared";

interface UsePointerToolOptions {
  pointerMode: boolean;
  measureMode: boolean;
  toWorld: (sx: number, sy: number) => { x: number; y: number };
  sendMessage: (msg: ClientMessage) => void;
  gridSize: number;
}

interface UsePointerToolReturn {
  measureStart: { x: number; y: number } | null;
  measureEnd: { x: number; y: number } | null;
  onStageClick: (e: any) => void;
  onMouseMove: (stageRef: any) => void;
}

/**
 * Hook to manage pointer and measure tool interactions
 */
export function usePointerTool(options: UsePointerToolOptions): UsePointerToolReturn {
  const { pointerMode, measureMode, toWorld, sendMessage, gridSize } = options;

  // Measure tool state
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [measureEnd, setMeasureEnd] = useState<{ x: number; y: number } | null>(null);

  // Clear measure tool when mode changes
  useEffect(() => {
    if (!measureMode) {
      setMeasureStart(null);
      setMeasureEnd(null);
    }
  }, [measureMode]);

  /**
   * Handle stage clicks for pointer and measure tools
   */
  const onStageClick = (e: any) => {
    if (!pointerMode && !measureMode) return;

    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const world = toWorld(pointer.x, pointer.y);

    if (pointerMode) {
      sendMessage({ t: "point", x: world.x, y: world.y });
    } else if (measureMode) {
      if (!measureStart) {
        setMeasureStart(world);
        setMeasureEnd(null);
      } else {
        setMeasureEnd(world);
      }
    }
  };

  /**
   * Update measure tool end point as mouse moves
   */
  const onMouseMove = (stageRef: any) => {
    if (measureMode && measureStart) {
      const pointer = stageRef.current?.getPointerPosition();
      if (!pointer) return;
      const world = toWorld(pointer.x, pointer.y);
      setMeasureEnd(world);
    }
  };

  return {
    measureStart,
    measureEnd,
    onStageClick,
    onMouseMove,
  };
}
