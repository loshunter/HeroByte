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
import type { ClientMessage, DrawTool, DrawingHistoryCapabilities } from "@herobyte/shared";
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
   * Retained for existing callers; the layout owns draw-mode visibility.
   */
  drawMode?: boolean;

  /** Last server-projected capabilities for this connection's own UID. */
  drawingHistory?: DrawingHistoryCapabilities;

  /**
   * Function to change the active tool mode
   * Used to exit draw mode when toolbar is closed
   */
  setActiveTool: (tool: ToolMode) => void;

  /**
   * Whether this client may clear all drawings — i.e. whether it is the DM.
   *
   * The server rejects `clear-drawings` from non-DMs. Defaults to false:
   * only a confirmed capability exposes and dispatches table-wide clearing.
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
    canClearAll?: boolean;
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
   * Sends only when the last server snapshot confirms availability
   */
  handleUndo: () => void;

  /**
   * Handle redo operation (keyboard shortcut or toolbar button)
   * Sends only when the last server snapshot confirms availability
   */
  handleRedo: () => void;

  /**
   * Clear all drawings
   * Sends a confirmed DM request; availability changes with the server snapshot
   */
  handleClearDrawings: () => void;

  /**
   * Whether the last server snapshot confirms an applicable undo
   */
  canUndo: boolean;

  /**
   * Whether the last server snapshot confirms an applicable redo
   */
  canRedo: boolean;
}

/**
 * Hook to manage drawing state, toolbar rendering, and keyboard shortcuts
 *
 * This hook coordinates:
 * - Drawing tool state (tool type, color, width, opacity, fill)
 * - Per-recipient drawing history availability from the server
 * - Toolbar rendering (conditionally based on drawMode)
 * - Keyboard shortcuts (undo/redo)
 * - Network synchronization (sending drawing commands to server)
 *
 * @example
 * ```tsx
 * const drawingManager = useDrawingStateManager({
 *   sendMessage,
 *   drawingHistory: snapshot?.drawingHistory,
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
  drawingHistory,
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
    setDrawTool,
    setDrawColor,
    setDrawWidth,
    setDrawOpacity,
    setDrawFilled,
  } = useDrawingState();
  const canUndo = drawingHistory?.canUndo ?? false;
  const canRedo = drawingHistory?.canRedo ?? false;

  // Preserve the MapBoard callback contract. A completed local send is not a
  // server acknowledgment and cannot enable Undo or discard confirmed Redo.
  const onDrawingComplete = useCallback((_id: string): void => {
    // Availability comes only from the next authoritative snapshot.
  }, []);

  /**
   * Handle undo operation
   * Uses confirmed capability without an optimistic pop or pending latch
   * Called by keyboard shortcut (Ctrl+Z) or toolbar button
   */
  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    sendMessage({ t: "undo-drawing" });
  }, [canUndo, sendMessage]);

  /**
   * Handle redo operation
   * Uses confirmed capability even when no drawing is currently visible
   * Called by keyboard shortcut (Ctrl+Y) or toolbar button
   */
  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    sendMessage({ t: "redo-drawing" });
  }, [canRedo, sendMessage]);

  /**
   * Clear all drawings
   * Sends network message; the server snapshot supplies the resulting availability
   * Called by toolbar "Clear All" button or DM menu
   */
  /**
   * Clear every drawing on the map.
   *
   * The guard lives HERE, not at the call sites, so both entry points inherit
   * it — the drawing toolbar's "Clear All" used to fire instantly while the
   * DM menu's "Clear All Drawings" confirmed, for the identical operation.
   *
   * It is also unrecoverable by construction: the server drops every unlocked drawing,
   * `drawingUndoStacks` and `drawingRedoStacks` together, so there is nothing
   * left to undo from. Hence a confirm rather than a trust-the-undo-stack.
   */
  const handleClearDrawings = useCallback(() => {
    // A non-DM's clear is rejected server-side; require the existing capability.
    if (!canClearDrawings) return;
    if (
      !window.confirm(
        "Clear all drawings from the map? Locked drawings stay. This cannot be undone.",
      )
    ) {
      return;
    }

    sendMessage({ t: "clear-drawings" });
  }, [canClearDrawings, sendMessage]);

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
      canClearAll: canClearDrawings,
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
      canClearDrawings,
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
      onDrawingComplete,
    }),
    [drawTool, drawColor, drawWidth, drawOpacity, drawFilled, onDrawingComplete],
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
