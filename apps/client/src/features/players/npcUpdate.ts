// ============================================================================
// NPC UPDATE — the one merge behind every `update-npc`
// ============================================================================
// `update-npc` carries the NPC's WHOLE editable record, so a caller that
// changes one field (the Party card's HP bar, say) must fill the rest from what
// the snapshot holds. The DM menu's editor and the Party's NPC card both send
// through this merge, so they cannot disagree about what "unchanged" means.
// Data-only on purpose: the Party lives in the entry bundle and the DM menu's
// hooks do not.

import type { ClientMessage, NpcDisposition, SnapshotCharacter } from "@herobyte/shared";

export interface NpcUpdateFields {
  name?: string;
  hp?: number;
  maxHp?: number;
  tempHp?: number;
  portrait?: string | null;
  tokenImage?: string | null;
  initiativeModifier?: number | null;
  /** Where the NPC stands with the party; absent keeps what it has. */
  disposition?: NpcDisposition;
}

export type NpcUpdateMessage = Extract<ClientMessage, { t: "update-npc" }>;

/** The full record an update sends: the edits, over what the NPC holds now. */
export function mergeNpcUpdate(existing: SnapshotCharacter, updates: NpcUpdateFields) {
  return {
    name: updates.name ?? existing.name,
    // A DM's snapshot always carries exact numbers (the redaction is for
    // players), so the trailing fallbacks are type honesty, not a path.
    hp: updates.hp ?? existing.hp ?? 0,
    maxHp: updates.maxHp ?? existing.maxHp ?? 1,
    tempHp: updates.tempHp ?? existing.tempHp,
    portrait: updates.portrait ?? existing.portrait,
    tokenImage: updates.tokenImage ?? existing.tokenImage ?? undefined,
    initiativeModifier: updates.initiativeModifier ?? existing.initiativeModifier,
    // ?? not ||: the merge has to keep a stance the DM set earlier when the
    // edit that triggered this send was about something else entirely.
    // Conditional, like every other writer in this arc: `disposition:
    // undefined` is a KEY, and it is only inert because JSON.stringify
    // happens to drop it. It should not depend on the transport.
    ...((updates.disposition ?? existing.disposition)
      ? { disposition: updates.disposition ?? existing.disposition }
      : {}),
  };
}

export function npcUpdateMessage(
  existing: SnapshotCharacter,
  updates: NpcUpdateFields,
): NpcUpdateMessage {
  return {
    t: "update-npc",
    id: existing.id,
    ...mergeNpcUpdate(existing, updates),
  } as NpcUpdateMessage;
}
