/**
 * useNpcManagement Hook
 *
 * Handles all NPC CRUD operations (Create, Read, Update, Delete).
 * Manages NPC creation, updates, deletion, and token placement.
 *
 * Extracted from: apps/client/src/ui/App.tsx (lines 401-451)
 * Extraction date: 2025-10-20
 *
 * @module hooks/useNpcManagement
 */

import { useCallback } from "react";
import type { ClientMessage, RoomSnapshot } from "@shared";

/**
 * Parameters for useNpcManagement hook
 */
export interface UseNpcManagementParams {
  /**
   * Function to send messages to the server
   */
  sendMessage: (message: ClientMessage) => void;

  /**
   * Current room snapshot containing all NPCs
   */
  snapshot: RoomSnapshot | null;
}

/**
 * Return value from useNpcManagement hook
 */
export interface UseNpcManagementReturn {
  /**
   * Create a new NPC with default values
   */
  handleCreateNPC: () => void;

  /**
   * Update an existing NPC's properties
   * @param id - NPC character ID
   * @param updates - Partial updates to apply to the NPC
   */
  handleUpdateNPC: (
    id: string,
    updates: Partial<{
      name?: string;
      hp?: number;
      maxHp?: number;
      portrait?: string | null;
      tokenImage?: string | null;
    }>,
  ) => void;

  /**
   * Delete an NPC
   * @param id - NPC character ID
   */
  handleDeleteNPC: (id: string) => void;

  /**
   * Place an NPC's token on the map
   * @param id - NPC character ID
   */
  handlePlaceNPCToken: (id: string) => void;
}

/**
 * Hook for managing NPC operations
 *
 * Provides handlers for creating, updating, deleting, and placing NPC tokens.
 * All operations are sent to the server via sendMessage.
 *
 * @example
 * ```tsx
 * const npcHandlers = useNpcManagement({
 *   sendMessage,
 *   snapshot
 * });
 *
 * // Create a new NPC
 * npcHandlers.handleCreateNPC();
 *
 * // Update an NPC's name
 * npcHandlers.handleUpdateNPC('npc-1', { name: 'Goblin Leader' });
 *
 * // Delete an NPC
 * npcHandlers.handleDeleteNPC('npc-1');
 *
 * // Place NPC token on map
 * npcHandlers.handlePlaceNPCToken('npc-1');
 * ```
 *
 * @param params - Hook parameters
 * @returns NPC management handlers
 */
export function useNpcManagement(params: UseNpcManagementParams): UseNpcManagementReturn {
  const { sendMessage, snapshot } = params;

  /**
   * Create a new NPC with default values (name: "New NPC", hp: 10, maxHp: 10)
   */
  const handleCreateNPC = useCallback(() => {
    sendMessage({ t: "create-npc", name: "New NPC", hp: 10, maxHp: 10 });
  }, [sendMessage]);

  /**
   * Update an existing NPC's properties
   * Merges updates with existing NPC values
   * Does nothing if NPC is not found in snapshot
   */
  const handleUpdateNPC = useCallback(
    (
      id: string,
      updates: Partial<{
        name: string;
        hp: number;
        maxHp: number;
        portrait?: string;
        tokenImage?: string;
      }>,
    ) => {
      const existing = snapshot?.characters?.find((character) => character.id === id);
      if (!existing) return;

      sendMessage({
        t: "update-npc",
        id,
        name: updates.name ?? existing.name,
        hp: updates.hp ?? existing.hp,
        maxHp: updates.maxHp ?? existing.maxHp,
        portrait: updates.portrait ?? existing.portrait,
        tokenImage: updates.tokenImage ?? existing.tokenImage ?? undefined,
      });
    },
    [sendMessage, snapshot?.characters],
  );

  /**
   * Delete an NPC by ID
   */
  const handleDeleteNPC = useCallback(
    (id: string) => {
      sendMessage({ t: "delete-npc", id });
    },
    [sendMessage],
  );

  /**
   * Place an NPC's token on the map
   */
  const handlePlaceNPCToken = useCallback(
    (id: string) => {
      sendMessage({ t: "place-npc-token", id });
    },
    [sendMessage],
  );

  return {
    handleCreateNPC,
    handleUpdateNPC,
    handleDeleteNPC,
    handlePlaceNPCToken,
  };
}
