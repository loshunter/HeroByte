// ============================================================================
// BULK INITIATIVE ROLL HOOK
// ============================================================================
// Custom hook for rolling initiative for multiple NPCs at once

import { useState, useCallback } from "react";
import type { Character } from "@shared";

/**
 * Hook for bulk initiative rolling
 *
 * Provides functionality to roll initiative for all NPCs that don't
 * already have an initiative value set.
 *
 * @param npcs - Array of NPC characters
 * @param onSetInitiative - Callback to set initiative for a character
 * @returns Object with rollAllInitiative function and isRolling state
 */
export function useBulkInitiativeRoll(
  npcs: Character[],
  onSetInitiative: (characterId: string, initiative: number, initiativeModifier: number) => void,
) {
  const [isRolling, setIsRolling] = useState(false);

  /**
   * Roll initiative for all NPCs without existing initiative values
   *
   * For each NPC without initiative:
   * - Rolls d20 (1-20)
   * - Adds the NPC's initiative modifier
   * - Sends update to server
   *
   * @returns Promise resolving to the number of NPCs that had initiative rolled
   */
  const rollAllInitiative = useCallback(async (): Promise<number> => {
    // Filter to NPCs without initiative
    const npcsWithoutInitiative = npcs.filter((npc) => npc.initiative === undefined);

    if (npcsWithoutInitiative.length === 0) {
      return 0;
    }

    setIsRolling(true);

    try {
      // Roll for each NPC
      for (const npc of npcsWithoutInitiative) {
        // Roll d20
        const roll = Math.floor(Math.random() * 20) + 1;

        // Get modifier (default to 0 if not set)
        const modifier = npc.initiativeModifier ?? 0;

        // Calculate final initiative
        const finalInitiative = roll + modifier;

        // Send to server
        onSetInitiative(npc.id, finalInitiative, modifier);
      }

      return npcsWithoutInitiative.length;
    } finally {
      setIsRolling(false);
    }
  }, [npcs, onSetInitiative]);

  return {
    rollAllInitiative,
    isRolling,
  };
}
