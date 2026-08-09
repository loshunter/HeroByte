// ============================================================================
// BULK INITIATIVE ROLL HOOK
// ============================================================================
// Custom hook for rolling initiative for multiple NPCs at once

import { useState, useCallback } from "react";
import type { SnapshotCharacter } from "@herobyte/shared";

/**
 * How many set-initiative messages to send before pausing for the rate limiter.
 *
 * The server allows 100 messages per client per second (middleware/rateLimit.ts)
 * and DROPS the rest — silently, because onInvalidMessage has no production
 * wiring, so the client is never told. This loop is NOT bounded by the ×N add
 * ceiling of 20; it is bounded by however many NPCs lack initiative, which the
 * 500-character room limit puts as high as 500. Firing them all in one tick
 * meant the overflow simply never got initiative, while the toast cheerfully
 * reported the full count.
 *
 * 80 leaves headroom for the heartbeat and whatever else the client is saying.
 * Below that — which is every ordinary encounter, including a full ×20 batch —
 * nothing waits and behaviour is exactly as before.
 */
const RATE_LIMIT_SAFE_BATCH = 80;

/** The limiter's window is 1000ms; a little over it avoids straddling the edge. */
const RATE_LIMIT_WINDOW_MS = 1100;

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
  npcs: SnapshotCharacter[],
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
      for (const [index, npc] of npcsWithoutInitiative.entries()) {
        // Pause between batches so the server's limiter does not discard the
        // tail. Only reached past RATE_LIMIT_SAFE_BATCH, so the common case
        // never yields at all.
        if (index > 0 && index % RATE_LIMIT_SAFE_BATCH === 0) {
          await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_WINDOW_MS));
        }

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
