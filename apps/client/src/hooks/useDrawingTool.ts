// ============================================================================
// DRAWING TOOL HOOK
// ============================================================================
// Manages drawing tool state and interactions
// Extracted from MapBoard.tsx to follow single responsibility principle

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type Konva from "konva";
import {
  templateKindForTool,
  type AreaTemplate,
  type ClientMessage,
  type DrawTool,
  type SceneObject,
} from "@herobyte/shared";
import { projectTemplateDrag, templateDrawingFor } from "../features/drawing/utils/templateDraft";
import { generateUUID } from "../utils/uuid";
import { commitEraseStroke } from "../features/drawing/utils/eraseStroke";

interface UseDrawingToolOptions {
  drawMode: boolean;
  drawTool: DrawTool;
  drawColor: string;
  drawWidth: number;
  drawOpacity: number;
  drawFilled: boolean;
  /** World pixels per grid square — templates snap to it. */
  gridSize: number;
  /** Feet per grid square, so a template can report its size. */
  gridSquareSize: number;
  toWorld: (sx: number, sy: number) => { x: number; y: number };
  sendMessage: (msg: ClientMessage) => void;
  onDrawingComplete?: (drawingId: string) => void;
  drawingObjects: (SceneObject & { type: "drawing" })[];
}

interface UseDrawingToolReturn {
  /**
   * The preview geometry. For a template tool this is the SNAPPED POLYGON,
   * not the raw drag — the shape the player releases on is the shape that
   * lands, because both come from the same `buildAreaTemplate` call.
   */
  currentDrawing: { x: number; y: number }[];
  /** Size/kind of the template being dragged, for its readout. */
  currentTemplate?: AreaTemplate;
  isDrawing: boolean;
  onMouseDown: (stageRef: RefObject<Konva.Stage | null>) => void;
  onMouseMove: (stageRef: RefObject<Konva.Stage | null>) => void;
  onMouseUp: () => void;
  /** Abandon the in-progress stroke without sending it. */
  cancel: () => void;
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
    gridSize,
    gridSquareSize,
    toWorld,
    sendMessage,
    onDrawingComplete,
    drawingObjects,
  } = options;

  // Drawing tool state
  const [currentDrawing, setCurrentDrawing] = useState<{ x: number; y: number }[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<AreaTemplate | undefined>(undefined);
  const [isDrawing, setIsDrawing] = useState(false);

  // Use ref to track drawing points during mouse movement to avoid excessive re-renders
  const drawingPointsRef = useRef<{ x: number; y: number }[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Which template shape this tool draws, or null for a plain drawing tool.
  const templateKind = templateKindForTool(drawTool);

  const projectTemplate = useCallback(
    (raw: { x: number; y: number }[]) =>
      projectTemplateDrag({ drawTool, raw, gridSize, gridSquareSize }),
    [drawTool, gridSize, gridSquareSize],
  );

  const publishPreview = useCallback(() => {
    const built = projectTemplate(drawingPointsRef.current);
    if (built) {
      setCurrentDrawing(built.points);
      setCurrentTemplate(built.template);
      return;
    }
    setCurrentDrawing([...drawingPointsRef.current]);
    setCurrentTemplate(undefined);
  }, [projectTemplate]);

  useEffect(() => {
    if (!drawMode) {
      setCurrentDrawing([]);
      setCurrentTemplate(undefined);
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
      publishPreview();
      animationFrameRef.current = null;
    });
  }, [publishPreview]);

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
        setCurrentTemplate(undefined);
      } else {
        // For line, rect, circle and every template: store start point
        drawingPointsRef.current = [world, world];
        publishPreview();
      }
    },
    [drawMode, drawTool, toWorld, publishPreview],
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
      commitEraseStroke(drawingObjects, finalDrawing, drawWidth, sendMessage);

      // Clear the eraser path (don't save it)
      setCurrentDrawing([]);
      setCurrentTemplate(undefined);
      setIsDrawing(false);
      drawingPointsRef.current = [];
      return;
    }

    // Templates commit as ONE record type with the polygon already baked in,
    // so the shape on the table is byte-for-byte the shape the player let go
    // of. A tap that never moved is not a template — the origin and the aim
    // are the same point — and must not litter the map from a stray touch.
    if (templateKind) {
      const drawing = templateDrawingFor({
        drawTool,
        raw: finalDrawing,
        gridSize,
        gridSquareSize,
        style: {
          id: generateUUID(),
          color: drawColor,
          width: drawWidth,
          opacity: drawOpacity,
        },
      });
      if (drawing) {
        sendMessage({ t: "draw", drawing });
        onDrawingComplete?.(drawing.id);
      }
      setCurrentDrawing([]);
      setCurrentTemplate(undefined);
      setIsDrawing(false);
      drawingPointsRef.current = [];
      return;
    }

    /*
     * A tap is not a shape. onMouseDown seeds line/rect/circle with
     * [world, world], so a press-and-release that never moved already
     * satisfies `length >= 2` and would commit a zero-size drawing. Harmless
     * to click past on a desktop; on a phone it is reachable by every stray
     * tap, and double-tap-to-ping fires two of them.
     */
    const isDegenerate =
      finalDrawing.length === 2 &&
      finalDrawing[0].x === finalDrawing[1].x &&
      finalDrawing[0].y === finalDrawing[1].y;

    // Only send drawing if we have meaningful content
    const shouldSend =
      !isDegenerate &&
      ((drawTool === "freehand" && finalDrawing.length > 1) ||
        ((drawTool === "line" || drawTool === "rect" || drawTool === "circle") &&
          finalDrawing.length >= 2));

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
    setCurrentTemplate(undefined);
    setIsDrawing(false);
    drawingPointsRef.current = [];
  }, [
    drawMode,
    isDrawing,
    drawTool,
    templateKind,
    gridSize,
    gridSquareSize,
    drawColor,
    drawWidth,
    drawOpacity,
    drawFilled,
    sendMessage,
    onDrawingComplete,
    drawingObjects,
  ]);

  /**
   * Drop the in-progress stroke on the floor.
   *
   * onMouseUp is a commit — it always tries to send. Touch needs the other
   * half: a second finger landing mid-stroke means the user wants to pinch,
   * and turning that into a drawing would leave a mark every time they zoom.
   */
  const cancel = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    drawingPointsRef.current = [];
    setCurrentDrawing([]);
    setCurrentTemplate(undefined);
    setIsDrawing(false);
  }, []);

  return {
    currentDrawing,
    currentTemplate,
    isDrawing,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    cancel,
  };
}
