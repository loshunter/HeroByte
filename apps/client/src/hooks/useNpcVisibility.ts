/**
 * useNpcVisibility Hook
 *
 * Provides a function to toggle NPC visibility for players.
 * DMs can hide/show NPCs, which removes them from player views (both tokens and entity cards).
 *
 * @module hooks/useNpcVisibility
 */

import { useCallback } from "react";
import type { ClientMessage } from "@shared";

export interface UseNpcVisibilityOptions {
  /**
   * Function to send messages to the server
   */
  sendMessage: (message: ClientMessage) => void;
}

export interface UseNpcVisibilityReturn {
  /**
   * Toggle NPC visibility for players
   * @param npcId - ID of the NPC to toggle
   * @param visible - Whether the NPC should be visible to players
   */
  toggleNpcVisibility: (npcId: string, visible: boolean) => void;
}

/**
 * Hook to manage NPC visibility toggles.
 *
 * @example
 * ```tsx
 * const { toggleNpcVisibility } = useNpcVisibility({ sendMessage });
 *
 * // Hide an NPC from players
 * toggleNpcVisibility('npc-1', false);
 *
 * // Show an NPC to players
 * toggleNpcVisibility('npc-1', true);
 * ```
 */
export function useNpcVisibility(options: UseNpcVisibilityOptions): UseNpcVisibilityReturn {
  const { sendMessage } = options;

  const toggleNpcVisibility = useCallback(
    (npcId: string, visible: boolean) => {
      console.log("[useNpcVisibility] Toggling NPC visibility:", { npcId, visible });

      sendMessage({
        t: "toggle-npc-visibility",
        id: npcId,
        visible,
      });
    },
    [sendMessage],
  );

  return {
    toggleNpcVisibility,
  };
}
