// ============================================================================
// COMBAT UTILITIES
// ============================================================================
// Combat-related business logic shared between client and server.
// Follows SRP: single responsibility for combat participation rules.

import type { Character, Player } from "./index.js";

/**
 * Determine if a character should participate in combat.
 *
 * **Business Rule**: DM players do not participate in combat.
 * Their player characters should be excluded from:
 * - Initiative ordering
 * - Turn tracking
 * - Combat entity counts
 *
 * @param character - The character to check
 * @param players - All players in the session
 * @returns true if the character should participate in combat, false otherwise
 *
 * @example
 * ```ts
 * const char: Character = { id: "1", type: "pc", ownedByPlayerUID: "dm-user-id", ... };
 * const players: Player[] = [{ uid: "dm-user-id", name: "DM", isDM: true }, ...];
 * shouldCharacterParticipateInCombat(char, players); // false
 * ```
 */
export function shouldCharacterParticipateInCombat(
  character: Character,
  players: Player[],
): boolean {
  // NPCs always participate in combat
  if (character.type === "npc") {
    return true;
  }

  // PCs participate unless they're owned by the DM
  // Find the DM player
  const dmPlayer = players.find((p) => p.isDM === true);

  // If there's no DM, all PCs participate
  if (!dmPlayer) {
    return true;
  }

  // Exclude PCs owned by the DM
  return character.ownedByPlayerUID !== dmPlayer.uid;
}

/**
 * Filter characters to only those that should participate in combat.
 *
 * @param characters - All characters to filter
 * @param players - All players in the session
 * @returns Characters eligible for combat
 *
 * @example
 * ```ts
 * const combatEligible = filterCombatEligibleCharacters(allCharacters, allPlayers);
 * ```
 */
export function filterCombatEligibleCharacters(
  characters: Character[],
  players: Player[],
): Character[] {
  return characters.filter((char) => shouldCharacterParticipateInCombat(char, players));
}

/**
 * Check if a character belongs to a DM player.
 *
 * **Use Case**: DM characters should be displayed separately from players/NPCs,
 * but should NOT participate in combat or have tokens on the map.
 *
 * @param character - The character to check
 * @param players - All players in the session
 * @returns true if the character is owned by a DM player
 *
 * @example
 * ```ts
 * const char: Character = { id: "1", type: "pc", ownedByPlayerUID: "dm-user-id", ... };
 * const players: Player[] = [{ uid: "dm-user-id", name: "DM", isDM: true }, ...];
 * isDMCharacter(char, players); // true
 * ```
 */
export function isDMCharacter(character: Character, players: Player[]): boolean {
  // Only PCs can belong to a DM (NPCs don't belong to anyone)
  if (character.type !== "pc") {
    return false;
  }

  // Find the DM player
  const dmPlayer = players.find((p) => p.isDM === true);
  if (!dmPlayer) {
    return false;
  }

  // Check if this character is owned by the DM
  return character.ownedByPlayerUID === dmPlayer.uid;
}
