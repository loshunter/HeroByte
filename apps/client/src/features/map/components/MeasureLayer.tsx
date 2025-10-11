// ============================================================================
// MEASURE LAYER COMPONENT
// ============================================================================
// Renders distance measurement tool with line and distance label

import { Group, Line, Circle, Text } from "react-konva";
import type { Camera } from "../types";

interface MeasureLayerProps {
  cam: Camera;
  measureStart: { x: number; y: number } | null;
  measureEnd: { x: number; y: number } | null;
  gridSize: number;
  gridSquareSize?: number; // Feet per square (default: 5)
}

/**
 * MeasureLayer: Renders distance measurement tool
 * Shows line between two points with distance in grid squares and feet
 */
export function MeasureLayer({
  cam,
  measureStart,
  measureEnd,
  gridSize,
  gridSquareSize = 5,
}: MeasureLayerProps) {
  if (!measureStart || !measureEnd) return null;

  const distance = Math.sqrt(
    Math.pow(measureEnd.x - measureStart.x, 2) + Math.pow(measureEnd.y - measureStart.y, 2),
  );
  const squares = Math.round((distance / gridSize) * 10) / 10;
  const feet = Math.round(squares * gridSquareSize * 10) / 10;

  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale}>
      <Line
        points={[measureStart.x, measureStart.y, measureEnd.x, measureEnd.y]}
        stroke="#ff0"
        strokeWidth={2 / cam.scale}
        dash={[5 / cam.scale, 5 / cam.scale]}
      />
      <Circle x={measureStart.x} y={measureStart.y} radius={4 / cam.scale} fill="#ff0" />
      <Circle x={measureEnd.x} y={measureEnd.y} radius={4 / cam.scale} fill="#ff0" />
      <Text
        x={(measureStart.x + measureEnd.x) / 2}
        y={(measureStart.y + measureEnd.y) / 2 - 10}
        text={`${squares} Squares (${feet} ft)`}
        fill="#ff0"
        fontSize={14 / cam.scale}
        fontStyle="bold"
        align="center"
        offsetX={50}
      />
    </Group>
  );
}
