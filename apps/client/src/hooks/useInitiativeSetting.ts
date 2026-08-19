import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomSnapshot, ClientMessage } from "@herobyte/shared";

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
  const sendInitiativeUpdate = useCallback(
    (characterId: string, initiative?: number, initiativeModifier?: number) => {
      console.log("[useInitiativeSetting] Updating initiative:", {
        characterId,
        initiative,
        initiativeModifier,
      });

      setIsSetting(true);
      setError(null);
      setTargetCharacterId(characterId);

      const char = snapshot?.characters?.find((c) => c.id === characterId);
      prevInitiativeRef.current = char?.initiative;
      prevModifierRef.current = char?.initiativeModifier;

      sendMessage({
        t: "set-initiative",
        characterId,
        ...(initiative !== undefined ? { initiative } : {}),
        ...(initiativeModifier !== undefined ? { initiativeModifier } : {}),
      });

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

  const setInitiative = useCallback(
    (characterId: string, initiative: number, initiativeModifier: number) => {
      sendInitiativeUpdate(characterId, initiative, initiativeModifier);
    },
    [sendInitiativeUpdate],
  );

  const clearInitiative = useCallback(
    (characterId: string) => {
      sendInitiativeUpdate(characterId);
    },
    [sendInitiativeUpdate],
  );

  /**
   * Ask the SERVER to roll initiative for a character.
   *
   * Fire-and-forget, unlike setInitiative, and that is not laziness on two
   * counts. The server applies the value as it rolls, and the result reaches
   * every seat through the public roll log — so there is no pending state worth
   * holding and nothing here to await. More importantly, reusing the
   * confirmation machinery above would be actively WRONG for a roll: it
   * resolves by noticing that the character's initiative CHANGED, and a roll
   * that lands on the number already stored changes nothing. That request would
   * hang for the full five seconds and then report a timeout for a roll the
   * table watched succeed.
   *
   * @param characterId - Who to roll for
   * @param initiativeModifier - The dial's current value; the server persists
   *   it and rolls with it. Omitted means "use the stored modifier".
   */
  const rollInitiative = useCallback(
    (characterId: string, initiativeModifier?: number) => {
      sendMessage({
        t: "roll-initiative",
        characterId,
        ...(initiativeModifier !== undefined ? { modifier: initiativeModifier } : {}),
      });
    },
    [sendMessage],
  );

  /**
   * Ask the SERVER to roll for every NPC that still has no initiative.
   *
   * ONE message, not one per NPC. The client used to run that loop itself; the
   * limiter allows 100 messages per client per second and drops the rest
   * silently, so a large enough encounter left its tail without initiative
   * while the toast reported the full count. The loop lives on the server now,
   * where nothing rate-limits one iteration from the next.
   */
  const rollAllInitiative = useCallback(() => {
    sendMessage({ t: "roll-initiative-all" });
  }, [sendMessage]);

  return { isSetting, setInitiative, clearInitiative, rollInitiative, rollAllInitiative, error };
}
