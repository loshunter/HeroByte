// ============================================================================
// DRAWING TOOL HOOK
// ============================================================================
// Manages drawing tool state and interactions
// Extracted from MapBoard.tsx to follow single responsibility principle

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type Konva from "konva";
import type { ClientMessage, SceneObject } from "@shared";
import { generateUUID } from "../utils/uuid";
import { evaluatePartialErase } from "../features/drawing/utils/partialErase";

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
  drawingObjects: (SceneObject & { type: "drawing" })[];
}

interface UseDrawingToolReturn {
  currentDrawing: { x: number; y: number }[];
  isDrawing: boolean;
  onMouseDown: (stageRef: RefObject<Konva.Stage | null>) => void;
  onMouseMove: (stageRef: RefObject<Konva.Stage | null>) => void;
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
    drawingObjects,
  } = options;

  // Drawing tool state
  const [currentDrawing, setCurrentDrawing] = useState<{ x: number; y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // Use ref to track drawing points during mouse movement to avoid excessive re-renders
  const drawingPointsRef = useRef<{ x: number; y: number }[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!drawMode) {
      setCurrentDrawing([]);
      setIsDrawing(false);
      drawingPointsRef.current = [];
      // Cancel any pending animation frame when exiting draw mode
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
  }, [drawMode]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Update state from ref using requestAnimationFrame
  const scheduleDrawingUpdate = useCallback(() => {
    if (animationFrameRef.current !== null) return;

    animationFrameRef.current = requestAnimationFrame(() => {
      setCurrentDrawing([...drawingPointsRef.current]);
      animationFrameRef.current = null;
    });
  }, []);

  /**
   * Start a new drawing on mouse down
   */
  const onMouseDown = useCallback(
    (stageRef: RefObject<Konva.Stage | null>) => {
      if (!drawMode) return;

      const pointer = stageRef.current?.getPointerPosition();
      if (!pointer) return;

      const world = toWorld(pointer.x, pointer.y);
      setIsDrawing(true);

      // For freehand and eraser, continuously add points
      // For shapes and lines, just track start/end points
      if (drawTool === "freehand" || drawTool === "eraser") {
        drawingPointsRef.current = [world];
        setCurrentDrawing([world]);
      } else {
        // For line, rect, circle: store start point
        drawingPointsRef.current = [world, world];
        setCurrentDrawing([world, world]);
      }
    },
    [drawMode, drawTool, toWorld],
  );

  /**
   * Update drawing as mouse moves
   */
  const onMouseMove = useCallback(
    (stageRef: RefObject<Konva.Stage | null>) => {
      if (!drawMode || !isDrawing) return;

      const pointer = stageRef.current?.getPointerPosition();
      if (!pointer) return;

      const world = toWorld(pointer.x, pointer.y);

      // For freehand and eraser, continuously add points
      if (drawTool === "freehand" || drawTool === "eraser") {
        drawingPointsRef.current.push(world);
      } else {
        // For shapes/line, just update the end point
        drawingPointsRef.current[1] = world;
      }

      // Schedule state update with requestAnimationFrame to avoid excessive renders
      scheduleDrawingUpdate();
    },
    [drawMode, isDrawing, drawTool, toWorld, scheduleDrawingUpdate],
  );

  /**
   * Complete drawing on mouse up and send to server
   */
  const onMouseUp = useCallback(() => {
    if (!drawMode || !isDrawing || drawingPointsRef.current.length === 0) {
      setIsDrawing(false);
      drawingPointsRef.current = [];
      return;
    }

    // Cancel any pending animation frame
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const finalDrawing = drawingPointsRef.current;

    // Handle eraser tool differently - delete intersecting drawings
    if (drawTool === "eraser" && finalDrawing.length > 1) {
      for (const drawing of drawingObjects) {
        const drawingId = drawing.data.drawing.id;

        const result = evaluatePartialErase(drawing, finalDrawing, drawWidth);
        if (result.kind === "none") {
          continue;
        }

        if (result.kind === "partial") {
          sendMessage({
            t: "erase-partial",
            deleteId: drawingId,
            segments: result.segments,
          });
          continue;
        }

        sendMessage({ t: "delete-drawing", id: drawingId });
      }

      // Clear the eraser path (don't save it)
      setCurrentDrawing([]);
      setIsDrawing(false);
      drawingPointsRef.current = [];
      return;
    }

    // Only send drawing if we have meaningful content
    const shouldSend =
      (drawTool === "freehand" && finalDrawing.length > 1) ||
      ((drawTool === "line" || drawTool === "rect" || drawTool === "circle") &&
        finalDrawing.length >= 2);

    if (shouldSend) {
      const drawingId = generateUUID();

      sendMessage({
        t: "draw",
        drawing: {
          id: drawingId,
          type: drawTool,
          points: finalDrawing,
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
    drawingPointsRef.current = [];
  }, [
    drawMode,
    isDrawing,
    drawTool,
    drawColor,
    drawWidth,
    drawOpacity,
    drawFilled,
    sendMessage,
    onDrawingComplete,
    drawingObjects,
  ]);

  return {
    currentDrawing,
    isDrawing,
    onMouseDown,
    onMouseMove,
    onMouseUp,
  };
}
