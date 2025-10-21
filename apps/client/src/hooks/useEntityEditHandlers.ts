/**
 * useEntityEditHandlers Hook
 *
 * Custom hook that encapsulates entity editing handler logic for player characters.
 * Provides callbacks for submitting HP, max HP, portrait, and name changes.
 *
 * Part of Phase 15 SOLID Refactor Initiative - Priority 29 (Final Phase)
 * Extracted from: apps/client/src/layouts/MainLayout.tsx
 *
 * @remarks
 * This hook extracts inline handler functions from MainLayout to improve
 * code organization and readability. All handlers are memoized using useCallback
 * to prevent unnecessary re-renders.
 *
 * The handlers coordinate between the editing state (which entity is being edited)
 * and the submission callbacks that actually perform the updates.
 */

import { useCallback } from "react";
import type { RoomSnapshot } from "@shared";

/**
 * Parameters for the useEntityEditHandlers hook
 */
export interface UseEntityEditHandlersParams {
  /** UID of the character whose HP is currently being edited */
  editingHpUID: string | null;
  /** UID of the character whose max HP is currently being edited */
  editingMaxHpUID: string | null;
  /** Current room snapshot containing character data */
  snapshot: RoomSnapshot | null;
  /** Function to submit HP edits with a callback that receives the new HP value */
  submitHpEdit: (callback: (hp: number) => void) => void;
  /** Function to submit max HP edits with a callback that receives the new max HP value */
  submitMaxHpEdit: (callback: (maxHp: number) => void) => void;
  /** Function to submit name edits with a callback that receives the new name */
  submitNameEdit: (callback: (name: string) => void) => void;
  /** Player action handlers */
  playerActions: {
    /** Update a character's HP and max HP */
    updateCharacterHP: (characterId: string, hp: number, maxHp: number) => void;
    /** Set the player's portrait URL */
    setPortrait: (url: string) => void;
    /** Rename the player */
    renamePlayer: (name: string) => void;
  };
}

/**
 * Return value from the useEntityEditHandlers hook
 */
export interface UseEntityEditHandlersReturn {
  /** Handler for submitting character HP changes */
  handleCharacterHpSubmit: () => void;
  /** Handler for submitting character max HP changes */
  handleCharacterMaxHpSubmit: () => void;
  /** Handler for loading a new portrait image */
  handlePortraitLoad: () => void;
  /** Handler for submitting player name changes */
  handleNameSubmit: () => void;
}

/**
 * Custom hook for entity editing handlers
 *
 * Provides memoized callbacks for handling entity editing operations
 * including HP, max HP, portrait, and name changes.
 *
 * @param params - Hook parameters including editing state and action handlers
 * @returns Object containing the four handler functions
 *
 * @example
 * ```tsx
 * const {
 *   handleCharacterHpSubmit,
 *   handleCharacterMaxHpSubmit,
 *   handlePortraitLoad,
 *   handleNameSubmit,
 * } = useEntityEditHandlers({
 *   editingHpUID,
 *   editingMaxHpUID,
 *   snapshot,
 *   submitHpEdit,
 *   submitMaxHpEdit,
 *   submitNameEdit,
 *   playerActions,
 * });
 * ```
 */
export function useEntityEditHandlers(params: UseEntityEditHandlersParams): UseEntityEditHandlersReturn {
  const {
    editingHpUID,
    editingMaxHpUID,
    snapshot,
    submitHpEdit,
    submitMaxHpEdit,
    submitNameEdit,
    playerActions,
  } = params;

  /**
   * Handles submission of character HP changes.
   * Finds the character being edited and updates their HP while preserving max HP.
   */
  const handleCharacterHpSubmit = useCallback(() => {
    submitHpEdit((hp) => {
      if (!editingHpUID) return;
      const character = snapshot?.characters?.find((c) => c.id === editingHpUID);
      if (!character) return;
      playerActions.updateCharacterHP(character.id, hp, character.maxHp);
    });
  }, [submitHpEdit, editingHpUID, snapshot?.characters, playerActions]);

  /**
   * Handles submission of character max HP changes.
   * Finds the character being edited and updates their max HP while preserving current HP.
   */
  const handleCharacterMaxHpSubmit = useCallback(() => {
    submitMaxHpEdit((maxHp) => {
      if (!editingMaxHpUID) return;
      const character = snapshot?.characters?.find((c) => c.id === editingMaxHpUID);
      if (!character) return;
      playerActions.updateCharacterHP(character.id, character.hp, maxHp);
    });
  }, [submitMaxHpEdit, editingMaxHpUID, snapshot?.characters, playerActions]);

  /**
   * Handles loading a new portrait image.
   * Prompts the user for an image URL and updates the player's portrait if valid.
   */
  const handlePortraitLoad = useCallback(() => {
    const url = prompt("Enter image URL:");
    if (url && url.trim()) {
      playerActions.setPortrait(url.trim());
    }
  }, [playerActions]);

  /**
   * Handles submission of player name changes.
   * Delegates to the submitNameEdit callback with the renamePlayer action.
   */
  const handleNameSubmit = useCallback(() => {
    submitNameEdit(playerActions.renamePlayer);
  }, [submitNameEdit, playerActions.renamePlayer]);

  return {
    handleCharacterHpSubmit,
    handleCharacterMaxHpSubmit,
    handlePortraitLoad,
    handleNameSubmit,
  };
}
