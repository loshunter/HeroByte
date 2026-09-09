import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomSnapshot, ClientMessage } from "@herobyte/shared";

/**
 * Hook for setting character initiative with server confirmation.
 *
 * Manages the async flow of setting initiative:
 * 1. Sends set-initiative message to server
 * 2. Monitors the snapshot for the server's answer
 * 3. Confirms success when the character carries the requested value on a
 *    frame newer than the one the request left from — OR when the value
 *    changes at all (the server may clamp). The "newer frame" road matters:
 *    a hand entry equal to the number already stored changes nothing, and
 *    a confirmation keyed on change alone hung five seconds and reported a
 *    timeout for a save the server had applied (one d20 face in twenty).
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
  /** What was asked for, and the frame it was asked from (`undefined` = unversioned). */
  const requestRef = useRef<{
    initiative: number | undefined;
    modifier: number | undefined;
    sentAtVersion: number | undefined;
  } | null>(null);

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

    // Detect successful set when initiative or modifier changes...
    const initiativeChanged = currentInitiative !== prevInitiativeRef.current;
    const modifierChanged = currentModifier !== prevModifierRef.current;
    // ...or when a NEWER frame carries exactly what was asked for (the value
    // may not have changed at all). An unversioned frame cannot prove it is
    // newer, so it only confirms through the change road above.
    const request = requestRef.current;
    const version = snapshot?.stateVersion;
    const frameIsNewer =
      request !== null &&
      version !== undefined &&
      request.sentAtVersion !== undefined &&
      version > request.sentAtVersion;
    const requestApplied =
      request !== null &&
      currentInitiative === request.initiative &&
      (request.modifier === undefined || currentModifier === request.modifier);

    if (initiativeChanged || modifierChanged || (frameIsNewer && requestApplied)) {
      console.log("[useInitiativeSetting] Initiative update confirmed:", {
        characterId: targetCharacterId,
        initiative: currentInitiative,
        modifier: currentModifier,
      });
      setIsSetting(false);
      setError(null);
      setTargetCharacterId(null);
      requestRef.current = null;
      prevInitiativeRef.current = currentInitiative;
      prevModifierRef.current = currentModifier;
    }
  }, [currentInitiative, currentModifier, isSetting, targetCharacterId, snapshot?.stateVersion]);

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
      requestRef.current = {
        initiative,
        modifier: initiativeModifier,
        sentAtVersion: snapshot?.stateVersion,
      };

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
            requestRef.current = null;
            return false;
          }
          return prev;
        });
      }, 5000);
    },
    [sendMessage, snapshot?.characters, snapshot?.stateVersion],
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
