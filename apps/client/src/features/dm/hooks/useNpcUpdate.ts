/**
 * useNpcUpdate Hook
 *
 * Manages NPC updates with loading state and server confirmation.
 * Monitors the snapshot to detect when NPC fields have been updated by the server,
 * providing loading feedback and error handling.
 *
 * This hook solves the fire-and-forget issue where NPC updates are sent to the
 * server without waiting for confirmation, potentially causing race conditions
 * with snapshot updates.
 *
 * @module hooks/useNpcUpdate
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { ClientMessage, NpcDisposition, RoomSnapshot } from "@herobyte/shared";

export interface UseNpcUpdateOptions {
  /**
   * Current room snapshot containing all characters (including NPCs)
   */
  snapshot: RoomSnapshot | null;

  /**
   * Function to send messages to the server
   */
  sendMessage: (message: ClientMessage) => void;
}

export interface NpcUpdateFields {
  name?: string;
  hp?: number;
  maxHp?: number;
  tempHp?: number;
  portrait?: string | null;
  tokenImage?: string | null;
  initiativeModifier?: number | null;
  /** Where the NPC stands with the party; absent keeps what it has. */
  disposition?: NpcDisposition;
}

export interface UseNpcUpdateReturn {
  /**
   * Whether an NPC update is in progress
   */
  isUpdating: boolean;

  /**
   * Initiate NPC update with loading state
   */
  updateNpc: (id: string, updates: NpcUpdateFields) => void;

  /**
   * Error message if update failed, null otherwise
   */
  error: string | null;

  /**
   * ID of the NPC currently being updated, null if not updating
   */
  targetNpcId: string | null;
}

/**
 * Hook to manage NPC updates with server confirmation.
 *
 * @example
 * ```tsx
 * const { isUpdating, updateNpc, error, targetNpcId } = useNpcUpdate({
 *   snapshot,
 *   sendMessage
 * });
 *
 * // Update an NPC
 * updateNpc('npc-1', { name: 'Goblin Chief', hp: 25 });
 *
 * // Show loading state in UI
 * <button disabled={isUpdating}>
 *   {isUpdating ? 'Updating...' : 'Save Changes'}
 * </button>
 * ```
 */
export function useNpcUpdate(options: UseNpcUpdateOptions): UseNpcUpdateReturn {
  const { snapshot, sendMessage } = options;

  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetNpcId, setTargetNpcId] = useState<string | null>(null);

  // Track the expected values after update
  const expectedValuesRef = useRef<{
    name: string;
    hp: number;
    maxHp: number;
    tempHp?: number;
    portrait?: string;
    tokenImage?: string | null;
    initiativeModifier?: number;
    disposition?: NpcDisposition;
  } | null>(null);

  // ONE timer, cleared wherever the request resolves. It used to be armed on
  // every call and never cleared — including on success — so a timer from an
  // update that had already CONFIRMED fired during a later one. `prev` was
  // true (the later update in flight), so it took the timeout branch: a false
  // "timed out" banner, targetNpcId nulled so the live update could never
  // confirm, and isUpdating flipped false mid-flight — which is the flag
  // NPCEditor's resync guard keys on, so the optimistic edit was discarded.
  // Blurring five fields in a row armed five overlapping timers.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  useEffect(() => clearTimer, [clearTimer]);

  // Get current NPC from snapshot
  const currentNpc = snapshot?.characters?.find((c) => c.id === targetNpcId && c.type === "npc");

  // Monitor snapshot for NPC field changes
  useEffect(() => {
    if (!isUpdating || !targetNpcId || !expectedValuesRef.current || !currentNpc) {
      return;
    }

    const expected = expectedValuesRef.current;

    // Check if all expected fields match current snapshot
    const nameMatches = currentNpc.name === expected.name;
    const hpMatches = currentNpc.hp === expected.hp;
    const maxHpMatches = currentNpc.maxHp === expected.maxHp;
    const tempHpMatches = currentNpc.tempHp === expected.tempHp;
    const portraitMatches = currentNpc.portrait === expected.portrait;
    const tokenImageMatches = currentNpc.tokenImage === expected.tokenImage;
    const initiativeModifierMatches = currentNpc.initiativeModifier === expected.initiativeModifier;
    const dispositionMatches = currentNpc.disposition === expected.disposition;

    const allFieldsMatch =
      nameMatches &&
      hpMatches &&
      maxHpMatches &&
      tempHpMatches &&
      portraitMatches &&
      tokenImageMatches &&
      initiativeModifierMatches &&
      dispositionMatches;

    if (allFieldsMatch) {
      console.log("[useNpcUpdate] NPC update confirmed:", {
        id: targetNpcId,
        fields: expected,
      });

      // Success! Clear loading state — and the timer, or it outlives us.
      clearTimer();
      setIsUpdating(false);
      setError(null);
      setTargetNpcId(null);
      expectedValuesRef.current = null;
    }
  }, [currentNpc, isUpdating, targetNpcId, clearTimer]);

  /**
   * Initiate NPC update
   */
  const updateNpc = useCallback(
    (id: string, updates: NpcUpdateFields) => {
      if (isUpdating) {
        console.warn("[useNpcUpdate] NPC update already in progress");
        return;
      }

      // Find existing NPC to merge with updates
      const existing = snapshot?.characters?.find((c) => c.id === id && c.type === "npc");
      if (!existing) {
        console.error("[useNpcUpdate] NPC not found:", id);
        setError("NPC not found");
        return;
      }

      console.log("[useNpcUpdate] Starting NPC update:", { id, updates });

      // Calculate final values (merge updates with existing)
      const finalValues = {
        name: updates.name ?? existing.name,
        // A DM's snapshot always carries exact numbers (the redaction is for
        // players), so the trailing fallbacks are type honesty, not a path.
        hp: updates.hp ?? existing.hp ?? 0,
        maxHp: updates.maxHp ?? existing.maxHp ?? 1,
        tempHp: updates.tempHp ?? existing.tempHp,
        portrait: updates.portrait ?? existing.portrait,
        tokenImage: updates.tokenImage ?? existing.tokenImage ?? undefined,
        initiativeModifier: updates.initiativeModifier ?? existing.initiativeModifier,
        // ?? not ||: the merge has to keep a stance the DM set earlier when the
        // edit that triggered this send was about something else entirely.
        // Conditional, like every other writer in this arc: `disposition:
        // undefined` is a KEY, and it is only inert because JSON.stringify
        // happens to drop it. It should not depend on the transport.
        ...((updates.disposition ?? existing.disposition)
          ? { disposition: updates.disposition ?? existing.disposition }
          : {}),
      };

      // Set loading state BEFORE sending message
      setIsUpdating(true);
      setError(null);
      setTargetNpcId(id);
      expectedValuesRef.current = finalValues;

      // Send the update message
      sendMessage({
        t: "update-npc",
        id,
        ...finalValues,
      });

      // Set a timeout in case server doesn't respond
      clearTimer();
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        setIsUpdating((prev) => {
          if (prev) {
            // Only set error if STILL updating
            console.error("[useNpcUpdate] NPC update timed out");
            setError("NPC update timed out. Please try again.");
            setTargetNpcId(null);
            expectedValuesRef.current = null;
            return false;
          }
          return prev;
        });
      }, 5000);
    },
    [isUpdating, sendMessage, snapshot?.characters, clearTimer],
  );

  return {
    isUpdating,
    updateNpc,
    error,
    targetNpcId,
  };
}
