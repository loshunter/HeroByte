/**
 * usePropUpdate Hook
 *
 * Manages Prop updates with loading state and server confirmation.
 * Monitors the snapshot to detect when Prop fields have been updated by the server,
 * providing loading feedback and error handling.
 *
 * This hook solves the fire-and-forget issue where Prop updates are sent to the
 * server without waiting for confirmation, potentially causing race conditions
 * with snapshot updates.
 *
 * @module hooks/usePropUpdate
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { RoomSnapshot, ClientMessage, TokenSize } from "@shared";

export interface UsePropUpdateOptions {
  /**
   * Current room snapshot containing all props
   */
  snapshot: RoomSnapshot | null;

  /**
   * Function to send messages to the server
   */
  sendMessage: (message: ClientMessage) => void;
}

export interface PropUpdateFields {
  label: string;
  imageUrl: string;
  owner: string | null;
  size: TokenSize;
}

export interface UsePropUpdateReturn {
  /**
   * Whether a Prop update is in progress
   */
  isUpdating: boolean;

  /**
   * Initiate Prop update with loading state
   */
  updateProp: (id: string, updates: PropUpdateFields) => void;

  /**
   * Error message if update failed, null otherwise
   */
  error: string | null;

  /**
   * ID of the Prop currently being updated, null if not updating
   */
  targetPropId: string | null;
}

/**
 * Hook to manage Prop updates with server confirmation.
 *
 * @example
 * ```tsx
 * const { isUpdating, updateProp, error, targetPropId } = usePropUpdate({
 *   snapshot,
 *   sendMessage
 * });
 *
 * // Update a Prop
 * updateProp('prop-1', { label: 'Chest', imageUrl: '...', owner: null, size: 'medium' });
 *
 * // Show loading state in UI
 * <button disabled={isUpdating}>
 *   {isUpdating ? 'Updating...' : 'Save Changes'}
 * </button>
 * ```
 */
export function usePropUpdate(options: UsePropUpdateOptions): UsePropUpdateReturn {
  const { snapshot, sendMessage } = options;

  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetPropId, setTargetPropId] = useState<string | null>(null);

  // Track the expected values after update
  const expectedValuesRef = useRef<PropUpdateFields | null>(null);

  // Get current Prop from snapshot
  const currentProp = snapshot?.props?.find((p) => p.id === targetPropId);

  // Monitor snapshot for Prop field changes
  useEffect(() => {
    if (!isUpdating || !targetPropId || !expectedValuesRef.current || !currentProp) {
      return;
    }

    const expected = expectedValuesRef.current;

    // Check if all expected fields match current snapshot
    const labelMatches = currentProp.label === expected.label;
    const imageUrlMatches = currentProp.imageUrl === expected.imageUrl;
    const ownerMatches = currentProp.owner === expected.owner;
    const sizeMatches = currentProp.size === expected.size;

    const allFieldsMatch = labelMatches && imageUrlMatches && ownerMatches && sizeMatches;

    if (allFieldsMatch) {
      console.log("[usePropUpdate] Prop update confirmed:", {
        id: targetPropId,
        fields: expected,
      });

      // Success! Clear loading state
      setIsUpdating(false);
      setError(null);
      setTargetPropId(null);
      expectedValuesRef.current = null;
    }
  }, [currentProp, isUpdating, targetPropId]);

  /**
   * Initiate Prop update
   */
  const updateProp = useCallback(
    (id: string, updates: PropUpdateFields) => {
      if (isUpdating) {
        console.warn("[usePropUpdate] Prop update already in progress");
        return;
      }

      // Find existing Prop to verify it exists
      const existing = snapshot?.props?.find((p) => p.id === id);
      if (!existing) {
        console.error("[usePropUpdate] Prop not found:", id);
        setError("Prop not found");
        return;
      }

      console.log("[usePropUpdate] Starting Prop update:", { id, updates });

      // Set loading state BEFORE sending message
      setIsUpdating(true);
      setError(null);
      setTargetPropId(id);
      expectedValuesRef.current = updates;

      // Send the update message
      sendMessage({
        t: "update-prop",
        id,
        ...updates,
      });

      // Set a timeout in case server doesn't respond
      setTimeout(() => {
        setIsUpdating((prev) => {
          if (prev) {
            // Only set error if STILL updating
            console.error("[usePropUpdate] Prop update timed out");
            setError("Prop update timed out. Please try again.");
            setTargetPropId(null);
            expectedValuesRef.current = null;
            return false;
          }
          return prev;
        });
      }, 5000);
    },
    [isUpdating, sendMessage, snapshot?.props],
  );

  return {
    isUpdating,
    updateProp,
    error,
    targetPropId,
  };
}
