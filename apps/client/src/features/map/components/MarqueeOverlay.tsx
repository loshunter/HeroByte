/**
 * MarqueeOverlay Component
 *
 * Renders the marquee selection rectangle on the map canvas.
 * Shows a dashed teal rectangle during multi-select drag operations.
 *
 * Features:
 * - Teal dashed rectangle (#4de5c0)
 * - Semi-transparent fill
 * - Non-interactive (listening={false})
 * - Fixed styling (not camera-aware)
 *
 * Extracted from: MapBoard.tsx:729-742
 */

import { Layer, Rect } from "react-konva";
import type { MarqueeRect } from "../../../hooks/useMarqueeSelection";

export interface MarqueeOverlayProps {
  /** Marquee selection rectangle (null when not active) */
  marqueeRect: MarqueeRect | null;
}

/**
 * MarqueeOverlay renders the multi-select marquee rectangle.
 *
 * Only renders when marqueeRect exists (during active marquee selection).
 * Uses fixed styling (not camera-aware) since it's drawn in screen space.
 */
export function MarqueeOverlay({ marqueeRect }: MarqueeOverlayProps) {
  // Don't render if no marquee is active
  if (!marqueeRect) {
    return null;
  }

  return (
    <Layer listening={false}>
      <Rect
        x={marqueeRect.x}
        y={marqueeRect.y}
        width={marqueeRect.width}
        height={marqueeRect.height}
        stroke="#4de5c0"
        dash={[8, 4]}
        strokeWidth={1.5}
        fill="rgba(77, 229, 192, 0.15)"
      />
    </Layer>
  );
}
