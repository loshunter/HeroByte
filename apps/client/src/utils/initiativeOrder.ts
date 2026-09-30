// ============================================================================
// INITIATIVE ORDER
// ============================================================================
// The order the SERVER runs a fight in (CharacterService.
// getCharactersInInitiativeOrder): the characters in the order (the shared
// isInInitiativeOrder — may participate AND has rolled), initiative high to
// low, a PC (a player's or the DM's own) before an NPC on a tie, then creation
// order. The client's one spelling of it, so "Turn N of M" says what next-turn
// and previous-turn will do.

import { isInInitiativeOrder } from "@herobyte/shared";
import type { Character, Player } from "@herobyte/shared";

type Ordered = Pick<Character, "id" | "type" | "ownedByPlayerUID" | "initiative">;

export function initiativeOrder<T extends Ordered>(
  characters: readonly T[],
  players: Player[],
): T[] {
  const created = new Map(characters.map((character, index) => [character.id, index]));
  return characters
    .filter((character) => isInInitiativeOrder(character, players))
    .sort((a, b) => {
      const byInitiative = (b.initiative ?? 0) - (a.initiative ?? 0);
      if (byInitiative !== 0) return byInitiative;
      if (a.type === "pc" && b.type === "npc") return -1;
      if (a.type === "npc" && b.type === "pc") return 1;
      return (created.get(a.id) ?? 0) - (created.get(b.id) ?? 0);
    });
}
