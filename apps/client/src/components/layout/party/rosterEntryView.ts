// ============================================================================
// ROSTER ENTRY VIEW — what one compact Party row shows
// ============================================================================
// Pure, so the attribution rules are pinned without a DOM. They are the card's
// rules, not new ones: a character's conditions and temporary HP are its own,
// and the legacy player-level values are attributable only to a sole character
// (UX-02, the `ownsSoleCharacter` line useCombatOrdering draws). An NPC whose
// numbers the server withheld stays withheld here too.

import type { HpBadge } from "@herobyte/shared";
import type { EntityInfo } from "../../../hooks/useCombatOrdering";
import { STATUS_OPTIONS } from "../../../features/players/constants/statusOptions";
import { npcDispositionLook } from "../../../features/players/components/npcDisposition";
import { characterColor } from "../../../features/players/playerColors";

export interface RosterCondition {
  emoji: string;
  label: string;
}

export type RosterHp =
  | { kind: "exact"; current: number; max: number; temp?: number }
  | { kind: "redacted"; badge?: HpBadge };

export interface RosterEntryView {
  /** The character's id: the roster selects characters, never seats. */
  characterId: string;
  kind: EntityInfo["kind"];
  name: string;
  portrait?: string;
  /** Portrait ring / placeholder colour: the character's colour, or the NPC's stance. */
  ring: string;
  /**
   * "You", "DM", the NPC's stance ("Enemy", "Ally", "Neutral"), or — for another
   * player's character named differently from their seat — the seat's name, so
   * a DM can tell whose "Companion" this is (the phone groups rows by seat).
   */
  tag: string | null;
  hp: RosterHp;
  conditions: RosterCondition[];
  initiative?: number;
  isCurrentTurn: boolean;
  isMe: boolean;
  /** The token Focus centres on; absent when the character has none. */
  focusTokenId?: string;
  /** DM view only: an NPC hidden from the players. */
  hiddenFromPlayers: boolean;
}

const DEFAULT_RING = "#5AFFAD";

function conditionsOf(values: readonly string[] | undefined): RosterCondition[] {
  return (values ?? []).map((value) => {
    const option = STATUS_OPTIONS.find((candidate) => candidate.value === value);
    return option ? { emoji: option.emoji, label: option.label } : { emoji: "", label: value };
  });
}

export function rosterEntryView(entity: EntityInfo): RosterEntryView {
  const { character, player, token, ownsSoleCharacter } = entity;

  if (entity.kind === "npc") {
    const look = npcDispositionLook(character.disposition);
    const exact = character.hp !== undefined && character.maxHp !== undefined;
    return {
      characterId: character.id,
      kind: "npc",
      name: character.name,
      portrait: character.portrait ?? undefined,
      ring: look.ring,
      tag: look.label,
      hp: exact
        ? {
            kind: "exact",
            current: character.hp as number,
            max: character.maxHp as number,
            temp: character.tempHp,
          }
        : { kind: "redacted", badge: character.hpBadge },
      conditions: conditionsOf(character.statusEffects),
      initiative: character.initiative,
      isCurrentTurn: entity.isCurrentTurn,
      isMe: false,
      // The token on the map; one left on another scene is not focusable.
      focusTokenId: token?.id,
      hiddenFromPlayers: character.visibleToPlayers === false,
    };
  }

  const legacy = ownsSoleCharacter ? player : undefined;
  return {
    characterId: character.id,
    kind: entity.kind,
    name: character.name,
    portrait: character.portrait ?? legacy?.portrait ?? undefined,
    // The record's colour first: fog drops a party member's token out of sight, never the record.
    ring: characterColor(character, token) ?? DEFAULT_RING,
    tag: entity.isMe
      ? "You"
      : player?.isDM
        ? "DM"
        : player && player.name !== character.name
          ? player.name
          : null,
    hp: {
      kind: "exact",
      current: character.hp ?? 100,
      max: character.maxHp ?? 100,
      temp: character.tempHp ?? legacy?.tempHp,
    },
    conditions: conditionsOf(character.statusEffects ?? legacy?.statusEffects),
    initiative: character.initiative,
    isCurrentTurn: entity.isCurrentTurn,
    isMe: entity.isMe,
    focusTokenId: token?.id,
    hiddenFromPlayers: false,
  };
}
