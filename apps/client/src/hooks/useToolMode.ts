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

import { useState, useCallback, useRef } from "react";
import type { RoomSnapshot } from "@herobyte/shared";
import { escapeRegistry, useEscapeOwner } from "../features/interaction/useEscapeOwner";
import { useToolContextTransitions } from "../features/interaction/useToolContextTransitions";
import { dismissalFocus } from "../features/interaction/dismissalFocus";
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

  /**
   * True if live map-edit mode (on-table authoring) is active
   */
  mapEditMode: boolean;
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
export interface ToolContext {
  snapshot: RoomSnapshot | null;
  uid: string;
  isDM: boolean;
}

export function useToolMode(context?: ToolContext): UseToolModeReturn {
  const [activeTool, commitTool] = useState<ToolMode>(null);
  const currentTool = useRef<ToolMode>(null);
  const changingTool = useRef(false);
  const setActiveTool = useCallback((next: ToolMode) => {
    if (changingTool.current || next === currentTool.current) return;
    dismissalFocus.invalidate();
    currentTool.current = next;
    changingTool.current = true;
    try {
      // Cancel unsent work before changing modes. Atlas cancellation can call
      // this setter recursively; the outer explicit choice remains authoritative.
      escapeRegistry.cancelForTransition();
    } finally {
      changingTool.current = false;
      commitTool(next);
      escapeRegistry.refresh();
    }
  }, []);
  useToolContextTransitions(context, setActiveTool);
  useEscapeOwner(() => ({
    kind: "tool",
    name: "active play tool",
    order: 0,
    active: currentTool.current !== null,
    handle: () => setActiveTool(null),
  }));

  // Derived boolean flags for each tool mode
  const pointerMode = activeTool === "pointer";
  const measureMode = activeTool === "measure";
  const drawMode = activeTool === "draw";
  const transformMode = activeTool === "transform";
  const selectMode = activeTool === "select";
  const alignmentMode = activeTool === "align";
  const mapEditMode = activeTool === "map-edit";

  return {
    activeTool,
    setActiveTool,
    pointerMode,
    measureMode,
    drawMode,
    transformMode,
    selectMode,
    alignmentMode,
    mapEditMode,
  };
}
