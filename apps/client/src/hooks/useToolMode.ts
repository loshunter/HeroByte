/**
 * useToolMode
 *
 * Manages the active tool mode state and provides derived boolean flags for each tool type.
 * Handles keyboard shortcuts (Escape key) to deactivate the current tool.
 *
 * Extracted from: apps/client/src/ui/App.tsx (lines 463-469, 1209-1222)
 * Extraction date: 2025-10-20
 *
 * @module hooks/useToolMode
 */

import { useState, useEffect } from "react";
import type { ToolMode } from "../components/layout/Header";

/**
 * Return value from useToolMode hook
 */
export interface UseToolModeReturn {
  /**
   * The currently active tool mode, or null if no tool is active
   */
  activeTool: ToolMode;

  /**
   * Function to set the active tool mode
   * @param tool - The tool mode to activate, or null to deactivate all tools
   */
  setActiveTool: (tool: ToolMode) => void;

  /**
   * True if pointer tool is active
   * @example
   * ```tsx
   * if (pointerMode) {
   *   // Handle pointer tool interactions
   * }
   * ```
   */
  pointerMode: boolean;

  /**
   * True if measure tool is active
   */
  measureMode: boolean;

  /**
   * True if draw tool is active
   */
  drawMode: boolean;

  /**
   * True if transform tool is active
   */
  transformMode: boolean;

  /**
   * True if select tool is active
   */
  selectMode: boolean;

  /**
   * True if alignment tool is active
   */
  alignmentMode: boolean;
}

/**
 * Hook to manage tool mode state and keyboard shortcuts
 *
 * Provides:
 * - Active tool state management
 * - Derived boolean flags for each tool type
 * - Escape key handling to clear active tool
 *
 * @returns {UseToolModeReturn} Tool mode state and setters
 *
 * @example
 * ```tsx
 * const {
 *   activeTool,
 *   setActiveTool,
 *   pointerMode,
 *   measureMode,
 *   drawMode,
 *   transformMode,
 *   selectMode,
 *   alignmentMode
 * } = useToolMode();
 *
 * // Activate a tool
 * setActiveTool("pointer");
 *
 * // Check if a specific tool is active
 * if (pointerMode) {
 *   // Pointer tool is active
 * }
 *
 * // Deactivate tool
 * setActiveTool(null);
 * ```
 *
 * @see {@link ToolMode} for available tool types
 */
export function useToolMode(): UseToolModeReturn {
  const [activeTool, setActiveTool] = useState<ToolMode>(null);

  // Derived boolean flags for each tool mode
  const pointerMode = activeTool === "pointer";
  const measureMode = activeTool === "measure";
  const drawMode = activeTool === "draw";
  const transformMode = activeTool === "transform";
  const selectMode = activeTool === "select";
  const alignmentMode = activeTool === "align";

  // Handle Escape key to clear active tool
  useEffect(() => {
    if (!activeTool) {
      return;
    }

    const handleToolEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveTool(null);
      }
    };

    window.addEventListener("keydown", handleToolEscape);
    return () => window.removeEventListener("keydown", handleToolEscape);
  }, [activeTool]);

  return {
    activeTool,
    setActiveTool,
    pointerMode,
    measureMode,
    drawMode,
    transformMode,
    selectMode,
    alignmentMode,
  };
}
