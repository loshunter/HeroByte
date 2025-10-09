// ============================================================================
// LOCK INDICATOR COMPONENT
// ============================================================================
// Visual indicator showing that a scene object is locked.
// Renders a lock icon overlay on the Konva canvas.

import { Group, Circle, Rect, Line } from "react-konva";

interface LockIndicatorProps {
  x: number;
  y: number;
  size?: number;
}

/**
 * LockIndicator: Visual lock icon for scene objects
 *
 * Features:
 * - Simple lock icon design
 * - Semi-transparent background
 * - Positioned at object location
 */
export function LockIndicator({ x, y, size = 20 }: LockIndicatorProps): JSX.Element {
  const lockBodyWidth = size * 0.6;
  const lockBodyHeight = size * 0.5;
  const lockShackleRadius = size * 0.25;

  return (
    <Group x={x} y={y}>
      {/* Background circle */}
      <Circle
        x={0}
        y={0}
        radius={size / 2}
        fill="rgba(0, 0, 0, 0.7)"
        stroke="#FFD700"
        strokeWidth={1}
      />

      {/* Lock shackle (top arc) */}
      <Line
        points={[
          -lockShackleRadius,
          -2,
          -lockShackleRadius,
          -lockShackleRadius - 2,
          lockShackleRadius,
          -lockShackleRadius - 2,
          lockShackleRadius,
          -2,
        ]}
        stroke="#FFD700"
        strokeWidth={2}
        lineCap="round"
        lineJoin="round"
        closed={false}
      />

      {/* Lock body */}
      <Rect
        x={-lockBodyWidth / 2}
        y={-2}
        width={lockBodyWidth}
        height={lockBodyHeight}
        fill="#FFD700"
        cornerRadius={2}
      />

      {/* Keyhole */}
      <Circle x={0} y={lockBodyHeight / 4 - 2} radius={2} fill="rgba(0, 0, 0, 0.8)" />
      <Rect
        x={-1}
        y={lockBodyHeight / 4 - 2}
        width={2}
        height={lockBodyHeight / 3}
        fill="rgba(0, 0, 0, 0.8)"
      />
    </Group>
  );
}
