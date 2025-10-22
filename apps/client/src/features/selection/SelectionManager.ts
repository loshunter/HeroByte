/**
 * SelectionManager Hook
 *
 * High-level orchestration hook for multi-object selection in the scene.
 * Consolidates selection state, handlers, and tool mode integration into
 * a single cohesive interface for managing object selection workflows.
 *
 * Extracted from: apps/client/src/ui/App.tsx (lines 186-286)
 * Extraction date: 2025-10-20
 *
 * This hook manages:
 * - Server-synced selection state via useObjectSelection
 * - Scene object selection handlers via useSceneObjectSelectors
 * - Automatic selection clearing when tool modes change
 * - Lock/unlock operations on selected objects
 *
 * Architecture:
 * - Integrates two lower-level hooks (useObjectSelection, useSceneObjectSelectors)
 * - Implements tool mode awareness (auto-clears when not in transform/select mode)
 * - Provides a unified API for all selection-related operations
 *
 * @module features/selection/SelectionManager
 */

import { useEffect } from "react";
import type { ClientMessage, RoomSnapshot } from "@shared";
import { useObjectSelection } from "../../hooks/useObjectSelection";
import { useSceneObjectSelectors } from "../../hooks/useSceneObjectSelectors";

/**
 * Configuration options for the SelectionManager hook.
 */
export interface SelectionManagerOptions {
  /**
   * Unique identifier for the current user session.
   * Used to identify which player's selection state to manage.
   */
  uid: string;

  /**
   * Current room state snapshot from the server.
   * Contains all selection state and scene objects.
   */
  snapshot: RoomSnapshot | null;

  /**
   * WebSocket message sender for client-server communication.
   * Used to send selection-related commands to the server.
   */
  sendMessage: (msg: ClientMessage) => void;

  /**
   * Whether transform mode is currently active.
   * When false (along with selectMode), selection is auto-cleared.
   */
  transformMode: boolean;

  /**
   * Whether select mode is currently active.
   * When false (along with transformMode), selection is auto-cleared.
   */
  selectMode: boolean;
}

/**
 * Selection state and handler functions returned by the hook.
 */
export interface SelectionManagerReturn {
  /**
   * Primary selected object ID (most recently selected).
   * Null if no objects are selected.
   *
   * In single selection mode: the selected object
   * In multi-selection mode: the last object in the selection array
   */
  selectedObjectId: string | null;

  /**
   * Array of all currently selected object IDs.
   * Empty array if no objects are selected.
   *
   * Maintained in selection order (first selected = index 0).
   */
  selectedObjectIds: string[];

  /**
   * Handle selection of a single object with various modes.
   *
   * Selection modes:
   * - 'replace': Replace current selection (default)
   * - 'append': Add to current selection
   * - 'toggle': Toggle object in/out of selection
   * - 'subtract': Remove from current selection
   *
   * @param objectId - The object ID to select, or null to clear selection
   * @param options - Selection options with mode specification
   *
   * @example
   * ```tsx
   * // Replace selection (default)
   * handleObjectSelection("token:123");
   *
   * // Add to selection (Ctrl+Click)
   * handleObjectSelection("token:456", { mode: 'append' });
   *
   * // Toggle selection (Shift+Click)
   * handleObjectSelection("token:789", { mode: 'toggle' });
   *
   * // Clear selection
   * handleObjectSelection(null);
   * ```
   */
  handleObjectSelection: (
    objectId: string | null,
    options?: { mode?: "replace" | "append" | "toggle" | "subtract" },
  ) => void;

  /**
   * Handle batch selection of multiple objects.
   * Always uses 'replace' mode.
   *
   * @param objectIds - Array of object IDs to select, or empty array to clear
   *
   * @example
   * ```tsx
   * // Select multiple objects (marquee selection)
   * handleObjectSelectionBatch(["token:123", "token:456", "drawing:789"]);
   *
   * // Clear selection
   * handleObjectSelectionBatch([]);
   * ```
   */
  handleObjectSelectionBatch: (objectIds: string[]) => void;

  /**
   * Clear all selections.
   * Equivalent to handleObjectSelection(null) or handleObjectSelectionBatch([]).
   *
   * @example
   * ```tsx
   * // Clear on Escape key
   * useEffect(() => {
   *   const handler = (e: KeyboardEvent) => {
   *     if (e.key === 'Escape') clearSelection();
   *   };
   *   window.addEventListener('keydown', handler);
   *   return () => window.removeEventListener('keydown', handler);
   * }, [clearSelection]);
   * ```
   */
  clearSelection: () => void;

  /**
   * Lock all currently selected objects.
   * Only available to DM users.
   *
   * Locked objects cannot be:
   * - Moved or transformed
   * - Deleted (even by DM)
   * - Modified (except to unlock)
   *
   * @example
   * ```tsx
   * // Lock selected map features
   * <button onClick={lockSelected}>Lock Selected</button>
   * ```
   */
  lockSelected: () => void;

  /**
   * Unlock all currently selected objects.
   * Only available to DM users.
   *
   * @example
   * ```tsx
   * // Unlock to allow editing
   * <button onClick={unlockSelected}>Unlock Selected</button>
   * ```
   */
  unlockSelected: () => void;
}

/**
 * Hook providing comprehensive multi-object selection management.
 *
 * This is a high-level orchestration hook that combines multiple lower-level
 * hooks to provide a complete selection management solution. It handles:
 *
 * 1. **Selection State** - Server-synced selection via useObjectSelection
 * 2. **Selection Handlers** - Business logic via useSceneObjectSelectors
 * 3. **Tool Mode Integration** - Auto-clear when switching away from selection tools
 * 4. **Lock Management** - Batch lock/unlock operations on selections
 *
 * Tool Mode Integration:
 * When both transformMode and selectMode are false, selection is automatically
 * cleared. This ensures the UI state matches the active tool - if the user
 * switches to pointer, measure, or draw mode, the selection is cleared.
 *
 * @param options - Hook configuration
 * @returns Selection state and handler functions
 *
 * @example
 * ```tsx
 * function App() {
 *   const { activeTool, transformMode, selectMode } = useToolMode();
 *
 *   const {
 *     selectedObjectId,
 *     selectedObjectIds,
 *     handleObjectSelection,
 *     handleObjectSelectionBatch,
 *     clearSelection,
 *     lockSelected,
 *     unlockSelected
 *   } = useSelectionManager({
 *     uid,
 *     snapshot,
 *     sendMessage,
 *     transformMode,
 *     selectMode
 *   });
 *
 *   return (
 *     <>
 *       <MapBoard
 *         selectedObjectId={selectedObjectId}
 *         selectedObjectIds={selectedObjectIds}
 *         onSelectObject={handleObjectSelection}
 *         onSelectObjects={handleObjectSelectionBatch}
 *       />
 *       <MultiSelectToolbar
 *         selectedObjectIds={selectedObjectIds}
 *         onLock={lockSelected}
 *         onUnlock={unlockSelected}
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function useSelectionManager({
  uid,
  snapshot,
  sendMessage,
  transformMode,
  selectMode,
}: SelectionManagerOptions): SelectionManagerReturn {
  // -------------------------------------------------------------------------
  // SELECTION STATE
  // -------------------------------------------------------------------------

  /**
   * Initialize server-synced selection state.
   * This hook manages the low-level selection state with optimistic updates
   * and server synchronization.
   */
  const {
    selectedObjectId,
    selectedObjectIds,
    selectObject,
    selectMultiple,
    deselect: clearSelection,
    lockSelected,
    unlockSelected,
  } = useObjectSelection({ uid, snapshot, sendMessage });

  // -------------------------------------------------------------------------
  // SELECTION HANDLERS
  // -------------------------------------------------------------------------

  /**
   * Initialize scene object selection handlers.
   * These handlers wrap the primitive selection operations with business logic
   * for different selection modes (replace, append, toggle, subtract).
   */
  const { handleObjectSelection, handleObjectSelectionBatch } = useSceneObjectSelectors({
    selectedObjectIds,
    selectObject,
    selectMultiple,
    clearSelection,
  });

  // -------------------------------------------------------------------------
  // TOOL MODE INTEGRATION
  // -------------------------------------------------------------------------

  /**
   * Auto-clear selection when switching away from transform/select tools.
   *
   * This effect ensures that when the user switches to a different tool mode
   * (pointer, measure, draw, align), the selection is cleared. This prevents
   * confusion where objects remain selected but can't be transformed.
   *
   * The selection is preserved when switching between transform and select modes,
   * as both modes work with selections.
   */
  useEffect(() => {
    if (!transformMode && !selectMode) {
      clearSelection();
    }
  }, [transformMode, selectMode, clearSelection]);

  // -------------------------------------------------------------------------
  // RETURN API
  // -------------------------------------------------------------------------

  return {
    selectedObjectId,
    selectedObjectIds,
    handleObjectSelection,
    handleObjectSelectionBatch,
    clearSelection,
    lockSelected,
    unlockSelected,
  };
}

/**
 * Type alias for the return value of useSelectionManager.
 * Useful for typing props or other hooks that depend on this hook.
 *
 * @example
 * ```tsx
 * interface MapBoardProps {
 *   selectionManager: SelectionManagerHook;
 * }
 * ```
 */
export type SelectionManagerHook = ReturnType<typeof useSelectionManager>;
