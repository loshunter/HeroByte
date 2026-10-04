// ============================================================================
// PARTY NPC ACTIONS — what an NPC's Party card does for the DM
// ============================================================================
// The Party's NPC card has always offered the DM HP, name, art, placement and
// deletion — and since the DM menu's extraction (60d22d65) every one of them
// was wired to `undefined`, so each edit silently did nothing. These send the
// same messages the DM menu's NPC editor sends, through the same merge
// (features/players/npcUpdate.ts), from the entry bundle: none of the DM
// menu's lazy hooks is pulled in.

import { useEffect, useMemo, useRef } from "react";
import type { ClientMessage, SnapshotCharacter } from "@herobyte/shared";
import {
  npcUpdateMessage,
  type NpcUpdateFields,
  type NpcUpdateMessage,
} from "../../../features/players/npcUpdate";

/** How long an unconfirmed send steers later edits (useNpcUpdate's timeout). */
const PENDING_MS = 5000;

type SentRecord = Omit<NpcUpdateMessage, "t" | "id">;

function recordOf({ t: _t, id: _id, ...record }: NpcUpdateMessage): SentRecord {
  return record;
}

/** Whether the snapshot's NPC now shows everything a send carried. */
function shows(npc: SnapshotCharacter, sent: SentRecord): boolean {
  return (
    npc.name === sent.name &&
    npc.hp === sent.hp &&
    npc.maxHp === sent.maxHp &&
    npc.tempHp === sent.tempHp &&
    (npc.portrait ?? "") === (sent.portrait ?? "") &&
    (npc.tokenImage ?? "") === (sent.tokenImage ?? "") &&
    npc.initiativeModifier === sent.initiativeModifier &&
    (sent.disposition === undefined || npc.disposition === sent.disposition)
  );
}

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
  // The last record sent per NPC, until the snapshot shows it. Every send is
  // the WHOLE record, so a second edit inside one round trip, built from the
  // snapshot the first was sent from, resent the first edit's field at its
  // old value (a rename undone by the next HP drag).
  const pending = useRef(new Map<string, { record: SentRecord; at: number }>());
  useEffect(() => {
    for (const [id, { record }] of pending.current) {
      const now = characters?.find((c) => c.id === id);
      if (!now || shows(now, record)) pending.current.delete(id);
    }
  }, [characters]);

  return useMemo(() => {
    // The server refuses these from anyone else; a player's card gets none.
    if (!isDM) return {};
    const npc = (id: string) => characters?.find((c) => c.id === id && c.type === "npc");
    return {
      onNpcUpdate: (id, updates) => {
        const existing = npc(id);
        if (!existing) return;
        const sent = pending.current.get(id);
        // A send the server never reflects (refused, or normalized) stops
        // steering five seconds after it — timed from the FIRST unconfirmed
        // send, so edits built on it cannot keep it alive for ever.
        const steering = sent !== undefined && Date.now() - sent.at < PENDING_MS;
        const base = steering ? ({ ...existing, ...sent.record } as SnapshotCharacter) : existing;
        const message = npcUpdateMessage(base, updates);
        pending.current.set(id, { record: recordOf(message), at: steering ? sent.at : Date.now() });
        sendMessage(message);
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
