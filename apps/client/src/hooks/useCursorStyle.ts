import { useMemo } from "react";

export type CursorStyleOptions = {
  isPanning: boolean;
  pointerMode: boolean;
  measureMode: boolean;
  drawMode: boolean;
  selectMode: boolean;
};

/**
 * Determines the cursor style for the Konva stage based on current interaction modes.
 * The precedence matches the inline logic previously implemented within `MapBoard.tsx`.
 *
 * @param options - Flags describing the current interaction modes.
 * @returns The CSS cursor name that should be applied to the stage.
 *
 * @example
 * ```tsx
 * const cursor = useCursorStyle({ isPanning, pointerMode, measureMode, drawMode, selectMode });
 * <Stage style={{ cursor }} />
 * ```
 */
export function useCursorStyle(options: CursorStyleOptions): string {
  const { isPanning, pointerMode, measureMode, drawMode, selectMode } = options;

  return useMemo(() => {
    if (isPanning) return "grabbing";
    if (pointerMode) return "none";
    if (measureMode) return "crosshair";
    if (drawMode) return "crosshair";
    if (selectMode) return "default";
    return "grab";
  }, [isPanning, pointerMode, measureMode, drawMode, selectMode]);
}
