// ============================================================================
// TOKEN PLATE DATA (S4)
// ============================================================================
// Pure mapping from snapshot collections to per-token nameplate data, out of
// MapBoard so the rules are unit-testable (the adversarial review found the
// e2e alone could not discriminate them):
//
//   - A token linked to a character wears the CHARACTER's name — token.owner
//     would put the DM's name under every monster.
//   - Only an UNLINKED token falls back to its owner player's name.
//   - The player lens simulates the server's NPC redaction with the SAME
//     shared hpBadgeFor the recipient filter uses, so a DM previews exactly
//     what players receive.

import {
  hpBadgeFor,
  movementBudgetFor,
  shouldCharacterParticipateInCombat,
  type MonsterHpDisplay,
  type MovementBudget,
  type Player,
  type SnapshotCharacter,
  type Token,
} from "@herobyte/shared";
import type { TokenPlateData } from "./components/TokenNameplate";

/** "15 / 30 ft" — what is LEFT over what the turn started with. Pure, so it is pinned without Konva. */
export function movementReadout(move: MovementBudget): string {
  return `${move.remaining} / ${move.speed} ft`;
}

export function buildTokenPlates(input: {
  characters: SnapshotCharacter[];
  tokens: Token[];
  players: Player[];
  monsterHpDisplay: MonsterHpDisplay;
  /** True when a DM is previewing the player view (player lens). */
  lensRedact: boolean;
  /** Combat on: combatants in the order wear their movement budget. */
  combatActive?: boolean;
  /** The viewer is the DM: an NPC's budget is theirs to see (never a player's). */
  isDM?: boolean;
}): Record<string, TokenPlateData> {
  const { characters, tokens, players, monsterHpDisplay, lensRedact, combatActive, isDM } = input;
  const result: Record<string, TokenPlateData> = {};

  for (const character of characters) {
    if (!character.tokenId) continue;
    let { hp, maxHp, hpBadge } = character;
    if (
      lensRedact &&
      character.type === "npc" &&
      monsterHpDisplay !== "exact" &&
      hp !== undefined &&
      maxHp !== undefined
    ) {
      hpBadge = monsterHpDisplay === "bloodied" ? hpBadgeFor(hp, maxHp) : undefined;
      hp = undefined;
      maxHp = undefined;
    }
    // The budget rides only on a COMBATANT — in the order, and one a turn can
    // land on (a DM-owned PC is not, by the participation rule, so it would
    // never reset) — while combat is on. An NPC's is DM information: the
    // server strips it from a player's frame and the DM's player lens hides
    // it the same way, so a redacted monster never shows a fake default.
    const inOrder =
      combatActive === true &&
      character.initiative !== undefined &&
      shouldCharacterParticipateInCombat(character, players);
    // A monster's readout needs a REAL record: the DM's frame carries one for
    // every monster in a fight (reset at combat start, or born into it), and
    // during the elevation blip — role flipped, snapshot still the player's —
    // a missing record shows nothing rather than a fabricated default.
    const budgetVisible =
      character.type === "pc" ||
      (isDM === true && !lensRedact && character.movementUsed !== undefined);
    const move = inOrder && budgetVisible ? movementBudgetFor(character) : undefined;
    result[`token:${character.tokenId}`] = { name: character.name, hp, maxHp, hpBadge, move };
  }

  for (const token of tokens) {
    const key = `token:${token.id}`;
    if (result[key]) continue;
    const owner = players.find((player) => player.uid === token.owner);
    if (owner) result[key] = { name: owner.name };
  }

  return result;
}
