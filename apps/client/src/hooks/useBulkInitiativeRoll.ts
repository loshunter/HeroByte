// ============================================================================
// BULK INITIATIVE ROLL HOOK
// ============================================================================
// Asks the server to roll initiative for every NPC that still needs one

import { useCallback } from "react";
import type { SnapshotCharacter } from "@herobyte/shared";

/**
 * Hook for bulk initiative rolling
 *
 * Sends ONE `roll-initiative-all`; the server loops. This replaced a client
 * loop that sent a `set-initiative` per NPC — the server allows 100 messages
 * per client per second and DROPS the rest silently, so a big enough encounter
 * left its tail without initiative while the toast reported the full count.
 * That loop was bounded not by the ×20 add ceiling but by however many NPCs
 * lacked initiative, which the 500-character room limit puts as high as 500.
 * The batching constants that mitigated it are gone with the sends themselves.
 *
 * Rolling here also stops the client inventing the numbers: the server throws
 * on the same generator dice use, and every NPC gets its own named line in the
 * public roll log.
 *
 * THE RETURNED COUNT IS THE CLIENT'S VIEW. It counts the NPCs this snapshot
 * shows without an initiative, using the same predicate the server applies, and
 * it is read before the message goes out. The server is the authority and can
 * legitimately roll a different number from a staler or fresher state. The
 * count feeds a toast; the roll log carries the truth. Returning a real count
 * from the server would need a new ServerMessage variant — none carries one —
 * for a line of confirmation text.
 *
 * @param npcs - Array of NPC characters
 * @param onRollAllInitiative - Sends the roll-initiative-all message
 * @returns Object with rollAllInitiative, returning how many were asked for
 */
export function useBulkInitiativeRoll(npcs: SnapshotCharacter[], onRollAllInitiative: () => void) {
  const rollAllInitiative = useCallback((): number => {
    const npcsWithoutInitiative = npcs.filter((npc) => npc.initiative === undefined);

    if (npcsWithoutInitiative.length === 0) {
      // Nothing to ask for, so do not ask. The caller distinguishes this from a
      // successful sweep by the count, and shows the DM a different message.
      return 0;
    }

    onRollAllInitiative();

    return npcsWithoutInitiative.length;
  }, [npcs, onRollAllInitiative]);

  return {
    rollAllInitiative,
  };
}
