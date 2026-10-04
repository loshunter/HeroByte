// ============================================================================
// MOBILE PARTY ROWS
// ============================================================================
// The phone Party's rows: one per (player, character) pair, plus the viewer's
// own characterless seat. Moved out of MobileEntitiesList unchanged (U8), which
// sat at the 350-line guard; the list keeps the seats and the row wiring.

import { isInInitiativeOrder } from "@herobyte/shared";
import type { Player, SnapshotCharacter } from "@herobyte/shared";

export function mobilePartyRows(
  players: Player[],
  characters: SnapshotCharacter[],
  uid: string,
  combatActive: boolean,
) {
  // One row per (player, character) PAIR — the desktop model, and the same
  // flatMap useCombatOrdering builds EntitiesPanel's rows from. This used to be
  // players.map + characters.find, which resolved every player to whichever
  // owned character the find hit first: anyone's second character
  // ("+ Add Character") had NO row on a phone — no HP, no status, no rename,
  // and S7's sight radius unreachable for exactly the extra tokens a DM most
  // needs to reach. MobilePlayerRow was already character-keyed throughout
  // (editing state, HP, name, portrait all go by characterId); the list was
  // the only place still thinking in players.
  return players.flatMap((player) => {
    const owned = characters.filter(
      // type gate matches useCombatOrdering: an NPC is the DM's to run from
      // the DM screen, not a party member — and without it a DM who owns NPCs
      // can have their own row resolve to one.
      (c) => c.type === "pc" && c.ownedByPlayerUID === player.uid,
    );
    if (owned.length === 0) {
      // A seat with no character. Someone else's shows nothing, as on the
      // desktop Party: its editors would send character messages carrying a
      // player uid, which the server refuses. The viewer's own keeps a row,
      // since its EDIT is the phone's way to ➕ Add Character.
      if (player.uid !== uid) return [];
      return [
        {
          ...player,
          hp: player.hp ?? 100,
          maxHp: player.maxHp ?? 100,
          characterId: player.uid,
          hasCharacter: false,
          speed: undefined as number | undefined,
          movementUsed: undefined as number | undefined,
          hasBudget: false,
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
      // The character's own, like the conditions below: the player-level
      // value is legacy and only attributable to a sole character.
      tempHp: character.tempHp ?? (owned.length === 1 ? player.tempHp : undefined),
      // The seat's portrait is legacy too: a sole character's fallback only.
      portrait: character.portrait ?? (owned.length === 1 ? player.portrait : undefined),
      // Conditions belong to the character. The player-level list is legacy
      // and is only attributable when this player owns one character — the
      // same line the token fallback above draws, for the same reason: with
      // two characters it paints a sibling's condition onto both rows (UX-02).
      statusEffects:
        character.statusEffects ?? (owned.length === 1 ? player.statusEffects : undefined),
      characterId: character.id,
      hasCharacter: true,
      speed: character.speed,
      movementUsed: character.movementUsed,
      // The plate's own predicate (tokenPlates.ts): a budget exists in combat
      // for a character in the order (the shared spelling of it), OR a spend
      // to clear: the server charges any token moved in combat, initiative or
      // not, and that spend needs the DM's lever too (the plate hides it; the
      // card must not).
      hasBudget:
        combatActive &&
        (isInInitiativeOrder(character, players) || (character.movementUsed ?? 0) > 0),
      // The token this ROW is about. Bound through the CHARACTER, as
      // EntitiesPanel does, and not by owner: a player can own several tokens —
      // one from joining, one per "+ Add Character" — so picking by owner shows
      // one character's row while writing to a different character's token.
      tokenId: character.tokenId,
    }));
  });
}
