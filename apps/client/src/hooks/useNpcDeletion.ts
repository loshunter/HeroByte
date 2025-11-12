/**
 * useNpcDeletion Hook
 *
 * Manages NPC deletion with loading state and server confirmation.
 * Monitors the snapshot to detect when an NPC has been deleted by the server,
 * providing loading feedback and preventing the UI from closing prematurely.
 *
 * This hook solves the state synchronization issue where the NPC settings menu
 * would stay open after deletion, requiring a page refresh to see the result.
 *
 * @module hooks/useNpcDeletion
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { RoomSnapshot, ClientMessage } from "@shared";

export interface UseNpcDeletionOptions {
  /**
   * Current room snapshot containing all characters (including NPCs)
   */
  snapshot: RoomSnapshot | null;

  /**
   * Function to send messages to the server
   */
  sendMessage: (message: ClientMessage) => void;
}

export interface UseNpcDeletionReturn {
  /**
   * Whether an NPC deletion is in progress
   */
  isDeleting: boolean;

  /**
   * Initiate NPC deletion with loading state
   */
  deleteNpc: (id: string) => void;

  /**
   * Error message if deletion failed, null otherwise
   */
  error: string | null;
}

/**
 * Hook to manage NPC deletion with server confirmation.
 *
 * @example
 * ```tsx
 * const { isDeleting, deleteNpc, error } = useNpcDeletion({
 *   snapshot,
 *   sendMessage
 * });
 *
 * // Delete an NPC
 * deleteNpc('npc-1');
 *
 * // Show loading state in UI
 * <button disabled={isDeleting}>
 *   {isDeleting ? 'Deleting...' : 'Delete NPC'}
 * </button>
 * ```
 */
export function useNpcDeletion(options: UseNpcDeletionOptions): UseNpcDeletionReturn {
  const { snapshot, sendMessage } = options;

  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetNpcId, setTargetNpcId] = useState<string | null>(null);

  // Track previous NPC IDs to detect deletion
  const prevNpcIdsRef = useRef<Set<string>>(new Set());

  // Update the previous NPC IDs when not deleting
  useEffect(() => {
    if (!isDeleting) {
      const npcs = snapshot?.characters?.filter((c) => c.type === "npc") || [];
      prevNpcIdsRef.current = new Set(npcs.map((c) => c.id));
    }
  }, [snapshot?.characters, isDeleting]);

  // Monitor snapshot for NPC deletion
  useEffect(() => {
    if (!isDeleting || !targetNpcId) {
      return;
    }

    const currentNpcs = snapshot?.characters?.filter((c) => c.type === "npc") || [];
    const npcExists = currentNpcs.some((c) => c.id === targetNpcId);

    // Check if the NPC was successfully deleted
    if (!npcExists) {
      console.log("[useNpcDeletion] NPC deletion confirmed:", {
        id: targetNpcId,
      });

      // Success! Clear loading state
      setIsDeleting(false);
      setError(null);
      setTargetNpcId(null);

      // Update the ref for next time
      prevNpcIdsRef.current = new Set(currentNpcs.map((c) => c.id));
    }
  }, [snapshot?.characters, isDeleting, targetNpcId]);

  /**
   * Initiate NPC deletion
   */
  const deleteNpc = useCallback(
    (id: string) => {
      if (isDeleting) {
        console.warn("[useNpcDeletion] NPC deletion already in progress");
        return;
      }

      console.log("[useNpcDeletion] Starting NPC deletion:", id);

      // Set loading state BEFORE sending message
      setIsDeleting(true);
      setError(null);
      setTargetNpcId(id);

      // Send the deletion message
      sendMessage({ t: "delete-npc", id });

      // Set a timeout in case server doesn't respond
      setTimeout(() => {
        setIsDeleting((prev) => {
          if (prev) {
            // Only set error if STILL deleting
            setError("NPC deletion timed out. Please try again.");
            setTargetNpcId(null);
            return false;
          }
          return prev;
        });
      }, 5000);
    },
    [isDeleting, sendMessage],
  );

  return {
    isDeleting,
    deleteNpc,
    error,
  };
}
