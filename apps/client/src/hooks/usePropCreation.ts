/**
 * usePropCreation Hook
 *
 * Manages prop creation with loading state and server confirmation.
 * Monitors the snapshot to detect when a prop has been created by the server,
 * providing loading feedback and preventing the UI from appearing unresponsive.
 *
 * This hook solves the state synchronization issue where clicking "Add Prop"
 * would appear to do nothing until the page was refreshed.
 *
 * @module hooks/usePropCreation
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { RoomSnapshot, ClientMessage } from "@shared";
import type { CameraState } from "./usePropManagement";

export interface UsePropCreationOptions {
  /**
   * Current room snapshot containing all props
   */
  snapshot: RoomSnapshot | null;

  /**
   * Function to send messages to the server
   */
  sendMessage: (message: ClientMessage) => void;

  /**
   * Current camera state for viewport positioning
   */
  cameraState: CameraState;
}

export interface UsePropCreationReturn {
  /**
   * Whether a prop creation is in progress
   */
  isCreating: boolean;

  /**
   * Initiate prop creation with loading state
   */
  createProp: () => void;

  /**
   * Error message if creation failed, null otherwise
   */
  error: string | null;
}

/**
 * Hook to manage prop creation with server confirmation.
 *
 * @example
 * ```tsx
 * const { isCreating, createProp, error } = usePropCreation({
 *   snapshot,
 *   sendMessage,
 *   cameraState
 * });
 *
 * // Create a prop
 * <button onClick={createProp} disabled={isCreating}>
 *   {isCreating ? 'Creating...' : '+ Add Prop'}
 * </button>
 * ```
 */
export function usePropCreation(options: UsePropCreationOptions): UsePropCreationReturn {
  const { snapshot, sendMessage, cameraState } = options;

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track previous prop count to detect creation
  const prevPropCountRef = useRef<number>(0);

  // Update the previous count whenever props change (but not during creation)
  useEffect(() => {
    if (!isCreating) {
      const props = snapshot?.props || [];
      prevPropCountRef.current = props.length;
    }
  }, [snapshot?.props, isCreating]);

  // Monitor snapshot for prop creation
  useEffect(() => {
    if (!isCreating) {
      return;
    }

    const currentProps = snapshot?.props || [];
    const currentCount = currentProps.length;

    // Check if a new prop appeared
    if (currentCount > prevPropCountRef.current) {
      console.log("[usePropCreation] Prop creation confirmed:", {
        previousCount: prevPropCountRef.current,
        currentCount,
      });

      // Success! Update ref and clear loading state
      prevPropCountRef.current = currentCount;
      setIsCreating(false);
      setError(null);
    }
  }, [snapshot?.props, isCreating]);

  /**
   * Initiate prop creation
   */
  const createProp = useCallback(() => {
    if (isCreating) {
      console.warn("[usePropCreation] Prop creation already in progress");
      return;
    }

    console.log("[usePropCreation] Starting prop creation");

    // Set loading state BEFORE sending message
    setIsCreating(true);
    setError(null);

    // Send the creation message
    sendMessage({
      t: "create-prop",
      label: "New Prop",
      imageUrl: "",
      owner: null,
      size: "medium",
      viewport: cameraState,
    });

    // Set a timeout in case server doesn't respond
    setTimeout(() => {
      setIsCreating((prev) => {
        if (prev) {
          // Only set error if STILL creating
          setError("Prop creation timed out. Please try again.");
          return false;
        }
        return prev;
      });
    }, 5000);
  }, [isCreating, sendMessage, cameraState]);

  return {
    isCreating,
    createProp,
    error,
  };
}
