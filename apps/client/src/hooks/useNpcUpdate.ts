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
import type { RoomSnapshot, ClientMessage } from "@shared";

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
  portrait?: string | null;
  tokenImage?: string | null;
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
    portrait?: string;
    tokenImage?: string | null;
  } | null>(null);

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
    const portraitMatches = currentNpc.portrait === expected.portrait;
    const tokenImageMatches = currentNpc.tokenImage === expected.tokenImage;

    const allFieldsMatch =
      nameMatches && hpMatches && maxHpMatches && portraitMatches && tokenImageMatches;

    if (allFieldsMatch) {
      console.log("[useNpcUpdate] NPC update confirmed:", {
        id: targetNpcId,
        fields: expected,
      });

      // Success! Clear loading state
      setIsUpdating(false);
      setError(null);
      setTargetNpcId(null);
      expectedValuesRef.current = null;
    }
  }, [currentNpc, isUpdating, targetNpcId]);

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
        hp: updates.hp ?? existing.hp,
        maxHp: updates.maxHp ?? existing.maxHp,
        portrait: updates.portrait ?? existing.portrait,
        tokenImage: updates.tokenImage ?? existing.tokenImage ?? undefined,
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
      setTimeout(() => {
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
    [isUpdating, sendMessage, snapshot?.characters],
  );

  return {
    isUpdating,
    updateNpc,
    error,
    targetNpcId,
  };
}
