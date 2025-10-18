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
  selectedDrawingId: string | null;
  onSelectDrawing: (drawingId: string | null) => void;
  onTransformDrawing: (sceneId: string, transform: { position?: { x: number; y: number } }) => void;
  selectedObjectId?: string | null;
  onSelectObject?: (objectId: string | null) => void;
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
  selectedDrawingId,
  onSelectDrawing,
  onTransformDrawing,
  selectedObjectId,
  onSelectObject,
  onDrawingNodeReady,
}: DrawingsLayerProps) {
  const localOverrides = useRef<Record<string, TransformOverride>>({});
  const [, forceRerender] = useState(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);

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
  };

  const handleDragEnd = (sceneId: string, event: KonvaEventObject<DragEvent>) => {
    const node = event.target as Konva.Node;
    const position = node.position();
    const nextOverride: TransformOverride = {
      x: position.x,
      y: position.y,
    };
    localOverrides.current[sceneId] = nextOverride;
    forceRerender((value) => value + 1);
    onTransformDrawing(sceneId, { position: { x: position.x, y: position.y } });
    setDraggingId(null);
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
      (selectedObjectId && selectedObjectId === sceneObject.id) || selectedDrawingId === drawing.id;
    const isOwner = drawing.owner === uid;
    const canInteract = selectMode && isOwner;
    const isDragging = draggingId === sceneObject.id;

    const interactiveProps = canInteract
      ? {
          onClick: (event: KonvaEventObject<MouseEvent>) => {
            event.cancelBubble = true;
            // Use unified onSelectObject if available, otherwise fall back
            if (onSelectObject) {
              onSelectObject(sceneObject.id);
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
      canInteract && isSelected
        ? {
            onDragStart: () => handleDragStart(sceneObject.id),
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
            draggable={canInteract && isSelected}
            {...groupHandlers}
            ref={
              onDrawingNodeReady ? (node) => onDrawingNodeReady(sceneObject.id, node) : undefined
            }
          >
            {canInteract && (
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
            {isSelected && canInteract && (
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
            draggable={canInteract && isSelected}
            {...groupHandlers}
            ref={
              onDrawingNodeReady ? (node) => onDrawingNodeReady(sceneObject.id, node) : undefined
            }
          >
            {canInteract && (
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
            {isSelected && canInteract && (
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
            draggable={canInteract && isSelected}
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
            {isSelected && canInteract && (
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
            draggable={canInteract && isSelected}
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
            {isSelected && canInteract && (
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
