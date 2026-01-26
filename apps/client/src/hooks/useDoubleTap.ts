/**
 * useDoubleTap Hook
 *
 * Provides logic for manually detecting double taps/clicks on Konva stages.
 * Useful for environments (like mobile/touch) where native double-click might
 * be unreliable or needs unified handling across pointer types.
 */

import { useCallback, useRef } from "react";
import type { KonvaEventObject } from "konva/lib/Node";

/**
 * Props for useDoubleTap hook
 */
export interface UseDoubleTapProps {
  /** Callback to fire when a valid double tap is detected */
  onDoubleTap?: (event: KonvaEventObject<MouseEvent | PointerEvent | TouchEvent>) => void;
}

/**
 * Hook for detecting double taps on a Konva stage.
 *
 * @param props - Configuration props
 * @returns detectDoubleTap - Function to call on click/tap events. Returns true if double tap handled.
 */
export function useDoubleTap({ onDoubleTap }: UseDoubleTapProps) {
  // State for manual double tap/click detection
  const lastTapRef = useRef<{ x: number; y: number; time: number } | null>(null);

  /**
   * Manual double tap detection logic
   * Returns true if a double tap was detected and handled
   */
  const detectDoubleTap = useCallback(
    (event: KonvaEventObject<MouseEvent | PointerEvent | TouchEvent>) => {
      // If no handler provided, no need to detect
      if (!onDoubleTap) return false;

      // Defensive checks for tests and edge cases
      if (!event.target || typeof event.target.getStage !== "function") return false;
      const stage = event.target.getStage();
      if (!stage || typeof stage.getPointerPosition !== "function") return false;

      const pointer = stage.getPointerPosition();
      if (!pointer) return false;

      // Ignore multi-touch events for double tap detection
      if (
        "evt" in event &&
        "touches" in event.evt &&
        (event.evt as TouchEvent).touches.length > 1
      ) {
        lastTapRef.current = null;
        return false;
      }

      const now = Date.now();
      const lastTap = lastTapRef.current;

      if (lastTap) {
        const timeDiff = now - lastTap.time;
        const dist = Math.sqrt(
          Math.pow(pointer.x - lastTap.x, 2) + Math.pow(pointer.y - lastTap.y, 2),
        );

        // Strict thresholds for intentional double tap:
        // - Time: 50ms - 350ms
        // - Distance: < 20 pixels
        if (timeDiff > 50 && timeDiff < 350 && dist < 20) {
          onDoubleTap(event);
          lastTapRef.current = null; // Clear to prevent triple-tap
          return true;
        }
      }

      lastTapRef.current = { x: pointer.x, y: pointer.y, time: now };
      return false;
    },
    [onDoubleTap],
  );

  return detectDoubleTap;
}
