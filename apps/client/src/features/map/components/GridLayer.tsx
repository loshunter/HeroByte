// ============================================================================
// GRID LAYER COMPONENT
// ============================================================================
// Renders an infinite procedural grid with major/minor line highlighting

import { memo } from "react";
import { Group, Line } from "react-konva";
import type { Camera } from "../../../hooks/useCamera";

interface GridLayerProps {
  cam: Camera;
  viewport: { w: number; h: number };
  gridSize?: number;
  color?: string;
  majorEvery?: number;
  opacity?: number;
}

/**
 * GridLayer: Renders an infinite procedural grid
 * - Only renders visible grid lines based on camera position
 * - Highlights major grid lines every N steps
 * - Scales line thickness based on zoom level
 *
 * Optimized with React.memo to prevent unnecessary re-renders
 */
export const GridLayer = memo(function GridLayer({
  cam,
  viewport,
  gridSize = 50,
  color = "#447DF7",
  majorEvery = 5,
  opacity = 0.15,
}: GridLayerProps) {
  // Convert viewport bounds to world coordinates
  const minX = (-cam.x) / cam.scale;
  const minY = (-cam.y) / cam.scale;
  const maxX = (viewport.w - cam.x) / cam.scale;
  const maxY = (viewport.h - cam.y) / cam.scale;

  // Calculate which grid lines are visible
  const step = gridSize;
  const startX = Math.floor(minX / step) * step;
  const startY = Math.floor(minY / step) * step;

  const lines: JSX.Element[] = [];

  // Generate vertical grid lines with subtle glow
  for (let x = startX; x <= maxX; x += step) {
    const isMajor = Math.round(x / step) % majorEvery === 0;
    lines.push(
      <Line
        key={`vx-${x}`}
        points={[x, minY, x, maxY]}
        stroke={color}
        opacity={isMajor ? opacity * 2 : opacity}
        strokeWidth={isMajor ? 2 / cam.scale : 1.5 / cam.scale}
        listening={false}
        shadowColor={color}
        shadowBlur={isMajor ? 3 : 1.5}
        shadowOpacity={isMajor ? 0.4 : 0.2}
      />
    );
  }

  // Generate horizontal grid lines with subtle glow
  for (let y = startY; y <= maxY; y += step) {
    const isMajor = Math.round(y / step) % majorEvery === 0;
    lines.push(
      <Line
        key={`hy-${y}`}
        points={[minX, y, maxX, y]}
        stroke={color}
        opacity={isMajor ? opacity * 2 : opacity}
        strokeWidth={isMajor ? 2 / cam.scale : 1.5 / cam.scale}
        listening={false}
        shadowColor={color}
        shadowBlur={isMajor ? 3 : 1.5}
        shadowOpacity={isMajor ? 0.4 : 0.2}
      />
    );
  }

  // Apply camera transformation
  return (
    <Group
      x={cam.x}
      y={cam.y}
      scaleX={cam.scale}
      scaleY={cam.scale}
      listening={false}
    >
      {lines}
    </Group>
  );
});
