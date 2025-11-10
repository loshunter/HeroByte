// ============================================================================
// USE PLAYER TOKEN SELECTION HOOK
// ============================================================================
// Provides DM functionality to select all tokens owned by a specific player
// with safe undo capability.
//
// This hook:
// - Filters tokens by player ownership
// - Stores previous selection for undo
// - Handles edge cases (no tokens, locked tokens)
// - Integrates with existing selection system

import { useCallback, useState } from "react";
import type { SceneObject } from "@shared";

interface UsePlayerTokenSelectionOptions {
  /**
   * Scene objects from the current room snapshot
   */
  sceneObjects: SceneObject[];

  /**
   * Currently selected object IDs (for undo)
   */
  selectedObjectIds: string[];

  /**
   * Callback to select multiple objects (batch selection)
   */
  selectMultiple: (objectIds: string[]) => void;
}

interface UsePlayerTokenSelectionReturn {
  /**
   * Select all tokens owned by a specific player
   * @param playerUid - The UID of the player whose tokens to select
   */
  selectPlayerTokens: (playerUid: string) => void;

  /**
   * Undo the last player token selection, restoring previous selection
   */
  undoSelection: () => void;

  /**
   * Whether undo is available (there is a saved previous selection)
   */
  canUndo: boolean;
}

/**
 * Hook providing DM shortcuts for selecting all tokens owned by a player
 *
 * Features:
 * - Automatically filters to unlocked tokens only
 * - Saves previous selection for undo
 * - Handles empty selections gracefully
 * - Works with existing multi-select system
 *
 * @param options - Hook configuration
 * @returns Player token selection functions and state
 *
 * @example
 * ```tsx
 * const { selectPlayerTokens, undoSelection, canUndo } = usePlayerTokenSelection({
 *   sceneObjects,
 *   selectedObjectIds,
 *   selectMultiple,
 * });
 *
 * // Select all tokens owned by a player
 * <button onClick={() => selectPlayerTokens("player-123")}>
 *   Select Player's Tokens
 * </button>
 *
 * // Undo the selection
 * <button onClick={undoSelection} disabled={!canUndo}>
 *   Undo Selection
 * </button>
 * ```
 */
export function usePlayerTokenSelection({
  sceneObjects,
  selectedObjectIds,
  selectMultiple,
}: UsePlayerTokenSelectionOptions): UsePlayerTokenSelectionReturn {
  // Store previous selection for undo (using state to trigger re-renders)
  const [previousSelection, setPreviousSelection] = useState<string[] | null>(null);

  /**
   * Select all unlocked tokens owned by a specific player
   */
  const selectPlayerTokens = useCallback(
    (playerUid: string) => {
      // Find all unlocked tokens owned by this player
      const playerTokenIds = sceneObjects
        .filter(
          (obj) => obj.type === "token" && obj.owner === playerUid && !obj.locked, // Exclude locked tokens
        )
        .map((obj) => obj.id);

      // If no tokens found, do nothing
      if (playerTokenIds.length === 0) {
        console.log(`[usePlayerTokenSelection] No unlocked tokens found for player ${playerUid}`);
        return;
      }

      // Save current selection for undo
      setPreviousSelection([...selectedObjectIds]);

      // Select the player's tokens
      console.log(
        `[usePlayerTokenSelection] Selecting ${playerTokenIds.length} tokens for player ${playerUid}`,
        playerTokenIds,
      );
      selectMultiple(playerTokenIds);
    },
    [sceneObjects, selectedObjectIds, selectMultiple],
  );

  /**
   * Restore previous selection (undo)
   */
  const undoSelection = useCallback(() => {
    if (previousSelection === null) {
      console.log("[usePlayerTokenSelection] No previous selection to restore");
      return;
    }

    console.log(
      "[usePlayerTokenSelection] Restoring previous selection:",
      previousSelection,
    );
    const toRestore = previousSelection;
    setPreviousSelection(null); // Clear after restoring
    selectMultiple(toRestore);
  }, [previousSelection, selectMultiple]);

  const canUndo = previousSelection !== null;

  return {
    selectPlayerTokens,
    undoSelection,
    canUndo,
  };
}

export type UsePlayerTokenSelectionHook = ReturnType<typeof usePlayerTokenSelection>;
