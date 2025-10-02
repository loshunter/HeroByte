// ============================================================================
// USE DRAWING STATE HOOK
// ============================================================================
// Manages drawing tool state (tool type, color, width, opacity, fill)

import { useState } from "react";

interface UseDrawingStateReturn {
  drawTool: "freehand" | "line" | "rect" | "circle" | "eraser";
  drawColor: string;
  drawWidth: number;
  drawOpacity: number;
  drawFilled: boolean;
  setDrawTool: (tool: "freehand" | "line" | "rect" | "circle" | "eraser") => void;
  setDrawColor: (color: string) => void;
  setDrawWidth: (width: number) => void;
  setDrawOpacity: (opacity: number) => void;
  setDrawFilled: (filled: boolean) => void;
}

/**
 * Hook to manage drawing tool state
 *
 * Encapsulates all drawing-related state management:
 * - Tool selection (freehand, line, rect, circle, eraser)
 * - Color selection
 * - Brush width
 * - Opacity
 * - Fill toggle for shapes
 *
 * Example usage:
 * ```tsx
 * const {
 *   drawTool, drawColor, drawWidth, drawOpacity, drawFilled,
 *   setDrawTool, setDrawColor, setDrawWidth, setDrawOpacity, setDrawFilled
 * } = useDrawingState();
 * ```
 */
export function useDrawingState(): UseDrawingStateReturn {
  const [drawTool, setDrawTool] = useState<"freehand" | "line" | "rect" | "circle" | "eraser">("freehand");
  const [drawColor, setDrawColor] = useState("#ffffff");
  const [drawWidth, setDrawWidth] = useState(3);
  const [drawOpacity, setDrawOpacity] = useState(1);
  const [drawFilled, setDrawFilled] = useState(false);

  return {
    drawTool,
    drawColor,
    drawWidth,
    drawOpacity,
    drawFilled,
    setDrawTool,
    setDrawColor,
    setDrawWidth,
    setDrawOpacity,
    setDrawFilled,
  };
}
