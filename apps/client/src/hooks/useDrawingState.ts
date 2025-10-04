// ============================================================================
// USE DRAWING STATE HOOK
// ============================================================================
// Manages drawing tool state (tool type, color, width, opacity, fill)
// and undo history for drawings

import { useState, useCallback } from "react";

interface UseDrawingStateReturn {
  drawTool: "freehand" | "line" | "rect" | "circle" | "eraser";
  drawColor: string;
  drawWidth: number;
  drawOpacity: number;
  drawFilled: boolean;
  drawingHistory: string[];
  canUndo: boolean;
  canRedo: boolean;
  setDrawTool: (tool: "freehand" | "line" | "rect" | "circle" | "eraser") => void;
  setDrawColor: (color: string) => void;
  setDrawWidth: (width: number) => void;
  setDrawOpacity: (opacity: number) => void;
  setDrawFilled: (filled: boolean) => void;
  addToHistory: (drawingId: string) => void;
  popFromHistory: () => string | undefined;
  popFromRedoHistory: () => string | undefined;
  clearHistory: () => void;
}

/**
 * Hook to manage drawing tool state and undo history
 *
 * Encapsulates all drawing-related state management:
 * - Tool selection (freehand, line, rect, circle, eraser)
 * - Color selection
 * - Brush width
 * - Opacity
 * - Fill toggle for shapes
 * - Undo history stack (per player)
 *
 * Example usage:
 * ```tsx
 * const {
 *   drawTool, drawColor, drawWidth, drawOpacity, drawFilled,
 *   drawingHistory, canUndo,
 *   setDrawTool, setDrawColor, setDrawWidth, setDrawOpacity, setDrawFilled,
 *   addToHistory, popFromHistory, clearHistory
 * } = useDrawingState();
 * ```
 */
export function useDrawingState(): UseDrawingStateReturn {
  const [drawTool, setDrawTool] = useState<"freehand" | "line" | "rect" | "circle" | "eraser">(
    "freehand",
  );
  const [drawColor, setDrawColor] = useState("#ffffff");
  const [drawWidth, setDrawWidth] = useState(3);
  const [drawOpacity, setDrawOpacity] = useState(1);
  const [drawFilled, setDrawFilled] = useState(false);

  // Undo history stack - stores drawing IDs in order of creation
  const [drawingHistory, setDrawingHistory] = useState<string[]>([]);
  const [redoHistory, setRedoHistory] = useState<string[]>([]);

  /**
   * Add a drawing ID to the history stack
   * Called after a drawing is completed and sent to server
   */
  const addToHistory = useCallback((drawingId: string) => {
    setDrawingHistory((prev) => [...prev, drawingId]);
    setRedoHistory([]);
  }, []);

  /**
   * Remove and return the most recent drawing ID from history
   * Used when performing an undo operation
   */
  const popFromHistory = useCallback((): string | undefined => {
    let poppedId: string | undefined;
    setDrawingHistory((prev) => {
      if (prev.length === 0) return prev;
      poppedId = prev[prev.length - 1];
      return prev.slice(0, -1);
    });
    if (poppedId !== undefined) {
      setRedoHistory((prev) => [...prev, poppedId!]);
    }
    return poppedId;
  }, []);

  /**
   * Restore from redo stack back into history
   */
  const popFromRedoHistory = useCallback((): string | undefined => {
    let redoId: string | undefined;
    setRedoHistory((prev) => {
      if (prev.length === 0) return prev;
      redoId = prev[prev.length - 1];
      return prev.slice(0, -1);
    });
    if (redoId !== undefined) {
      setDrawingHistory((prev) => [...prev, redoId!]);
    }
    return redoId;
  }, []);

  /**
   * Clear the entire drawing history
   * Called when all drawings are cleared
   */
  const clearHistory = useCallback(() => {
    setDrawingHistory([]);
    setRedoHistory([]);
  }, []);

  return {
    drawTool,
    drawColor,
    drawWidth,
    drawOpacity,
    drawFilled,
    drawingHistory,
    canUndo: drawingHistory.length > 0,
    canRedo: redoHistory.length > 0,
    setDrawTool,
    setDrawColor,
    setDrawWidth,
    setDrawOpacity,
    setDrawFilled,
    addToHistory,
    popFromHistory,
    popFromRedoHistory,
    clearHistory,
  };
}
