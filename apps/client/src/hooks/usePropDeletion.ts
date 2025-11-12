import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, RoomSnapshot } from "@shared/index";

export interface UsePropDeletionOptions {
  snapshot: RoomSnapshot | null;
  sendMessage: (message: ClientMessage) => void;
}

export interface UsePropDeletionReturn {
  isDeleting: boolean;
  deleteProp: (id: string) => void;
  error: string | null;
  deletingPropId: string | null;
}

/**
 * Hook to manage prop deletion with server confirmation.
 *
 * Provides loading and error states for prop deletion operations.
 * Monitors the snapshot to detect when a prop has been successfully deleted.
 *
 * @example
 * ```tsx
 * const { isDeleting, deleteProp, error } = usePropDeletion({
 *   snapshot,
 *   sendMessage
 * });
 *
 * // In UI:
 * <button onClick={() => deleteProp(propId)} disabled={isDeleting}>
 *   {isDeleting ? "Deleting..." : "Delete Prop"}
 * </button>
 * {error && <div>{error}</div>}
 * ```
 */
export function usePropDeletion(options: UsePropDeletionOptions): UsePropDeletionReturn {
  const { snapshot, sendMessage } = options;

  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetPropId, setTargetPropId] = useState<string | null>(null);

  // Track previous prop IDs to detect deletion
  const prevPropIdsRef = useRef<Set<string>>(new Set());

  // Update the previous prop IDs when not deleting
  useEffect(() => {
    if (!isDeleting) {
      const props = snapshot?.props || [];
      prevPropIdsRef.current = new Set(props.map((p) => p.id));
    }
  }, [snapshot?.props, isDeleting]);

  // Monitor snapshot for prop deletion
  useEffect(() => {
    if (!isDeleting || !targetPropId) {
      return;
    }

    const currentProps = snapshot?.props || [];
    const propExists = currentProps.some((p) => p.id === targetPropId);

    // Check if the prop was successfully deleted
    if (!propExists) {
      console.log("[usePropDeletion] Prop deletion confirmed:", {
        id: targetPropId,
      });

      // Success! Clear loading state
      setIsDeleting(false);
      setError(null);
      setTargetPropId(null);

      // Update the ref for next time
      prevPropIdsRef.current = new Set(currentProps.map((p) => p.id));
    }
  }, [snapshot?.props, isDeleting, targetPropId]);

  /**
   * Initiate prop deletion
   */
  const deleteProp = useCallback(
    (id: string) => {
      if (isDeleting) {
        console.warn("[usePropDeletion] Prop deletion already in progress");
        return;
      }

      console.log("[usePropDeletion] Starting prop deletion:", id);

      // Set loading state BEFORE sending message
      setIsDeleting(true);
      setError(null);
      setTargetPropId(id);

      // Send the deletion message
      sendMessage({ t: "delete-prop", id });

      // Set a timeout in case server doesn't respond
      setTimeout(() => {
        setIsDeleting((prev) => {
          if (prev) {
            // Only set error if STILL deleting
            setError("Prop deletion timed out. Please try again.");
            setTargetPropId(null);
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
    deleteProp,
    error,
    deletingPropId: targetPropId,
  };
}
