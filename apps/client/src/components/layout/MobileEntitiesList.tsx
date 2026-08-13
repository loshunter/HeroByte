// ============================================================================
// MOBILE ENTITIES LIST
// ============================================================================
// The party rows on mobile. Since M4a this is ONLY the list: the full-height
// surface, header and exit around it belong to MobileScreen, which is what
// retired the right-edge drawer this file used to be.

import React from "react";
import type { Player, SnapshotCharacter, Token } from "@herobyte/shared";
import { MobilePlayerRow } from "./MobilePlayerRow";

interface MobileEntitiesListProps {
  players: Player[];
  characters: SnapshotCharacter[];
  uid: string;
  /** The VIEWER's DM state — mobile passes the same flag to every row. */
  isDM: boolean;
  /** Grant/revoke the viewer's own DM status. */
  onToggleDMMode: (next: boolean) => void;

  // Edit props passed through to row
  editingHpUID: string | null;
  hpInput: string;
  onHpInputChange: (value: string) => void;
  onHpEdit: (uid: string, currentHp: number) => void;
  onHpSubmit: () => void;
  editingMaxHpUID: string | null;
  maxHpInput: string;
  onMaxHpInputChange: (value: string) => void;
  onMaxHpEdit: (uid: string, currentMaxHp: number) => void;
  onMaxHpSubmit: () => void;
  onCharacterHpChange: (characterId: string, hp: number, maxHp: number, tempHp?: number) => void;
  onCharacterStatusEffectsChange: (characterId: string, effects: string[]) => void;
  onCharacterNameUpdate: (characterId: string, name: string) => void;
  onCharacterPortraitUpdate: (characterId: string, url: string) => void;
  /** Live tokens, so a DM can set each player's sight radius from a phone (S7). */
  tokens?: Token[];
  onTokenVisionRadiusChange?: (tokenId: string, radiusFeet: number | null) => void;
}

export const MobileEntitiesList: React.FC<MobileEntitiesListProps> = ({
  players,
  characters,
  uid,
  isDM,
  onToggleDMMode,
  editingHpUID,
  hpInput,
  onHpInputChange,
  onHpEdit,
  onHpSubmit,
  editingMaxHpUID,
  maxHpInput,
  onMaxHpInputChange,
  onMaxHpEdit,
  onMaxHpSubmit,
  onCharacterHpChange,
  onCharacterStatusEffectsChange,
  onCharacterNameUpdate,
  onCharacterPortraitUpdate,
  tokens,
  onTokenVisionRadiusChange,
}) => {
  // One row per (player, character) PAIR — the desktop model, and the same
  // flatMap useCombatOrdering builds EntitiesPanel's rows from. This used to be
  // players.map + characters.find, which resolved every player to whichever
  // owned character the find hit first: anyone's second character
  // ("+ Add Character") had NO row on a phone — no HP, no status, no rename,
  // and S7's sight radius unreachable for exactly the extra tokens a DM most
  // needs to reach. MobilePlayerRow was already character-keyed throughout
  // (editing state, HP, name, portrait all go by characterId); the list was
  // the only place still thinking in players.
  const entities = players.flatMap((player) => {
    const owned = characters.filter(
      // type gate matches useCombatOrdering: an NPC is the DM's to run from
      // the DM screen, not a party member — and without it a DM who owns NPCs
      // can have their own row resolve to one.
      (c) => c.type === "pc" && c.ownedByPlayerUID === player.uid,
    );
    if (owned.length === 0) {
      // A player with no character link (legacy shape) keeps one stats row.
      return [
        {
          ...player,
          hp: player.hp ?? 100,
          maxHp: player.maxHp ?? 100,
          characterId: player.uid,
          tokenId: undefined as SnapshotCharacter["tokenId"],
          ownerTokenFallbackOk: true,
        },
      ];
    }
    return owned.map((character) => ({
      // The by-owner token fallback is only MEANINGFUL when it cannot be
      // ambiguous: for the legacy row above, and for a player with exactly one
      // character whose token predates linking. With two characters it is
      // guaranteed wrong for at least one of them — measured live: a token-less
      // second character's row rendered a sight control bound to the FIRST
      // character's token, which a DM would use believing it was the second's.
      ownerTokenFallbackOk: owned.length === 1,
      ...player,
      name: character.name,
      hp: character.hp ?? player.hp ?? 100,
      maxHp: character.maxHp ?? player.maxHp ?? 100,
      tempHp: character.tempHp ?? player.tempHp,
      portrait: character.portrait ?? player.portrait,
      statusEffects: character.statusEffects ?? player.statusEffects,
      characterId: character.id,
      // The token this ROW is about. Bound through the CHARACTER, as
      // EntitiesPanel does, and not by owner: a player can own several tokens —
      // one from joining, one per "+ Add Character" — so picking by owner shows
      // one character's row while writing to a different character's token.
      tokenId: character.tokenId,
    }));
  });

  // Me first, then the DM, then everyone else alphabetically. Rank-based on
  // purpose: the old comparator answered "a first" whenever a was mine without
  // looking at b, which is consistent only while a player can never meet their
  // own second row. Array.sort is stable, so one player's characters keep
  // their creation order within a rank.
  const rank = (e: { uid: string; isDM?: boolean }) => (e.uid === uid ? 0 : e.isDM ? 1 : 2);
  entities.sort((a, b) => rank(a) - rank(b) || (rank(a) === 2 ? a.name.localeCompare(b.name) : 0));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {entities.map((entity) => {
        // Prefer the row's own character token; the by-owner fallback is
        // gated to rows where it cannot pick the wrong character's token.
        const entityToken = entity.tokenId
          ? tokens?.find((candidate) => candidate.id === entity.tokenId)
          : entity.ownerTokenFallbackOk
            ? tokens?.find((candidate) => candidate.owner === entity.uid)
            : undefined;
        return (
          <MobilePlayerRow
            // uid alone duplicates the moment a player has two rows; the pair
            // mirrors useCombatOrdering's `${player.uid}-${character.id}` ids.
            key={`${entity.uid}-${entity.characterId}`}
            player={entity}
            isMe={entity.uid === uid}
            token={entityToken}
            // `isDM` is the VIEWER's flag (see the prop doc above), and it is
            // required here for the same reason EntitiesPanel gates on
            // `currentIsDM`: sight radius is DM-only, the server refuses it
            // from anyone else, and a control that silently does nothing is
            // worse than one that isn't there.
            onTokenVisionRadiusChange={
              isDM && entityToken && onTokenVisionRadiusChange
                ? (radiusFeet) => onTokenVisionRadiusChange(entityToken.id, radiusFeet)
                : undefined
            }
            isDM={isDM}
            onToggleDMMode={onToggleDMMode}
            editingHpUID={editingHpUID}
            hpInput={hpInput}
            onHpInputChange={onHpInputChange}
            onHpEdit={onHpEdit}
            onHpSubmit={(_hpStr) => {
              // HPBar passes the string value, but onHpSubmit expects void in EntitiesPanel
              // Here we just trigger the submit logic
              onHpSubmit();
            }}
            editingMaxHpUID={editingMaxHpUID}
            maxHpInput={maxHpInput}
            onMaxHpInputChange={onMaxHpInputChange}
            onMaxHpEdit={onMaxHpEdit}
            onMaxHpSubmit={(_maxHpStr) => {
              // HPBar passes the string value, but onMaxHpSubmit expects void here
              onMaxHpSubmit();
            }}
            onCharacterHpChange={onCharacterHpChange}
            onStatusEffectsChange={(effects) =>
              onCharacterStatusEffectsChange(entity.characterId, effects)
            }
            onCharacterNameUpdate={onCharacterNameUpdate}
            onCharacterPortraitUpdate={onCharacterPortraitUpdate}
          />
        );
      })}
    </div>
  );
};
