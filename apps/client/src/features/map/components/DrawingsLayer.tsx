// ============================================================================
// DRAWINGS LAYER COMPONENT
// ============================================================================
// Renders all drawings (freehand, lines, shapes) including current drawing

import { memo } from "react";
import { Group, Line, Rect, Circle } from "react-konva";
import type { Drawing } from "@shared";
import type { Camera } from "../types";

interface DrawingsLayerProps {
  cam: Camera;
  drawings: Drawing[];
  currentDrawing: { x: number; y: number }[];
  currentTool: "freehand" | "line" | "rect" | "circle" | "eraser";
  currentColor?: string;
  currentWidth?: number;
  currentOpacity?: number;
  currentFilled?: boolean;
}

/**
 * DrawingsLayer: Renders all drawings (freehand, lines, shapes)
 * Includes both completed drawings and current drawing in progress
 *
 * Optimized with React.memo to prevent unnecessary re-renders
 */
export const DrawingsLayer = memo(function DrawingsLayer({
  cam,
  drawings,
  currentDrawing,
  currentTool,
  currentColor,
  currentWidth,
  currentOpacity,
  currentFilled,
}: DrawingsLayerProps) {
  // Render a single completed drawing
  const renderDrawing = (drawing: Drawing) => {
    const points = drawing.points;

    if (drawing.type === "eraser") {
      return (
        <Line
          key={drawing.id}
          points={points.flatMap((p) => [p.x, p.y])}
          stroke="#0b0d12"
          strokeWidth={drawing.width / cam.scale}
          lineCap="round"
          lineJoin="round"
          globalCompositeOperation="destination-out"
        />
      );
    }

    if (drawing.type === "freehand") {
      return (
        <Line
          key={drawing.id}
          points={points.flatMap((p) => [p.x, p.y])}
          stroke={drawing.color}
          strokeWidth={drawing.width / cam.scale}
          lineCap="round"
          lineJoin="round"
          opacity={drawing.opacity}
        />
      );
    }

    if (drawing.type === "line" && points.length >= 2) {
      return (
        <Line
          key={drawing.id}
          points={[points[0].x, points[0].y, points[points.length - 1].x, points[points.length - 1].y]}
          stroke={drawing.color}
          strokeWidth={drawing.width / cam.scale}
          lineCap="round"
          opacity={drawing.opacity}
        />
      );
    }

    if (drawing.type === "rect" && points.length >= 2) {
      const x1 = Math.min(points[0].x, points[points.length - 1].x);
      const y1 = Math.min(points[0].y, points[points.length - 1].y);
      const x2 = Math.max(points[0].x, points[points.length - 1].x);
      const y2 = Math.max(points[0].y, points[points.length - 1].y);

      return (
        <Rect
          key={drawing.id}
          x={x1}
          y={y1}
          width={x2 - x1}
          height={y2 - y1}
          fill={drawing.filled ? drawing.color : undefined}
          stroke={drawing.color}
          strokeWidth={drawing.width / cam.scale}
          opacity={drawing.opacity}
        />
      );
    }

    if (drawing.type === "circle" && points.length >= 2) {
      const cx = points[0].x;
      const cy = points[0].y;
      const radius = Math.sqrt(
        Math.pow(points[points.length - 1].x - cx, 2) +
        Math.pow(points[points.length - 1].y - cy, 2)
      );

      return (
        <Circle
          key={drawing.id}
          x={cx}
          y={cy}
          radius={radius}
          fill={drawing.filled ? drawing.color : undefined}
          stroke={drawing.color}
          strokeWidth={drawing.width / cam.scale}
          opacity={drawing.opacity}
        />
      );
    }

    return null;
  };

  // Render the current drawing in progress
  const renderCurrentDrawing = () => {
    if (currentDrawing.length === 0) return null;

    const color = currentColor || "#fff";
    const width = (currentWidth || 3) / cam.scale;
    const opacity = currentOpacity || 0.7;

    if (currentTool === "eraser") {
      return (
        <Line
          points={currentDrawing.flatMap((p) => [p.x, p.y])}
          stroke="#0b0d12"
          strokeWidth={width}
          lineCap="round"
          lineJoin="round"
          opacity={0.5}
        />
      );
    }

    if (currentTool === "freehand") {
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
    }

    if (currentTool === "line" && currentDrawing.length >= 2) {
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

    if (currentTool === "rect" && currentDrawing.length >= 2) {
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

    if (currentTool === "circle" && currentDrawing.length >= 2) {
      const start = currentDrawing[0];
      const end = currentDrawing[currentDrawing.length - 1];
      const radius = Math.sqrt(
        Math.pow(end.x - start.x, 2) +
        Math.pow(end.y - start.y, 2)
      );

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

    return null;
  };

  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale}>
      {drawings.map((drawing) => renderDrawing(drawing))}
      {renderCurrentDrawing()}
    </Group>
  );
});
