/**
 * usePlayerActions Hook
 *
 * Encapsulates all player-related action creators for managing player state,
 * characters, and staging zones. Extracted from App.tsx as part of Phase 2
 * refactoring.
 *
 * This hook handles:
 * - Simple player updates (name, portrait, HP, status effects)
 * - Character lifecycle (add, delete, update)
 * - Complex player state synchronization
 * - Player staging zone management
 *
 * @module hooks/usePlayerActions
 */

import { useCallback } from "react";
import type {
  ClientMessage,
  PlayerState,
  PlayerStagingZone,
  RoomSnapshot,
  Character,
} from "@shared";

/**
 * Dependencies required by the usePlayerActions hook.
 */
export interface UsePlayerActionsOptions {
  /**
   * WebSocket message sender for client-server communication.
   */
  sendMessage: (msg: ClientMessage) => void;

  /**
   * Current room snapshot for validation and state checks.
   */
  snapshot: RoomSnapshot | null;

  /**
   * Current player's unique identifier.
   */
  uid: string;
}

/**
 * Player action functions returned by the hook.
 */
export interface UsePlayerActionsReturn {
  /**
   * Rename the current player.
   *
   * @param name - New player name
   */
  renamePlayer: (name: string) => void;

  /**
   * Set the player's portrait image URL.
   *
   * @param url - Portrait image URL
   */
  setPortrait: (url: string) => void;

  /**
   * Update the player's hit points.
   *
   * @param hp - Current hit points
   * @param maxHp - Maximum hit points
   */
  setHP: (hp: number, maxHp: number) => void;

  /**
   * Update the player's active status effects.
   *
   * @param effects - Array of status effect identifiers
   */
  setStatusEffects: (effects: string[]) => void;

  /**
   * Add a new player character.
   *
   * @param name - Character name
   */
  addCharacter: (name: string) => void;

  /**
   * Delete a player character with validation and confirmation.
   * If deleting the last character, prompts for a replacement.
   *
   * @param characterId - ID of the character to delete
   */
  deleteCharacter: (characterId: string) => void;

  /**
   * Update a character's name.
   *
   * @param characterId - ID of the character to update
   * @param name - New character name
   */
  updateCharacterName: (characterId: string, name: string) => void;

  /**
   * Apply a complete player state snapshot, including:
   * - Name, HP, portrait, status effects
   * - Token color, image, size, transform
   * - Player drawings
   *
   * This is used for session loading and player state synchronization.
   *
   * @param state - Complete player state to apply
   * @param tokenId - Optional token ID to apply token-specific state
   */
  applyPlayerState: (state: PlayerState, tokenId?: string) => void;

  /**
   * Set the player staging zone (DM-defined spawn area for player tokens).
   *
   * @param zone - Staging zone bounds, or undefined to clear
   */
  setPlayerStagingZone: (zone: PlayerStagingZone | undefined) => void;
}

/**
 * Hook providing all player-related action creators.
 *
 * @param options - Hook dependencies
 * @returns Player action functions
 *
 * @example
 * ```tsx
 * const playerActions = usePlayerActions({
 *   sendMessage,
 *   snapshot,
 *   uid
 * });
 *
 * // Simple actions
 * playerActions.renamePlayer("Gandalf");
 * playerActions.setHP(80, 100);
 *
 * // Character management
 * playerActions.addCharacter("Aragorn");
 * playerActions.deleteCharacter("char-123");
 *
 * // Complex state sync
 * playerActions.applyPlayerState(savedState, "token-456");
 * ```
 */
export function usePlayerActions({
  sendMessage,
  snapshot,
  uid,
}: UsePlayerActionsOptions): UsePlayerActionsReturn {
  /**
   * Rename the current player.
   */
  const renamePlayer = useCallback(
    (name: string) => {
      sendMessage({ t: "rename", name });
    },
    [sendMessage],
  );

  /**
   * Set the player's portrait URL with logging.
   */
  const setPortrait = useCallback(
    (url: string) => {
      console.log(`[App] Setting portrait URL: ${url.substring(0, 50)}...`);
      sendMessage({ t: "portrait", data: url });
    },
    [sendMessage],
  );

  /**
   * Update the player's HP values.
   */
  const setHP = useCallback(
    (hp: number, maxHp: number) => {
      sendMessage({ t: "set-hp", hp, maxHp });
    },
    [sendMessage],
  );

  /**
   * Update the player's status effects.
   */
  const setStatusEffects = useCallback(
    (effects: string[]) => {
      sendMessage({ t: "set-status-effects", effects });
    },
    [sendMessage],
  );

  /**
   * Add a new player character with default maxHp of 100.
   */
  const addCharacter = useCallback(
    (name: string) => {
      sendMessage({ t: "add-player-character", name, maxHp: 100 });
    },
    [sendMessage],
  );

  /**
   * Delete a player character with validation and confirmation.
   *
   * Behavior:
   * 1. Validates character exists in snapshot
   * 2. Requests user confirmation
   * 3. Sends delete message
   * 4. If last character, prompts for replacement after 100ms delay
   */
  const deleteCharacter = useCallback(
    (characterId: string) => {
      // Find this character
      const character = snapshot?.characters?.find((c: Character) => c.id === characterId);
      if (!character) return;

      // Count player's characters
      const myCharacters =
        snapshot?.characters?.filter((c: Character) => c.ownedByPlayerUID === uid) || [];
      const isLastCharacter = myCharacters.length === 1;

      // Confirm deletion
      if (!confirm("Delete this character? This will remove the character and their token.")) {
        return;
      }

      // Send delete message
      sendMessage({ t: "delete-player-character", characterId });

      // If was last character, immediately prompt for replacement
      if (isLastCharacter) {
        setTimeout(() => {
          alert("You have no characters. Please create a new one.");
          const name = prompt("Enter character name:", "New Character");
          const finalName = name && name.trim() ? name.trim() : "New Character";
          sendMessage({ t: "add-player-character", name: finalName, maxHp: 100 });
        }, 100);
      }
    },
    [sendMessage, snapshot?.characters, uid],
  );

  /**
   * Update a character's name.
   */
  const updateCharacterName = useCallback(
    (characterId: string, name: string) => {
      sendMessage({ t: "update-character-name", characterId, name });
    },
    [sendMessage],
  );

  /**
   * Apply a complete player state snapshot.
   *
   * This function orchestrates multiple WebSocket messages to synchronize
   * player state, including:
   * - Basic info: name, HP, portrait
   * - Status effects
   * - Token properties: color, image, size, transform
   * - Player drawings
   *
   * This is the most complex action creator and is used during session loading.
   */
  const applyPlayerState = useCallback(
    (state: PlayerState, tokenId?: string) => {
      // Always update basic player info
      sendMessage({ t: "rename", name: state.name });
      sendMessage({ t: "set-hp", hp: state.hp, maxHp: state.maxHp });

      // Update portrait if present (including null to clear)
      if (state.portrait !== undefined) {
        sendMessage({ t: "portrait", data: state.portrait ?? "" });
      }

      // Update status effects if present
      if (state.statusEffects !== undefined) {
        sendMessage({ t: "set-status-effects", effects: state.statusEffects });
      }

      // Apply token-specific state if tokenId provided
      if (tokenId) {
        // Token color (prefer token.color, fallback to legacy color field)
        const color =
          state.token?.color ?? (typeof state.color === "string" ? state.color : undefined);
        if (color && color.trim().length > 0) {
          sendMessage({ t: "set-token-color", tokenId, color: color.trim() });
        }

        // Token image (prefer token.imageUrl, fallback to legacy tokenImage)
        const nextImage =
          state.token?.imageUrl !== undefined ? state.token.imageUrl : state.tokenImage;
        if (nextImage !== undefined) {
          sendMessage({
            t: "update-token-image",
            tokenId,
            imageUrl: nextImage ?? "",
          });
        }

        // Token size
        if (state.token?.size) {
          sendMessage({ t: "set-token-size", tokenId, size: state.token.size });
        }

        // Token transform (position, scale, rotation)
        const transform: {
          position?: { x: number; y: number };
          scale?: { x: number; y: number };
          rotation?: number;
        } = {};

        if (state.token?.position) {
          transform.position = {
            x: state.token.position.x,
            y: state.token.position.y,
          };
        }

        if (state.token?.scale) {
          // Clamp scale values between 0.1 and 10
          const scaleX = Math.max(0.1, Math.min(10, state.token.scale.x));
          const scaleY = Math.max(0.1, Math.min(10, state.token.scale.y));
          transform.scale = { x: scaleX, y: scaleY };
        }

        if (state.token?.rotation !== undefined) {
          transform.rotation = state.token.rotation;
        }

        // Send transform message if any transform properties present
        if (transform.position || transform.scale || transform.rotation !== undefined) {
          sendMessage({
            t: "transform-object",
            id: `token:${tokenId}`,
            ...transform,
          });
        }
      }

      // Sync player drawings if present
      if (state.drawings !== undefined) {
        sendMessage({ t: "sync-player-drawings", drawings: state.drawings });
      }
    },
    [sendMessage],
  );

  /**
   * Set or clear the player staging zone.
   */
  const setPlayerStagingZone = useCallback(
    (zone: PlayerStagingZone | undefined) => {
      sendMessage({ t: "set-player-staging-zone", zone });
    },
    [sendMessage],
  );

  return {
    renamePlayer,
    setPortrait,
    setHP,
    setStatusEffects,
    addCharacter,
    deleteCharacter,
    updateCharacterName,
    applyPlayerState,
    setPlayerStagingZone,
  };
}
