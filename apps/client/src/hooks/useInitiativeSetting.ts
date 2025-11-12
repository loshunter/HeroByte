import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomSnapshot, ClientMessage } from "@shared";

/**
 * Hook for setting character initiative with server confirmation.
 *
 * Manages the async flow of setting initiative:
 * 1. Sends set-initiative message to server
 * 2. Monitors snapshot for initiative changes
 * 3. Confirms success when initiative updates
 * 4. Provides loading state and error handling
 *
 * @example
 * ```tsx
 * const { isSetting, setInitiative, error } = useInitiativeSetting({
 *   snapshot,
 *   sendMessage,
 * });
 *
 * // Set initiative and wait for confirmation
 * setInitiative(characterId, 15, 2); // rolls + modifier = 15, modifier = 2
 * ```
 */
export function useInitiativeSetting({
  snapshot,
  sendMessage,
}: {
  snapshot: RoomSnapshot | null;
  sendMessage: (msg: ClientMessage) => void;
}) {
  const [isSetting, setIsSetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetCharacterId, setTargetCharacterId] = useState<string | null>(null);

  // Track previous initiative to detect changes
  const prevInitiativeRef = useRef<number | undefined>(undefined);
  const prevModifierRef = useRef<number | undefined>(undefined);

  // Get current initiative and modifier from snapshot
  const character = snapshot?.characters?.find((char) => char.id === targetCharacterId);
  const currentInitiative = character?.initiative;
  const currentModifier = character?.initiativeModifier;

  // Monitor for initiative changes
  useEffect(() => {
    if (!isSetting) {
      // Update refs when not setting (to track baseline)
      prevInitiativeRef.current = currentInitiative;
      prevModifierRef.current = currentModifier;
      return;
    }

    // Detect successful set when initiative or modifier changes
    const initiativeChanged = currentInitiative !== prevInitiativeRef.current;
    const modifierChanged = currentModifier !== prevModifierRef.current;

    if (initiativeChanged || modifierChanged) {
      console.log("[useInitiativeSetting] Initiative update confirmed:", {
        characterId: targetCharacterId,
        initiative: currentInitiative,
        modifier: currentModifier,
      });
      setIsSetting(false);
      setError(null);
      setTargetCharacterId(null);
      prevInitiativeRef.current = currentInitiative;
      prevModifierRef.current = currentModifier;
    }
  }, [currentInitiative, currentModifier, isSetting, targetCharacterId]);

  /**
   * Sets initiative for a character and waits for server confirmation.
   *
   * @param characterId - ID of the character
   * @param initiative - Final initiative value (roll + modifier)
   * @param initiativeModifier - Initiative modifier
   */
  const setInitiative = useCallback(
    (characterId: string, initiative: number, initiativeModifier: number) => {
      console.log("[useInitiativeSetting] Setting initiative:", {
        characterId,
        initiative,
        initiativeModifier,
      });

      setIsSetting(true);
      setError(null);
      setTargetCharacterId(characterId);

      // Capture current values to detect changes
      const char = snapshot?.characters?.find((c) => c.id === characterId);
      prevInitiativeRef.current = char?.initiative;
      prevModifierRef.current = char?.initiativeModifier;

      sendMessage({ t: "set-initiative", characterId, initiative, initiativeModifier });

      // Timeout fallback (5 seconds)
      setTimeout(() => {
        setIsSetting((prev) => {
          if (prev) {
            console.error("[useInitiativeSetting] Initiative update timed out");
            setError("Initiative update timed out. Please try again.");
            setTargetCharacterId(null);
            return false;
          }
          return prev;
        });
      }, 5000);
    },
    [sendMessage, snapshot?.characters],
  );

  return { isSetting, setInitiative, error };
}
