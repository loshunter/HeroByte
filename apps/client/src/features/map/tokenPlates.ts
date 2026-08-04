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
  type MonsterHpDisplay,
  type Player,
  type SnapshotCharacter,
  type Token,
} from "@herobyte/shared";
import type { TokenPlateData } from "./components/TokenNameplate";

export function buildTokenPlates(input: {
  characters: SnapshotCharacter[];
  tokens: Token[];
  players: Player[];
  monsterHpDisplay: MonsterHpDisplay;
  /** True when a DM is previewing the player view (player lens). */
  lensRedact: boolean;
}): Record<string, TokenPlateData> {
  const { characters, tokens, players, monsterHpDisplay, lensRedact } = input;
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
    result[`token:${character.tokenId}`] = { name: character.name, hp, maxHp, hpBadge };
  }

  for (const token of tokens) {
    const key = `token:${token.id}`;
    if (result[key]) continue;
    const owner = players.find((player) => player.uid === token.owner);
    if (owner) result[key] = { name: owner.name };
  }

  return result;
}
