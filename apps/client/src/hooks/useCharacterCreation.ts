/**
 * useCharacterCreation Hook
 *
 * Manages character creation with loading state and server confirmation.
 * Wraps the addCharacter action to provide feedback while waiting for
 * the server to create the character and update the snapshot.
 *
 * This hook solves the state synchronization issue where UI would close
 * immediately after sending the creation message, before the new character
 * appeared in the snapshot, requiring a page refresh to see the result.
 *
 * @module hooks/useCharacterCreation
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { Character } from "@shared";

export interface UseCharacterCreationOptions {
  /**
   * Function to call to create a character (from usePlayerActions).
   */
  addCharacter: (name: string) => void;

  /**
   * Array of all characters in the session to watch for new characters.
   */
  characters: Character[];

  /**
   * Current player's unique identifier.
   */
  uid: string;
}

export interface UseCharacterCreationReturn {
  /**
   * Whether a character creation is in progress.
   */
  isCreating: boolean;

  /**
   * Initiate character creation with loading state.
   * Returns true if creation was initiated, false if already in progress.
   */
  createCharacter: (name: string) => boolean;

  /**
   * Cancel the pending creation (if user closes dialog, etc).
   */
  cancel: () => void;
}

/**
 * Hook to manage character creation with server confirmation.
 */
export function useCharacterCreation(
  options: UseCharacterCreationOptions,
): UseCharacterCreationReturn {
  const { addCharacter, characters, uid } = options;

  const [isCreating, setIsCreating] = useState(false);
  const [pendingCharacterName, setPendingCharacterName] = useState<string | null>(null);

  // Track previous character count to detect when a new one appears
  const previousCharacterCountRef = useRef<number>(0);

  // Update the previous count whenever characters change (but not during creation)
  useEffect(() => {
    if (!isCreating) {
      const myCharacters = characters.filter((c) => c.ownedByPlayerUID === uid);
      previousCharacterCountRef.current = myCharacters.length;
    }
  }, [characters, uid, isCreating]);

  // Watch for new character appearing in characters array
  useEffect(() => {
    if (!isCreating || !pendingCharacterName) {
      return;
    }

    const myCharacters = characters.filter((c) => c.ownedByPlayerUID === uid);
    const currentCount = myCharacters.length;

    // Check if a new character appeared
    if (currentCount > previousCharacterCountRef.current) {
      // Optionally: verify the character has the expected name
      const newCharacter = myCharacters.find((c) => c.name === pendingCharacterName);

      if (newCharacter || currentCount > previousCharacterCountRef.current) {
        // Success! Character was created
        console.log("[useCharacterCreation] Character creation confirmed:", {
          name: pendingCharacterName,
          characterCount: currentCount,
        });

        // Update the ref for next time
        previousCharacterCountRef.current = currentCount;

        // Clear loading state
        setIsCreating(false);
        setPendingCharacterName(null);
      }
    }
  }, [isCreating, pendingCharacterName, characters, uid]);

  // Initiate character creation
  const createCharacter = useCallback(
    (name: string): boolean => {
      if (isCreating) {
        console.warn("[useCharacterCreation] Character creation already in progress");
        return false;
      }

      console.log("[useCharacterCreation] Starting character creation:", name);

      // Set loading state BEFORE sending message
      setIsCreating(true);
      setPendingCharacterName(name);

      // Send the creation message
      addCharacter(name);

      return true;
    },
    [isCreating, addCharacter],
  );

  // Cancel pending creation
  const cancel = useCallback(() => {
    if (isCreating) {
      console.log("[useCharacterCreation] Cancelling character creation");
      setIsCreating(false);
      setPendingCharacterName(null);
    }
  }, [isCreating]);

  return {
    isCreating,
    createCharacter,
    cancel,
  };
}
