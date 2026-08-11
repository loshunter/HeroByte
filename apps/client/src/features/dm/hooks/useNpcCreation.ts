/**
 * useNpcCreation Hook
 *
 * Manages NPC creation with loading state and server confirmation.
 * Monitors the snapshot to detect when an NPC has been created by the server,
 * providing loading feedback and preventing the UI from appearing unresponsive.
 *
 * This hook solves the state synchronization issue where clicking "Add NPC"
 * would appear to do nothing until the page was refreshed.
 *
 * @module hooks/useNpcCreation
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { RoomSnapshot, ClientMessage } from "@herobyte/shared";

export interface UseNpcCreationOptions {
  /**
   * Current room snapshot containing all characters (including NPCs)
   */
  snapshot: RoomSnapshot | null;

  /**
   * Function to send messages to the server
   */
  sendMessage: (message: ClientMessage) => void;
}

/**
 * What to create. Everything is optional: the plain "+ Add NPC" button passes
 * nothing and gets the historic default NPC.
 */
export interface CreateNpcRequest {
  /** Base name. The SERVER numbers it — see domains/character/npcNaming.ts. */
  name?: string;
  hp?: number;
  maxHp?: number;
  portrait?: string;
  tokenImage?: string;
  /** How many to create (1..NPC_CREATE_LIMITS.COUNT_MAX). Defaults to 1. */
  count?: number;
  /** Carried by Duplicate so a hidden NPC's copy stays hidden. */
  visibleToPlayers?: boolean;
}

export interface UseNpcCreationReturn {
  /**
   * Whether an NPC creation is in progress
   */
  isCreating: boolean;

  /**
   * Initiate NPC creation with loading state
   */
  createNpc: (request?: CreateNpcRequest) => void;

  /**
   * Error message if creation failed, null otherwise
   */
  error: string | null;
}

/**
 * Hook to manage NPC creation with server confirmation.
 *
 * @example
 * ```tsx
 * const { isCreating, createNpc, error } = useNpcCreation({
 *   snapshot,
 *   sendMessage
 * });
 *
 * // Create an NPC
 * <button onClick={createNpc} disabled={isCreating}>
 *   {isCreating ? 'Creating...' : '+ Add NPC'}
 * </button>
 * ```
 */
export function useNpcCreation(options: UseNpcCreationOptions): UseNpcCreationReturn {
  const { snapshot, sendMessage } = options;

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track previous NPC count to detect creation
  const prevNpcCountRef = useRef<number>(0);

  // Update the previous count whenever NPCs change (but not during creation)
  useEffect(() => {
    if (!isCreating) {
      const npcs = snapshot?.characters?.filter((c) => c.type === "npc") || [];
      prevNpcCountRef.current = npcs.length;
    }
  }, [snapshot?.characters, isCreating]);

  // Monitor snapshot for NPC creation
  useEffect(() => {
    if (!isCreating) {
      return;
    }

    const currentNpcs = snapshot?.characters?.filter((c) => c.type === "npc") || [];
    const currentCount = currentNpcs.length;

    // Check if a new NPC appeared
    if (currentCount > prevNpcCountRef.current) {
      console.log("[useNpcCreation] NPC creation confirmed:", {
        previousCount: prevNpcCountRef.current,
        currentCount,
      });

      // Success! Update ref and clear loading state
      prevNpcCountRef.current = currentCount;
      setIsCreating(false);
      setError(null);
    }
  }, [snapshot?.characters, isCreating]);

  /**
   * Initiate NPC creation
   */
  const createNpc = useCallback(
    (request?: CreateNpcRequest) => {
      if (isCreating) {
        console.warn("[useNpcCreation] NPC creation already in progress");
        return;
      }

      console.log("[useNpcCreation] Starting NPC creation");

      // Set loading state BEFORE sending message
      setIsCreating(true);
      setError(null);

      // ONE message however many NPCs are wanted, because this hook refuses to
      // run a second create while one is in flight and detects success by
      // watching the character count. N separate messages would be dropped by
      // that guard on the way out; a server-side loop lands as a single count
      // jump, which the watcher above already handles.
      sendMessage({
        t: "create-npc",
        name: request?.name ?? "New NPC",
        hp: request?.hp ?? 10,
        maxHp: request?.maxHp ?? 10,
        ...(request?.portrait !== undefined ? { portrait: request.portrait } : {}),
        ...(request?.tokenImage !== undefined ? { tokenImage: request.tokenImage } : {}),
        ...(request?.count !== undefined ? { count: request.count } : {}),
        ...(request?.visibleToPlayers !== undefined
          ? { visibleToPlayers: request.visibleToPlayers }
          : {}),
      });

      // Set a timeout in case server doesn't respond
      setTimeout(() => {
        setIsCreating((prev) => {
          if (prev) {
            // Only set error if STILL creating
            setError("NPC creation timed out. Please try again.");
            return false;
          }
          return prev;
        });
      }, 5000);
    },
    [isCreating, sendMessage],
  );

  return {
    isCreating,
    createNpc,
    error,
  };
}
