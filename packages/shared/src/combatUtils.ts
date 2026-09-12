// ============================================================================
// COMBAT UTILITIES
// ============================================================================
// Combat-related business logic shared between client and server.
// Follows SRP: single responsibility for combat participation rules.

import type { Character, Player } from "./index.js";

/**
 * Determine if a character should participate in combat.
 *
 * **Business Rule**: a player's character and every NPC participate; the
 * DM's OWN character participates once it has an initiative (F3 of the
 * keyboard-movement arc, the owner's call: the DM runs everything that is
 * not a player — a villain, an ally, an ally in disguise — so a character
 * the DM rolled into the fight takes its place in the order, gets turns,
 * wears a plate budget, and has that budget refilled at its turn start).
 * Without a roll it stays out of the order, like a monster that has not
 * rolled — the DM's bench.
 *
 * This is the ONE home of the rule, but note what it decides: "may this
 * character be in a fight", not "is it in the order". Membership of the
 * ORDER is isInInitiativeOrder below (this rule AND an initiative), which is
 * what the server's order, the plates and the reset controls read; the party
 * panel's ordering hook reads this rule alone — its eligibility lists carry
 * unrolled players and NPCs at the bottom of the grid (pre-existing), and its
 * bench split is where the DM clause is load-bearing on its own.
 *
 * Owned by ANY DM (a co-DM's character is the DM's too — the panel groups
 * on `player.isDM`, and the rule must agree with the grouping or a co-DM's
 * character falls between the two).
 *
 * @param character - The character to check
 * @param players - All players in the session
 * @returns true if the character should participate in combat, false otherwise
 *
 * @example
 * ```ts
 * const char: Character = { id: "1", type: "pc", ownedByPlayerUID: "dm-user-id", ... };
 * const players: Player[] = [{ uid: "dm-user-id", name: "DM", isDM: true }, ...];
 * shouldCharacterParticipateInCombat(char, players); // false — no initiative
 * shouldCharacterParticipateInCombat({ ...char, initiative: 12 }, players); // true
 * ```
 */
export function shouldCharacterParticipateInCombat(
  // Only these fields matter, and taking a Pick lets both the full domain
  // Character and the wire SnapshotCharacter (hp possibly redacted) qualify.
  character: Pick<Character, "type" | "ownedByPlayerUID" | "initiative">,
  players: Player[],
): boolean {
  // NPCs always participate in combat
  if (character.type === "npc") {
    return true;
  }

  // A player's PC always participates (no DM at the table: everyone's is)
  const ownedByADM = players.some((p) => p.isDM === true && p.uid === character.ownedByPlayerUID);
  if (!ownedByADM) {
    return true;
  }

  // A DM's own character: in the fight once rolled, on the bench until then
  return character.initiative !== undefined;
}

/**
 * Is this character IN the initiative order: it may participate, and it has
 * rolled. The one spelling of "in the order" its shared readers use — the
 * server's order, the token plates, the reset controls and the party panel's
 * bench split — so a future exclusion added to shouldCharacterParticipateInCombat
 * reaches every one of them through here (the turn banner's denominator
 * filters the already-rule-filtered order by a bare roll, so it follows too).
 * Today the two conjuncts coincide for a DM-owned character (the rule IS
 * "rolled" for it) and the rule admits every other rolled character, so the
 * rule conjunct is a no-op — this helper exists so that stays true by
 * construction rather than by the five restatements that used to spell it
 * (four now read this helper; the fifth, the panel's bench site, is the
 * spend clause alone).
 */
export function isInInitiativeOrder(
  character: Pick<Character, "type" | "ownedByPlayerUID" | "initiative">,
  players: Player[],
): boolean {
  return (
    character.initiative !== undefined && shouldCharacterParticipateInCombat(character, players)
  );
}

/**
 * Filter characters to only those that should participate in combat.
 *
 * No production caller today (a barrel export); kept as the shared spelling.
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
 * Check if a character belongs to a DM player (ANY DM, like the rule above).
 *
 * No production caller today: the party panel groups on `player.isDM`
 * directly (useCombatOrdering). Kept as the shared spelling of the question;
 * if you reach for it, make sure it agrees with that grouping.
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
  return players.some((p) => p.isDM === true && p.uid === character.ownedByPlayerUID);
}
