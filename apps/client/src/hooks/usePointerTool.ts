// ============================================================================
// POINTER TOOL HOOK
// ============================================================================
// Manages pointer and measure tool state
// Extracted from MapBoard.tsx to follow single responsibility principle

import { useState, useEffect, type RefObject } from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { ClientMessage } from "@shared";

interface UsePointerToolOptions {
  pointerMode: boolean;
  measureMode: boolean;
  toWorld: (sx: number, sy: number) => { x: number; y: number };
  sendMessage: (msg: ClientMessage) => void;
}

interface UsePointerToolReturn {
  measureStart: { x: number; y: number } | null;
  measureEnd: { x: number; y: number } | null;
  onStageClick: (event: KonvaEventObject<MouseEvent | PointerEvent>) => void;
  onMouseMove: (stageRef: RefObject<Konva.Stage | null>) => void;
}

/**
 * Hook to manage pointer and measure tool interactions
 */
export function usePointerTool(options: UsePointerToolOptions): UsePointerToolReturn {
  const { pointerMode, measureMode, toWorld, sendMessage } = options;

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
  const onStageClick = (event: KonvaEventObject<MouseEvent | PointerEvent>) => {
    if (!pointerMode && !measureMode) return;

    const stage = event.target.getStage();
    if (!stage) return;
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
  const onMouseMove = (stageRef: RefObject<Konva.Stage | null>) => {
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
