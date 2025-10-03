// ============================================================================
// DRAWING TOOL HOOK
// ============================================================================
// Manages drawing tool state and interactions
// Extracted from MapBoard.tsx to follow single responsibility principle

import { useState } from "react";
import type { ClientMessage } from "@shared";

interface UseDrawingToolOptions {
  drawMode: boolean;
  drawTool: "freehand" | "line" | "rect" | "circle" | "eraser";
  drawColor: string;
  drawWidth: number;
  drawOpacity: number;
  drawFilled: boolean;
  toWorld: (sx: number, sy: number) => { x: number; y: number };
  sendMessage: (msg: ClientMessage) => void;
  onDrawingComplete?: (drawingId: string) => void;
}

interface UseDrawingToolReturn {
  currentDrawing: { x: number; y: number }[];
  isDrawing: boolean;
  onMouseDown: (stageRef: any) => void;
  onMouseMove: (stageRef: any) => void;
  onMouseUp: () => void;
}

/**
 * Hook to manage drawing tool interactions
 */
export function useDrawingTool(options: UseDrawingToolOptions): UseDrawingToolReturn {
  const {
    drawMode,
    drawTool,
    drawColor,
    drawWidth,
    drawOpacity,
    drawFilled,
    toWorld,
    sendMessage,
    onDrawingComplete,
  } = options;

  // Drawing tool state
  const [currentDrawing, setCurrentDrawing] = useState<{ x: number; y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  /**
   * Start a new drawing on mouse down
   */
  const onMouseDown = (stageRef: any) => {
    if (!drawMode) return;

    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return;

    const world = toWorld(pointer.x, pointer.y);
    setIsDrawing(true);

    // For freehand and eraser, continuously add points
    // For shapes and lines, just track start/end points
    if (drawTool === "freehand" || drawTool === "eraser") {
      setCurrentDrawing([world]);
    } else {
      // For line, rect, circle: store start point
      setCurrentDrawing([world, world]);
    }
  };

  /**
   * Update drawing as mouse moves
   */
  const onMouseMove = (stageRef: any) => {
    if (!drawMode || !isDrawing) return;

    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return;

    const world = toWorld(pointer.x, pointer.y);

    // For freehand and eraser, continuously add points
    if (drawTool === "freehand" || drawTool === "eraser") {
      setCurrentDrawing((prev) => [...prev, world]);
    } else {
      // For shapes/line, just update the end point
      setCurrentDrawing((prev) => [prev[0], world]);
    }
  };

  /**
   * Complete drawing on mouse up and send to server
   */
  const onMouseUp = () => {
    if (!drawMode || !isDrawing || currentDrawing.length === 0) {
      setIsDrawing(false);
      return;
    }

    // Only send drawing if we have meaningful content
    const shouldSend =
      ((drawTool === "freehand" || drawTool === "eraser") && currentDrawing.length > 1) ||
      ((drawTool === "line" || drawTool === "rect" || drawTool === "circle") && currentDrawing.length >= 2);

    if (shouldSend) {
      const drawingId = typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function"
        ? crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });

      sendMessage({
        t: "draw",
        drawing: {
          id: drawingId,
          type: drawTool,
          points: currentDrawing,
          color: drawColor,
          width: drawWidth,
          opacity: drawOpacity,
          filled: drawFilled,
        },
      });

      // Notify parent that a drawing was completed (for undo history)
      onDrawingComplete?.(drawingId);
    }

    setCurrentDrawing([]);
    setIsDrawing(false);
  };

  return {
    currentDrawing,
    isDrawing,
    onMouseDown,
    onMouseMove,
    onMouseUp,
  };
}
