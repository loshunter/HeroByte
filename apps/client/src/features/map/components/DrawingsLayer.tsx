// ============================================================================
// DRAWINGS LAYER COMPONENT (SCENE OBJECT VERSION)
// ============================================================================
// Renders drawing scene objects with selection and drag support, falling back to
// legacy drawing data via the scene object migration hook.

import { memo, useEffect, useRef, useState } from "react";
import { Circle, Group, Line, Rect } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { SceneObject } from "@shared";
import type { Camera } from "../../../hooks/useCamera";

interface DrawingsLayerProps {
  cam: Camera;
  drawingObjects: (SceneObject & { type: "drawing" })[];
  currentDrawing: { x: number; y: number }[];
  currentTool: "freehand" | "line" | "rect" | "circle" | "eraser";
  currentColor?: string;
  currentWidth?: number;
  currentOpacity?: number;
  currentFilled?: boolean;
  uid: string;
  selectMode: boolean;
  transformMode: boolean;
  selectedDrawingId: string | null;
  onSelectDrawing: (drawingId: string | null) => void;
  onTransformDrawing: (sceneId: string, transform: { position?: { x: number; y: number } }) => void;
  selectedObjectId?: string | null;
  selectedObjectIds: string[];
  canManageAllDrawings?: boolean;
  onSelectObject?: (
    objectId: string | null,
    options?: { mode?: "replace" | "append" | "toggle" | "subtract" },
  ) => void;
  onDrawingNodeReady?: (drawingId: string, node: Konva.Node | null) => void;
}

type TransformOverride = Partial<SceneObject["transform"]>;

export const DrawingsLayer = memo(function DrawingsLayer({
  cam,
  drawingObjects,
  currentDrawing,
  currentTool,
  currentColor,
  currentWidth,
  currentOpacity,
  currentFilled,
  uid,
  selectMode,
  transformMode,
  selectedDrawingId,
  onSelectDrawing,
  onTransformDrawing,
  selectedObjectId,
  selectedObjectIds = [],
  canManageAllDrawings = false,
  onSelectObject,
  onDrawingNodeReady,
}: DrawingsLayerProps) {
  const localOverrides = useRef<Record<string, TransformOverride>>({});
  const [, forceRerender] = useState(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartPositions = useRef<Record<string, { x: number; y: number }>>({});

  const applyOverrides = (object: SceneObject & { type: "drawing" }) => {
    const override = localOverrides.current[object.id];
    if (!override) {
      return object;
    }
    return {
      ...object,
      transform: {
        ...object.transform,
        ...override,
      },
    };
  };

  const handleDragStart = (sceneId: string) => {
    setDraggingId(sceneId);

    // Store initial positions of all selected objects for multi-object dragging
    dragStartPositions.current = {};
    for (const id of selectedObjectIds) {
      const obj = drawingObjects.find((d) => d.id === id);
      if (obj) {
        const appliedObj = applyOverrides(obj);
        dragStartPositions.current[id] = {
          x: appliedObj.transform.x,
          y: appliedObj.transform.y,
        };
      }
    }
    console.log("[DrawingsLayer] handleDragStart - stored positions:", dragStartPositions.current);
  };

  const handleDragMove = (sceneId: string, event: KonvaEventObject<DragEvent>) => {
    const node = event.target as Konva.Node;
    const currentPosition = node.position();

    // Calculate the delta from the dragged object's original position
    const startPos = dragStartPositions.current[sceneId];
    if (!startPos) return;

    const deltaX = currentPosition.x - startPos.x;
    const deltaY = currentPosition.y - startPos.y;

    // Apply the delta to all selected objects (except the one being dragged)
    for (const id of selectedObjectIds) {
      if (id === sceneId) continue; // Skip the dragged object itself

      const startPosition = dragStartPositions.current[id];
      if (startPosition) {
        const nextPosition = {
          x: startPosition.x + deltaX,
          y: startPosition.y + deltaY,
        };

        localOverrides.current[id] = {
          x: nextPosition.x,
          y: nextPosition.y,
        };
      }
    }

    // Force re-render to show updated positions
    forceRerender((value) => value + 1);
  };

  const handleDragEnd = (sceneId: string, event: KonvaEventObject<DragEvent>) => {
    const node = event.target as Konva.Node;
    const newPosition = node.position();

    // Calculate the delta from the dragged object's original position
    const startPos = dragStartPositions.current[sceneId];
    if (!startPos) {
      console.warn("[DrawingsLayer] No start position for dragged object:", sceneId);
      setDraggingId(null);
      return;
    }

    const deltaX = newPosition.x - startPos.x;
    const deltaY = newPosition.y - startPos.y;

    console.log("[DrawingsLayer] handleDragEnd - delta:", { deltaX, deltaY, selectedObjectIds });

    // Apply the delta to all selected objects
    for (const id of selectedObjectIds) {
      const startPosition = dragStartPositions.current[id];
      if (startPosition) {
        const nextPosition = {
          x: startPosition.x + deltaX,
          y: startPosition.y + deltaY,
        };

        const nextOverride: TransformOverride = {
          x: nextPosition.x,
          y: nextPosition.y,
        };
        localOverrides.current[id] = nextOverride;

        // Send transform update to server for each selected object
        onTransformDrawing(id, { position: nextPosition });
        console.log("[DrawingsLayer] Moving object:", id, "to", nextPosition);
      }
    }

    forceRerender((value) => value + 1);
    setDraggingId(null);
    dragStartPositions.current = {};
  };

  useEffect(() => {
    const overrides = localOverrides.current;
    const keys = Object.keys(overrides);
    if (keys.length === 0) return;

    const nextOverrides: Record<string, TransformOverride> = { ...overrides };
    let changed = false;

    for (const key of keys) {
      const sceneObject = drawingObjects.find((object) => object.id === key);
      const override = overrides[key];
      if (!sceneObject) {
        delete nextOverrides[key];
        changed = true;
        continue;
      }

      const matchesPosition =
        (override.x === undefined || Math.abs(sceneObject.transform.x - override.x) < 0.1) &&
        (override.y === undefined || Math.abs(sceneObject.transform.y - override.y) < 0.1);

      if (matchesPosition) {
        delete nextOverrides[key];
        changed = true;
      }
    }

    if (changed) {
      localOverrides.current = nextOverrides;
      forceRerender((value) => value + 1);
    }
  }, [drawingObjects]);

  const renderDrawingObject = (sceneObject: SceneObject & { type: "drawing" }) => {
    const appliedObject = applyOverrides(sceneObject);
    const drawing = appliedObject.data.drawing;
    const points = drawing.points;

    if (!points || points.length === 0) {
      console.warn(`Drawing ${drawing.id} has invalid points array`);
      return null;
    }

    const transform = appliedObject.transform;
    // Use unified selectedObjectId if available, otherwise fall back to selectedDrawingId
    const isSelected =
      selectedObjectIds.includes(sceneObject.id) ||
      (selectedObjectId && selectedObjectId === sceneObject.id) ||
      selectedDrawingId === drawing.id;
    const isOwner = !drawing.owner || drawing.owner === uid;
    const selectionEnabled = selectMode || transformMode;
    const canShowSelection = selectionEnabled; // Show selection outlines when selection or transform tools are active
    const canManage = isOwner || canManageAllDrawings;
    const allowClickSelection = selectMode || transformMode;
    const allowDrag = selectMode && canManage && isSelected && !sceneObject.locked;
    const isDragging = draggingId === sceneObject.id;

    const interactiveProps = allowClickSelection
      ? {
          onClick: (event: KonvaEventObject<MouseEvent>) => {
            event.cancelBubble = true;
            // Use unified onSelectObject if available, otherwise fall back
            if (onSelectObject) {
              const native = event.evt as MouseEvent | undefined;
              const append = native?.shiftKey ?? false;
              const toggle = native?.ctrlKey || native?.metaKey || false;
              const mode = append ? "append" : toggle ? "toggle" : "replace";
              onSelectObject(sceneObject.id, { mode });
            } else {
              onSelectDrawing(drawing.id);
            }
          },
          onTap: (event: KonvaEventObject<Event>) => {
            event.cancelBubble = true;
            // Use unified onSelectObject if available, otherwise fall back
            if (onSelectObject) {
              onSelectObject(sceneObject.id);
            } else {
              onSelectDrawing(drawing.id);
            }
          },
        }
      : {};

    const groupHandlers =
      allowDrag
        ? {
            onDragStart: () => handleDragStart(sceneObject.id),
            onDragMove: (event: KonvaEventObject<DragEvent>) => handleDragMove(sceneObject.id, event),
            onDragEnd: (event: KonvaEventObject<DragEvent>) => handleDragEnd(sceneObject.id, event),
          }
        : {};

    const selectionStroke = isDragging ? "#44f" : "#447DF7";
    const baseStrokeWidth = drawing.width / cam.scale;
    const highlightStrokeWidth = 2 / cam.scale;

    switch (drawing.type) {
      case "freehand": {
        return (
          <Group
            key={sceneObject.id}
            x={transform.x}
            y={transform.y}
            scaleX={transform.scaleX}
            scaleY={transform.scaleY}
            rotation={transform.rotation}
            draggable={allowDrag}
            {...groupHandlers}
            ref={
              onDrawingNodeReady ? (node) => onDrawingNodeReady(sceneObject.id, node) : undefined
            }
          >
            {allowClickSelection && (
              <Line
                points={points.flatMap((p) => [p.x, p.y])}
                stroke="transparent"
                strokeWidth={Math.max(20 / cam.scale, (drawing.width + 10) / cam.scale)}
                lineCap="round"
                lineJoin="round"
                {...interactiveProps}
              />
            )}
            <Line
              points={points.flatMap((p) => [p.x, p.y])}
              stroke={drawing.color}
              strokeWidth={baseStrokeWidth}
              lineCap="round"
              lineJoin="round"
              opacity={drawing.opacity}
              listening={false}
            />
            {isSelected && canShowSelection && (
              <Line
                points={points.flatMap((p) => [p.x, p.y])}
                stroke={selectionStroke}
                strokeWidth={highlightStrokeWidth}
                dash={[8 / cam.scale, 4 / cam.scale]}
                lineCap="round"
                lineJoin="round"
                listening={false}
              />
            )}
          </Group>
        );
      }

      case "line": {
        if (points.length < 2) return null;
        const [start, end] = [points[0], points[points.length - 1]];
        return (
          <Group
            key={sceneObject.id}
            x={transform.x}
            y={transform.y}
            scaleX={transform.scaleX}
            scaleY={transform.scaleY}
            rotation={transform.rotation}
            draggable={allowDrag}
            {...groupHandlers}
            ref={
              onDrawingNodeReady ? (node) => onDrawingNodeReady(sceneObject.id, node) : undefined
            }
          >
            {allowClickSelection && (
              <Line
                points={[start.x, start.y, end.x, end.y]}
                stroke="transparent"
                strokeWidth={Math.max(20 / cam.scale, (drawing.width + 10) / cam.scale)}
                lineCap="round"
                {...interactiveProps}
              />
            )}
            <Line
              points={[start.x, start.y, end.x, end.y]}
              stroke={drawing.color}
              strokeWidth={baseStrokeWidth}
              lineCap="round"
              opacity={drawing.opacity}
              listening={false}
            />
            {isSelected && canShowSelection && (
              <Line
                points={[start.x, start.y, end.x, end.y]}
                stroke={selectionStroke}
                strokeWidth={highlightStrokeWidth}
                dash={[8 / cam.scale, 4 / cam.scale]}
                lineCap="round"
                listening={false}
              />
            )}
          </Group>
        );
      }

      case "rect": {
        if (points.length < 2) return null;
        const x1 = Math.min(points[0].x, points[points.length - 1].x);
        const y1 = Math.min(points[0].y, points[points.length - 1].y);
        const x2 = Math.max(points[0].x, points[points.length - 1].x);
        const y2 = Math.max(points[0].y, points[points.length - 1].y);

        return (
          <Group
            key={sceneObject.id}
            x={transform.x}
            y={transform.y}
            scaleX={transform.scaleX}
            scaleY={transform.scaleY}
            rotation={transform.rotation}
            draggable={allowDrag}
            {...groupHandlers}
            ref={
              onDrawingNodeReady ? (node) => onDrawingNodeReady(sceneObject.id, node) : undefined
            }
          >
            <Rect
              x={x1}
              y={y1}
              width={x2 - x1}
              height={y2 - y1}
              fill={drawing.filled ? drawing.color : undefined}
              stroke={drawing.color}
              strokeWidth={baseStrokeWidth}
              opacity={drawing.opacity}
              {...interactiveProps}
            />
            {isSelected && canShowSelection && (
              <Rect
                x={x1}
                y={y1}
                width={x2 - x1}
                height={y2 - y1}
                stroke={selectionStroke}
                strokeWidth={highlightStrokeWidth}
                dash={[8 / cam.scale, 4 / cam.scale]}
                listening={false}
              />
            )}
          </Group>
        );
      }

      case "circle": {
        if (points.length < 2) return null;
        const cx = points[0].x;
        const cy = points[0].y;
        const last = points[points.length - 1];
        const radius = Math.sqrt(Math.pow(last.x - cx, 2) + Math.pow(last.y - cy, 2));

        return (
          <Group
            key={sceneObject.id}
            x={transform.x}
            y={transform.y}
            scaleX={transform.scaleX}
            scaleY={transform.scaleY}
            rotation={transform.rotation}
            draggable={allowDrag}
            {...groupHandlers}
            ref={
              onDrawingNodeReady ? (node) => onDrawingNodeReady(sceneObject.id, node) : undefined
            }
          >
            <Circle
              x={cx}
              y={cy}
              radius={radius}
              fill={drawing.filled ? drawing.color : undefined}
              stroke={drawing.color}
              strokeWidth={baseStrokeWidth}
              opacity={drawing.opacity}
              {...interactiveProps}
            />
            {isSelected && canShowSelection && (
              <Circle
                x={cx}
                y={cy}
                radius={radius}
                stroke={selectionStroke}
                strokeWidth={highlightStrokeWidth}
                dash={[8 / cam.scale, 4 / cam.scale]}
                listening={false}
              />
            )}
          </Group>
        );
      }

      default:
        return null;
    }
  };

  const renderCurrentDrawing = () => {
    if (currentDrawing.length === 0) return null;

    const color = currentColor || "#fff";
    const width = (currentWidth || 3) / cam.scale;
    const opacity = currentOpacity || 0.7;

    switch (currentTool) {
      case "eraser":
        // Show eraser preview as a semi-transparent red line
        return (
          <Line
            points={currentDrawing.flatMap((p) => [p.x, p.y])}
            stroke="#ff4444"
            strokeWidth={width}
            lineCap="round"
            lineJoin="round"
            opacity={0.4}
          />
        );

      case "freehand":
        return (
          <Line
            points={currentDrawing.flatMap((p) => [p.x, p.y])}
            stroke={color}
            strokeWidth={width}
            lineCap="round"
            lineJoin="round"
            opacity={opacity}
          />
        );

      case "line": {
        if (currentDrawing.length < 2) return null;
        const start = currentDrawing[0];
        const end = currentDrawing[currentDrawing.length - 1];
        return (
          <Line
            points={[start.x, start.y, end.x, end.y]}
            stroke={color}
            strokeWidth={width}
            lineCap="round"
            opacity={opacity}
          />
        );
      }

      case "rect": {
        if (currentDrawing.length < 2) return null;
        const start = currentDrawing[0];
        const end = currentDrawing[currentDrawing.length - 1];
        const x1 = Math.min(start.x, end.x);
        const y1 = Math.min(start.y, end.y);
        const x2 = Math.max(start.x, end.x);
        const y2 = Math.max(start.y, end.y);
        return (
          <Rect
            x={x1}
            y={y1}
            width={x2 - x1}
            height={y2 - y1}
            fill={currentFilled ? color : undefined}
            stroke={color}
            strokeWidth={width}
            opacity={opacity}
          />
        );
      }

      case "circle": {
        if (currentDrawing.length < 2) return null;
        const start = currentDrawing[0];
        const end = currentDrawing[currentDrawing.length - 1];
        const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
        return (
          <Circle
            x={start.x}
            y={start.y}
            radius={radius}
            fill={currentFilled ? color : undefined}
            stroke={color}
            strokeWidth={width}
            opacity={opacity}
          />
        );
      }

      default:
        return null;
    }
  };

  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale}>
      {drawingObjects.map((object) => renderDrawingObject(object))}
      {renderCurrentDrawing()}
    </Group>
  );
});
