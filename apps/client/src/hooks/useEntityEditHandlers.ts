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
import { normalizeImageUrl } from "../utils/imageUrlHelpers";

/**
 * Parameters for the useEntityEditHandlers hook
 */
export interface UseEntityEditHandlersParams {
  /** UID of the character whose HP is currently being edited */
  editingHpUID: string | null;
  /** UID of the character whose max HP is currently being edited */
  editingMaxHpUID: string | null;
  /** UID of the character whose temp HP is currently being edited */
  editingTempHpUID: string | null;
  /** Current room snapshot containing character data */
  snapshot: RoomSnapshot | null;
  /** Function to submit HP edits with a callback that receives the new HP value */
  submitHpEdit: (callback: (hp: number) => void) => void;
  /** Function to submit max HP edits with a callback that receives the new max HP value */
  submitMaxHpEdit: (callback: (maxHp: number) => void) => void;
  /** Function to submit temp HP edits with a callback that receives the new temp HP value */
  submitTempHpEdit: (callback: (tempHp: number) => void) => void;
  /** Function to submit name edits with a callback that receives the new name */
  submitNameEdit: (callback: (name: string) => void) => void;
  /** Player action handlers */
  playerActions: {
    /** Update a character's HP and max HP */
    updateCharacterHP: (characterId: string, hp: number, maxHp: number, tempHp?: number) => void;
    /** Set the player's portrait URL */
    setPortrait: (url: string) => void;
    /** Set a specific character's portrait URL */
    setCharacterPortrait: (characterId: string, url: string) => void;
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
  /** Handler for submitting character temp HP changes */
  handleCharacterTempHpSubmit: () => void;
  /** Handler for loading a new portrait image */
  handlePortraitLoad: (characterId?: string) => void;
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
export function useEntityEditHandlers(
  params: UseEntityEditHandlersParams,
): UseEntityEditHandlersReturn {
  const {
    editingHpUID,
    editingMaxHpUID,
    editingTempHpUID,
    snapshot,
    submitHpEdit,
    submitMaxHpEdit,
    submitTempHpEdit,
    submitNameEdit,
    playerActions,
  } = params;

  /**
   * Handles submission of character HP changes.
   * Finds the character being edited and updates their HP while preserving max HP and temp HP.
   */
  const handleCharacterHpSubmit = useCallback(() => {
    submitHpEdit((hp) => {
      if (!editingHpUID) return;
      const character = snapshot?.characters?.find((c) => c.id === editingHpUID);
      if (!character) return;
      playerActions.updateCharacterHP(character.id, hp, character.maxHp, character.tempHp);
    });
  }, [submitHpEdit, editingHpUID, snapshot?.characters, playerActions]);

  /**
   * Handles submission of character max HP changes.
   * Finds the character being edited and updates their max HP while preserving current HP and temp HP.
   */
  const handleCharacterMaxHpSubmit = useCallback(() => {
    submitMaxHpEdit((maxHp) => {
      if (!editingMaxHpUID) return;
      const character = snapshot?.characters?.find((c) => c.id === editingMaxHpUID);
      if (!character) return;

      // Ensure HP doesn't exceed new Max HP (QoL: clamp HP down if Max HP is lowered below it)
      const newHp = Math.min(character.hp, maxHp);
      playerActions.updateCharacterHP(character.id, newHp, maxHp, character.tempHp);
    });
  }, [submitMaxHpEdit, editingMaxHpUID, snapshot?.characters, playerActions]);

  /**
   * Handles submission of character temp HP changes.
   * Finds the character being edited and updates their temp HP while preserving current HP and max HP.
   */
  const handleCharacterTempHpSubmit = useCallback(() => {
    submitTempHpEdit((tempHp) => {
      if (!editingTempHpUID) return;
      const character = snapshot?.characters?.find((c) => c.id === editingTempHpUID);
      if (!character) return;
      playerActions.updateCharacterHP(character.id, character.hp, character.maxHp, tempHp);
    });
  }, [submitTempHpEdit, editingTempHpUID, snapshot?.characters, playerActions]);

  /**
   * Handles loading a new portrait image.
   * Prompts the user for an image URL and updates the player's portrait if valid.
   * Converts Imgur share links to direct image URLs automatically.
   */
  const handlePortraitLoad = useCallback(
    async (characterId?: string) => {
      const url = prompt("Enter image URL:");
      if (!url || !url.trim()) {
        return;
      }

      const normalizedUrl = await normalizeImageUrl(url.trim());
      if (characterId) {
        playerActions.setCharacterPortrait(characterId, normalizedUrl);
      } else {
        playerActions.setPortrait(normalizedUrl);
      }
    },
    [playerActions],
  );

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
    handleCharacterTempHpSubmit,
    handlePortraitLoad,
    handleNameSubmit,
  };
}
