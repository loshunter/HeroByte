// ============================================================================
// PARTY NPC ACTIONS — what an NPC's Party card does for the DM
// ============================================================================
// The Party's NPC card has always offered the DM HP, name, art, placement and
// deletion — and since the DM menu's extraction (60d22d65) every one of them
// was wired to `undefined`, so each edit silently did nothing. These send the
// same messages the DM menu's NPC editor sends, through the same merge
// (features/players/npcUpdate.ts), from the entry bundle: none of the DM
// menu's lazy hooks is pulled in.

import { useMemo } from "react";
import type { ClientMessage, SnapshotCharacter } from "@herobyte/shared";
import { npcUpdateMessage, type NpcUpdateFields } from "../../../features/players/npcUpdate";

export interface PartyNpcActions {
  onNpcUpdate?: (id: string, updates: NpcUpdateFields) => void;
  onNpcDelete?: (id: string) => void;
  onNpcPlaceToken?: (id: string) => void;
}

export function usePartyNpcActions(
  characters: readonly SnapshotCharacter[] | undefined,
  sendMessage: (message: ClientMessage) => void,
  isDM: boolean,
): PartyNpcActions {
  return useMemo(() => {
    // The server refuses these from anyone else; a player's card gets none.
    if (!isDM) return {};
    const npc = (id: string) => characters?.find((c) => c.id === id && c.type === "npc");
    return {
      onNpcUpdate: (id, updates) => {
        const existing = npc(id);
        if (existing) sendMessage(npcUpdateMessage(existing, updates));
      },
      onNpcDelete: (id) => {
        const existing = npc(id);
        // The DM menu's own confirmation, word for word.
        if (
          existing &&
          window.confirm(`Delete "${existing.name}"? This also removes its token from the map.`)
        ) {
          sendMessage({ t: "delete-npc", id });
        }
      },
      onNpcPlaceToken: (id) => {
        if (npc(id)) sendMessage({ t: "place-npc-token", id });
      },
    };
  }, [characters, sendMessage, isDM]);
}
