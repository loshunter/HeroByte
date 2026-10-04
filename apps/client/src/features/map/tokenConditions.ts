// ============================================================================
// TOKEN CONDITIONS — which condition badges each token wears
// ============================================================================
// Tokens link to characters through `character.tokenId`; the badges are that
// character's conditions. A per-player list also exists and predates
// characters (the write path still mirrors a player's own character onto it).
//
// The cards' rule (UX-02), so the token and its card agree: the character's
// own list wins, an explicitly EMPTY one included (a DM's clear sends only the
// character's list); the per-player list answers only for a player's SOLE pc,
// because with two it is a sibling's at least half the time.

import type { Player, SnapshotCharacter } from "@herobyte/shared";
import { STATUS_OPTIONS, type StatusOption } from "../players/constants/statusOptions";

/** Condition badges keyed by scene-object id (`token:<id>`). */
export function conditionsByTokenId(
  characters: readonly SnapshotCharacter[],
  players: readonly Player[],
): Record<string, StatusOption[]> {
  const playerStatusMap = new Map<string, string[]>();
  for (const player of players) {
    if (player.statusEffects && player.statusEffects.length > 0) {
      playerStatusMap.set(player.uid, player.statusEffects);
    }
  }
  const pcCount = new Map<string, number>();
  for (const character of characters) {
    if (character.type !== "pc" || !character.ownedByPlayerUID) continue;
    pcCount.set(character.ownedByPlayerUID, (pcCount.get(character.ownedByPlayerUID) ?? 0) + 1);
  }

  const result: Record<string, StatusOption[]> = {};
  for (const character of characters) {
    if (!character.tokenId) continue;

    const owner = character.ownedByPlayerUID;
    const soleCharacter = character.type === "pc" && !!owner && pcCount.get(owner) === 1;
    const ownedStatuses =
      character.statusEffects ?? (soleCharacter && owner ? (playerStatusMap.get(owner) ?? []) : []);

    if (ownedStatuses.length === 0) continue;

    const mapped = ownedStatuses.map((value) => {
      const option = STATUS_OPTIONS.find((opt) => opt.value === value);
      return option ?? { value, label: value, emoji: "?" };
    });

    result[`token:${character.tokenId}`] = mapped;
  }
  return result;
}
