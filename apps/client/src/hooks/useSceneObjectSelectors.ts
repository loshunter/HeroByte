/**
 * useSceneObjectSelectors
 *
 * Provides higher-level selection handlers that wrap the primitive selection
 * operations from useObjectSelection. These handlers implement business logic
 * for different selection modes (replace, append, toggle, subtract) and batch
 * operations.
 *
 * Extracted from: apps/client/src/ui/App.tsx (lines 620-668)
 * Extraction date: 2025-10-20
 *
 * @example
 * ```tsx
 * const { selectedObjectIds, selectObject, selectMultiple, deselect } = useObjectSelection({
 *   uid,
 *   snapshot,
 *   sendMessage
 * });
 *
 * const { handleObjectSelection, handleObjectSelectionBatch } = useSceneObjectSelectors({
 *   selectedObjectIds,
 *   selectObject,
 *   selectMultiple,
 *   clearSelection: deselect
 * });
 *
 * // Use in event handlers
 * <SceneObject onClick={() => handleObjectSelection(objectId, { mode: 'toggle' })} />
 * ```
 *
 * @module hooks/useSceneObjectSelectors
 */

import { useCallback } from "react";

/**
 * Options for useSceneObjectSelectors hook
 */
export interface UseSceneObjectSelectorsOptions {
  /**
   * Currently selected object IDs from useObjectSelection
   */
  selectedObjectIds: string[];

  /**
   * Function to select a single object (from useObjectSelection)
   */
  selectObject: (objectId: string | null) => void;

  /**
   * Function to select multiple objects with a mode (from useObjectSelection)
   */
  selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;

  /**
   * Function to clear selection (from useObjectSelection.deselect)
   */
  clearSelection: () => void;
}

/**
 * Return value from useSceneObjectSelectors hook
 */
export interface UseSceneObjectSelectorsReturn {
  /**
   * Handle selection of a single object with various modes
   *
   * @param objectId - The object ID to select, or null to clear selection
   * @param options - Selection options
   * @param options.mode - Selection mode:
   *   - 'replace': Replace current selection (default)
   *   - 'append': Add to current selection
   *   - 'toggle': Toggle object in/out of selection
   *   - 'subtract': Remove from current selection
   */
  handleObjectSelection: (
    objectId: string | null,
    options?: { mode?: "replace" | "append" | "toggle" | "subtract" },
  ) => void;

  /**
   * Handle batch selection of multiple objects
   *
   * @param objectIds - Array of object IDs to select, or empty array to clear
   */
  handleObjectSelectionBatch: (objectIds: string[]) => void;
}

/**
 * Hook that provides scene object selection handlers
 *
 * This hook wraps the primitive selection operations from useObjectSelection
 * and adds business logic for different selection modes. It handles:
 * - Single object selection with modes (replace, append, toggle, subtract)
 * - Batch selection (replace mode only)
 * - Null/empty selection (clears selection)
 *
 * @param options - Hook options
 * @returns Selection handler functions
 *
 * @see {@link useObjectSelection} for the underlying selection state management
 */
export function useSceneObjectSelectors({
  selectedObjectIds,
  selectObject,
  selectMultiple,
  clearSelection,
}: UseSceneObjectSelectorsOptions): UseSceneObjectSelectorsReturn {
  const handleObjectSelection = useCallback(
    (
      objectId: string | null,
      options?: { mode?: "replace" | "append" | "toggle" | "subtract" },
    ) => {
      if (!objectId) {
        clearSelection();
        return;
      }

      const mode = options?.mode ?? "replace";
      switch (mode) {
        case "append": {
          selectMultiple([objectId], "append");
          return;
        }
        case "toggle": {
          if (selectedObjectIds.includes(objectId)) {
            selectMultiple([objectId], "subtract");
          } else if (selectedObjectIds.length > 0) {
            selectMultiple([objectId], "append");
          } else {
            selectObject(objectId);
          }
          return;
        }
        case "subtract": {
          selectMultiple([objectId], "subtract");
          return;
        }
        case "replace":
        default: {
          selectObject(objectId);
        }
      }
    },
    [clearSelection, selectMultiple, selectObject, selectedObjectIds],
  );

  const handleObjectSelectionBatch = useCallback(
    (objectIds: string[]) => {
      if (objectIds.length === 0) {
        clearSelection();
        return;
      }
      selectMultiple(objectIds, "replace");
    },
    [clearSelection, selectMultiple],
  );

  return {
    handleObjectSelection,
    handleObjectSelectionBatch,
  };
}
