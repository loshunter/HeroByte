/**
 * AlignmentOverlay Component
 *
 * Renders the alignment mode visualization on the map canvas.
 * Displays preview points, preview lines, and suggestion lines during
 * the map alignment process.
 *
 * Features:
 * - Preview points with numbered circles (yellow)
 * - Preview line connecting alignment points (dashed yellow)
 * - Suggestion line showing recommended alignment (dashed teal)
 * - Camera-aware scaling (all visual elements scale inversely with zoom)
 * - Non-interactive (listening={false} on all elements)
 *
 * Extracted from: MapBoard.tsx:685-726
 */

import { Circle, Group, Line, Text } from "react-konva";
import type { AlignmentPoint } from "../../../types/alignment";

export interface AlignmentOverlayProps {
  /** Whether alignment mode is active */
  alignmentMode: boolean;
  /** Preview points to display (up to 2 points) */
  alignmentPreviewPoints: AlignmentPoint[];
  /** Preview line connecting alignment points (4 numbers: x1, y1, x2, y2) */
  alignmentPreviewLine: number[] | null;
  /** Suggestion line showing recommended alignment (4 numbers: x1, y1, x2, y2) */
  alignmentSuggestionLine: number[] | null;
  /** Camera state for positioning and scaling */
  cam: { x: number; y: number; scale: number };
}

/**
 * AlignmentOverlay renders the alignment visualization.
 *
 * Only renders when alignment mode is active and preview points exist.
 * All visual elements are non-interactive and scale inversely with camera zoom
 * to maintain consistent visual appearance.
 */
export function AlignmentOverlay({
  alignmentMode,
  alignmentPreviewPoints,
  alignmentPreviewLine,
  alignmentSuggestionLine,
  cam,
}: AlignmentOverlayProps) {
  // Don't render if alignment mode is off or no points exist
  if (!alignmentMode || alignmentPreviewPoints.length === 0) {
    return null;
  }

  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale} listening={false}>
      {/* Preview Points with Numbers */}
      {alignmentPreviewPoints.map((point, index) => (
        <Group key={`align-point-${index}`}>
          <Circle
            x={point.world.x}
            y={point.world.y}
            radius={8 / cam.scale}
            stroke="#facc15"
            strokeWidth={2 / cam.scale}
            fill="rgba(250, 204, 21, 0.2)"
          />
          <Text
            text={`${index + 1}`}
            x={point.world.x + 6 / cam.scale}
            y={point.world.y - 18 / cam.scale}
            fontSize={12 / cam.scale}
            fill="#facc15"
            listening={false}
          />
        </Group>
      ))}

      {/* Preview Line (yellow dashed) */}
      {alignmentPreviewLine && (
        <Line
          points={alignmentPreviewLine}
          stroke="#facc15"
          strokeWidth={2 / cam.scale}
          dash={[8 / cam.scale, 6 / cam.scale]}
          listening={false}
        />
      )}

      {/* Suggestion Line (teal dashed) */}
      {alignmentSuggestionLine && (
        <Line
          points={alignmentSuggestionLine}
          stroke="#4de5c0"
          strokeWidth={2 / cam.scale}
          dash={[4 / cam.scale, 6 / cam.scale]}
          listening={false}
        />
      )}
    </Group>
  );
}
