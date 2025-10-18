// ============================================================================
// DRAWING TOOL HOOK
// ============================================================================
// Manages drawing tool state and interactions
// Extracted from MapBoard.tsx to follow single responsibility principle

import { useEffect, useState, type RefObject } from "react";
import type Konva from "konva";
import type { ClientMessage, SceneObject } from "@shared";
import { generateUUID } from "../utils/uuid";
import { splitFreehandDrawing } from "../features/drawing/utils/splitFreehandDrawing";

/**
 * Check if a point is within a certain distance of a line segment
 */
function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx: number;
  let yy: number;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if eraser path intersects with a drawing
 */
function eraserIntersectsDrawing(
  eraserPath: { x: number; y: number }[],
  drawing: SceneObject & { type: "drawing" },
  eraserWidth: number,
): boolean {
  const points = drawing.data.drawing.points;
  if (!points || points.length === 0) return false;

  // Transform drawing points by the scene object's transform
  const transform = drawing.transform;
  const transformPoint = (p: { x: number; y: number }) => ({
    x: p.x * transform.scaleX + transform.x,
    y: p.y * transform.scaleY + transform.y,
  });

  const drawingType = drawing.data.drawing.type;
  const drawingWidth = drawing.data.drawing.width;
  const hitRadius = (eraserWidth + drawingWidth) / 2;

  // For each point in the eraser path, check if it's close to the drawing
  for (const eraserPoint of eraserPath) {
    switch (drawingType) {
      case "freehand": {
        // Check if eraser point is close to any segment of the freehand drawing
        for (let i = 0; i < points.length - 1; i++) {
          const p1 = transformPoint(points[i]);
          const p2 = transformPoint(points[i + 1]);
          const dist = pointToSegmentDistance(eraserPoint.x, eraserPoint.y, p1.x, p1.y, p2.x, p2.y);
          if (dist < hitRadius) return true;
        }
        break;
      }

      case "line": {
        if (points.length < 2) break;
        const start = transformPoint(points[0]);
        const end = transformPoint(points[points.length - 1]);
        const dist = pointToSegmentDistance(
          eraserPoint.x,
          eraserPoint.y,
          start.x,
          start.y,
          end.x,
          end.y,
        );
        if (dist < hitRadius) return true;
        break;
      }

      case "rect": {
        if (points.length < 2) break;
        const p1 = transformPoint(points[0]);
        const p2 = transformPoint(points[points.length - 1]);
        const x1 = Math.min(p1.x, p2.x);
        const y1 = Math.min(p1.y, p2.y);
        const x2 = Math.max(p1.x, p2.x);
        const y2 = Math.max(p1.y, p2.y);

        // Check if eraser point is inside or near the rectangle edges
        const isInside =
          eraserPoint.x >= x1 - hitRadius &&
          eraserPoint.x <= x2 + hitRadius &&
          eraserPoint.y >= y1 - hitRadius &&
          eraserPoint.y <= y2 + hitRadius;

        const isOnEdge =
          eraserPoint.x >= x1 && eraserPoint.x <= x2 && eraserPoint.y >= y1 && eraserPoint.y <= y2;

        if (isOnEdge || isInside) return true;
        break;
      }

      case "circle": {
        if (points.length < 2) break;
        const center = transformPoint(points[0]);
        const last = transformPoint(points[points.length - 1]);
        const radius = Math.sqrt(Math.pow(last.x - center.x, 2) + Math.pow(last.y - center.y, 2));

        const distToCenter = Math.sqrt(
          Math.pow(eraserPoint.x - center.x, 2) + Math.pow(eraserPoint.y - center.y, 2),
        );

        // Check if eraser point is near the circle edge
        if (Math.abs(distToCenter - radius) < hitRadius) return true;
        break;
      }

      case "eraser":
        // Ignore eraser "drawings"
        break;
    }
  }

  return false;
}

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

  useEffect(() => {
    if (!drawMode) {
      setCurrentDrawing([]);
      setIsDrawing(false);
    }
  }, [drawMode]);

  /**
   * Start a new drawing on mouse down
   */
  const onMouseDown = (stageRef: RefObject<Konva.Stage | null>) => {
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
  const onMouseMove = (stageRef: RefObject<Konva.Stage | null>) => {
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

    // Handle eraser tool differently - delete intersecting drawings
    if (drawTool === "eraser" && currentDrawing.length > 1) {
      // Find all drawings that intersect with the eraser path
      const intersecting = drawingObjects.filter((drawing) =>
        eraserIntersectsDrawing(currentDrawing, drawing, drawWidth),
      );

      for (const drawing of intersecting) {
        const drawingId = drawing.data.drawing.id;
        if (drawing.data.drawing.type === "freehand") {
          const segments = splitFreehandDrawing(drawing, currentDrawing, drawWidth);
          if (segments.length > 0) {
            sendMessage({
              t: "erase-partial",
              deleteId: drawingId,
              segments,
            });
            continue;
          }
        }

        sendMessage({
          t: "delete-drawing",
          id: drawingId,
        });
      }

      // Clear the eraser path (don't save it)
      setCurrentDrawing([]);
      setIsDrawing(false);
      return;
    }

    // Only send drawing if we have meaningful content
    const shouldSend =
      (drawTool === "freehand" && currentDrawing.length > 1) ||
      ((drawTool === "line" || drawTool === "rect" || drawTool === "circle") &&
        currentDrawing.length >= 2);

    if (shouldSend) {
      const drawingId = generateUUID();

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
