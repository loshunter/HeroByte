/**
 * Drawing State Manager
 *
 * Manages all drawing-related state, rendering, and keyboard shortcuts.
 * Coordinates between the drawing toolbar UI, MapBoard drawing props,
 * and network synchronization.
 *
 * Extracted from: apps/client/src/ui/App.tsx (lines 142-159, 447-450, 796-813, 840-865, 921-928)
 * Extraction date: 2025-10-20
 *
 * Part of Phase 15 SOLID Refactor Initiative - Phase 3, Priority 15
 *
 * @module hooks/useDrawingStateManager
 */

import { useCallback, useMemo } from "react";
import type { ClientMessage, DrawTool } from "@herobyte/shared";
import type { ToolMode } from "../components/layout/Header";
import { useDrawingState } from "./useDrawingState";

/**
 * Options for the drawing state manager
 */
export interface UseDrawingStateManagerOptions {
  /**
   * Function to send messages to the server
   */
  sendMessage: (message: ClientMessage) => void;

  /**
   * Whether draw mode is currently active
   * Controls toolbar visibility and keyboard shortcut availability
   */
  drawMode: boolean;

  /**
   * Function to change the active tool mode
   * Used to exit draw mode when toolbar is closed
   */
  setActiveTool: (tool: ToolMode) => void;

  /**
   * Whether this client may clear all drawings — i.e. whether it is the DM.
   *
   * `clear-drawings` is DM-only server-side (DrawingMessageHandler rejects
   * non-DMs), so without this the Clear All button was a control that did
   * nothing visible while still destroying the clicking player's own local
   * undo history. Defaults to false: no capability unless proven.
   */
  canClearDrawings?: boolean;
}

/**
 * Drawing tool type
 */
/** Re-export: the union now lives in @herobyte/shared (see DrawTool there). */
export type { DrawTool };

/**
 * Return type for the drawing state manager
 */
export interface UseDrawingStateManagerReturn {
  /**
   * Props to spread onto DrawingToolbar component
   */
  toolbarProps: {
    drawTool: DrawTool;
    drawColor: string;
    drawWidth: number;
    drawOpacity: number;
    drawFilled: boolean;
    canUndo: boolean;
    canRedo: boolean;
    onToolChange: (tool: DrawTool) => void;
    onColorChange: (color: string) => void;
    onWidthChange: (width: number) => void;
    onOpacityChange: (opacity: number) => void;
    onFilledChange: (filled: boolean) => void;
    onUndo: () => void;
    onRedo: () => void;
    onClearAll: () => void;
    onClose: () => void;
  };

  /**
   * Props to spread onto MapBoard for drawing functionality
   */
  drawingProps: {
    drawTool: DrawTool;
    drawColor: string;
    drawWidth: number;
    drawOpacity: number;
    drawFilled: boolean;
    onDrawingComplete: (id: string) => void;
  };

  /**
   * Handle undo operation (keyboard shortcut or toolbar button)
   * Sends network message and updates local history
   */
  handleUndo: () => void;

  /**
   * Handle redo operation (keyboard shortcut or toolbar button)
   * Sends network message and updates local history
   */
  handleRedo: () => void;

  /**
   * Clear all drawings
   * Sends network message and clears local history
   */
  handleClearDrawings: () => void;

  /**
   * Whether undo is available (history has items)
   */
  canUndo: boolean;

  /**
   * Whether redo is available (redo history has items)
   */
  canRedo: boolean;
}

/**
 * Hook to manage drawing state, toolbar rendering, and keyboard shortcuts
 *
 * This hook coordinates:
 * - Drawing tool state (tool type, color, width, opacity, fill)
 * - Drawing history (undo/redo stacks)
 * - Toolbar rendering (conditionally based on drawMode)
 * - Keyboard shortcuts (undo/redo)
 * - Network synchronization (sending drawing commands to server)
 *
 * @example
 * ```tsx
 * const drawingManager = useDrawingStateManager({
 *   sendMessage,
 *   drawMode: activeTool === 'draw',
 *   setActiveTool,
 * });
 *
 * // In render:
 * {drawMode && <DrawingToolbar {...drawingManager.toolbarProps} />}
 *
 * // In MapBoard:
 * <MapBoard {...drawingManager.drawingProps} />
 *
 * // In keyboard listener:
 * if (e.key === 'z' && e.ctrlKey && drawMode) {
 *   drawingManager.handleUndo();
 * }
 * ```
 */
export function useDrawingStateManager({
  sendMessage,
  drawMode: _drawMode,
  setActiveTool,
  canClearDrawings = false,
}: UseDrawingStateManagerOptions): UseDrawingStateManagerReturn {
  // Core drawing state from existing hook
  const {
    drawTool,
    drawColor,
    drawWidth,
    drawOpacity,
    drawFilled,
    canUndo,
    canRedo,
    setDrawTool,
    setDrawColor,
    setDrawWidth,
    setDrawOpacity,
    setDrawFilled,
    addToHistory,
    popFromHistory,
    popFromRedoHistory,
    clearHistory,
  } = useDrawingState();

  /**
   * Handle undo operation
   * Pops from history and sends network message
   * Called by keyboard shortcut (Ctrl+Z) or toolbar button
   */
  const handleUndo = useCallback(() => {
    popFromHistory();
    sendMessage({ t: "undo-drawing" });
  }, [popFromHistory, sendMessage]);

  /**
   * Handle redo operation
   * Pops from redo history and sends network message
   * Called by keyboard shortcut (Ctrl+Y) or toolbar button
   */
  const handleRedo = useCallback(() => {
    popFromRedoHistory();
    sendMessage({ t: "redo-drawing" });
  }, [popFromRedoHistory, sendMessage]);

  /**
   * Clear all drawings
   * Clears local history and sends network message
   * Called by toolbar "Clear All" button or DM menu
   */
  /**
   * Clear every drawing on the map.
   *
   * The guard lives HERE, not at the call sites, so both entry points inherit
   * it — the drawing toolbar's "Clear All" used to fire instantly while the
   * DM menu's "Clear All Drawings" confirmed, for the identical operation.
   *
   * It is also unrecoverable by construction: the server drops `drawings`,
   * `drawingUndoStacks` and `drawingRedoStacks` together, so there is nothing
   * left to undo from. Hence a confirm rather than a trust-the-undo-stack.
   */
  const handleClearDrawings = useCallback(() => {
    // A non-DM's clear is rejected server-side; don't destroy their local
    // history for a call that will not apply.
    if (!canClearDrawings) return;
    if (!window.confirm("Clear all drawings from the map? This cannot be undone.")) return;

    clearHistory();
    sendMessage({ t: "clear-drawings" });
  }, [canClearDrawings, clearHistory, sendMessage]);

  /**
   * Callback to close the toolbar
   * Sets active tool to null to exit draw mode
   */
  const handleClose = useCallback(() => {
    setActiveTool(null);
  }, [setActiveTool]);

  /**
   * Props for the DrawingToolbar component
   * Memoized to prevent unnecessary re-renders
   */
  const toolbarProps = useMemo(
    () => ({
      drawTool,
      drawColor,
      drawWidth,
      drawOpacity,
      drawFilled,
      canUndo,
      canRedo,
      onToolChange: setDrawTool,
      onColorChange: setDrawColor,
      onWidthChange: setDrawWidth,
      onOpacityChange: setDrawOpacity,
      onFilledChange: setDrawFilled,
      onUndo: handleUndo,
      onRedo: handleRedo,
      onClearAll: handleClearDrawings,
      onClose: handleClose,
    }),
    [
      drawTool,
      drawColor,
      drawWidth,
      drawOpacity,
      drawFilled,
      canUndo,
      canRedo,
      setDrawTool,
      setDrawColor,
      setDrawWidth,
      setDrawOpacity,
      setDrawFilled,
      handleUndo,
      handleRedo,
      handleClearDrawings,
      handleClose,
    ],
  );

  /**
   * Drawing props for MapBoard
   * Memoized to prevent unnecessary re-renders
   */
  const drawingProps = useMemo(
    () => ({
      drawTool,
      drawColor,
      drawWidth,
      drawOpacity,
      drawFilled,
      onDrawingComplete: addToHistory,
    }),
    [drawTool, drawColor, drawWidth, drawOpacity, drawFilled, addToHistory],
  );

  return {
    toolbarProps,
    drawingProps,
    handleUndo,
    handleRedo,
    handleClearDrawings,
    canUndo,
    canRedo,
  };
}
