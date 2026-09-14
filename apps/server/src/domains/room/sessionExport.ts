// ============================================================================
// SESSION EXPORT — the one author of a SessionFile, and what it weighs
// ============================================================================
// The server bundles the export because it is the only side holding both the
// room state and the authored MapDocuments — the client's snapshot has the map
// only as derived output plus a pointer. It lives here, not in
// RoomMessageHandler, so the MINT ceiling can weigh the file a mint WOULD
// write — the same builder, the same bytes the DM's own export carries — and
// refuse before anything persists (the Weighed Campaign plan, §2.2).

import {
  loadSessionFrameBytes,
  SESSION_MINT_CEILING_BYTES,
  type MapDocument,
  type RoomSnapshot,
  type SessionFile,
} from "@herobyte/shared";
import { parseSceneState } from "../../middleware/validators/sessionValidators.js";
import { toSnapshot, type RoomState } from "./model.js";

/**
 * Inline the asset channel back into plain fields for a session FILE.
 *
 * toSnapshot diverts `mapBackground` and `drawings` into `assets`/`assetRefs`
 * (SnapshotAssetBuilder) — an indirection that earns its keep on a repeated
 * broadcast, where the payload is content-addressed and deduped. A file is
 * written once and read once, so the indirection buys nothing and costs
 * everything: the id-keyed asset list is a second thing to keep consistent, and
 * BOTH loaders were written for the client's hydrated (flat) snapshot.
 *
 * Shipping the raw wire shape into a file broke it three ways at once — the
 * client parser demanded a `drawings` key toSnapshot never emits, it dropped a
 * `mapBackground` that lived in assetRefs, and the server's own load validator
 * rejected any room with zero drawings (no key AND no assetRef). Flattening here
 * fixes all three at the source rather than teaching two parsers a shape they
 * should never have had to know.
 *
 * `drawings` is always an array — that is the invariant both loaders rely on.
 */
function flattenForFile(snapshot: RoomSnapshot, state: RoomState): RoomSnapshot {
  const { assets: _assets, assetRefs: _assetRefs, ...rest } = snapshot;
  return {
    ...rest,
    drawings: state.drawings,
    // Public chat only. The snapshot handed to this function was built with
    // toSnapshot(state, true, senderUid) — a REAL recipient uid — so the
    // exporting DM's own whispers passed visibleChatFor and would otherwise
    // be written into a file whose entire purpose is to be handed to other
    // people. A table fork avoids this by using createSnapshot() (no uid);
    // export cannot, because it must round-trip the DM's secrets. So the one
    // secret that is not the DM's to share gets stripped here.
    chatLog: (rest.chatLog ?? []).filter((message) => !message.to),
    // Public rolls only, for exactly the reason above: the real recipient uid
    // let the exporting DM's own `self` rolls, and every `dm` roll the table
    // sent them, through visibleRollsFor. Neither belongs in a file handed to
    // other people.
    diceRolls: (rest.diceRolls ?? []).filter(
      (roll) => roll.visibility === undefined || roll.visibility === "public",
    ),
    ...(state.mapBackground === undefined ? {} : { mapBackground: state.mapBackground }),
  };
}

/**
 * Bundle a COMPLETE, restorable session file from the DM's own view.
 *
 * DM-only by construction: it carries secret doors, hidden NPCs and GM notes
 * verbatim. Only schema-conforming suspended scenes ride — the SAME schema the
 * reimport envelope enforces, so a poisoned scene can never write a file the
 * DM's OWN export fails to reimport (the "backup silently stops being a
 * backup" failure the caps exist to prevent). Skipped loudly, never silently.
 */
export function buildSessionFile(
  state: RoomState,
  mapDocuments: MapDocument[],
  exportingUid: string,
  savedAt: number,
): SessionFile {
  const suspendedScenes = Object.values(state.sceneStates).filter((scene) => {
    const usable = parseSceneState(scene) !== null;
    if (!usable) console.warn("session-export: skipped a malformed suspended scene");
    return usable;
  });
  return {
    schemaVersion: 1,
    savedAt,
    // The DM's view on purpose — a session file must round-trip the secrets
    // a player snapshot strips, or reloading one would quietly disarm the map.
    // (The graph rides INSIDE this snapshot — the DM view carries it whole,
    // provenance included; sceneStates never can, so they ride below.)
    snapshot: flattenForFile(toSnapshot(state, true, exportingUid), state),
    mapDocuments,
    liveMapDocumentId: state.liveMapDocumentId,
    // Envelope-only, and omitted when empty so a pre-Atlas room's file is
    // byte-identical to what it was before this field existed.
    ...(suspendedScenes.length > 0 ? { sceneStates: suspendedScenes } : {}),
  };
}

/** The room's document list as it would be with `candidate` minted: replaced by id, else appended. */
export function withCandidate(documents: MapDocument[], candidate: MapDocument): MapDocument[] {
  return documents.some((entry) => entry.id === candidate.id)
    ? documents.map((entry) => (entry.id === candidate.id ? candidate : entry))
    : [...documents, candidate];
}

/** What the export of `state` + `documents` weighs on the wire — the DM's readout and the ceiling's measure. */
export function exportBytes(state: RoomState, documents: MapDocument[], actingUid: string): number {
  return loadSessionFrameBytes(buildSessionFile(state, documents, actingUid, 0));
}

/** The would-be export's wire weight and the ceiling it crossed. */
export interface MintOverflow {
  bytes: number;
  ceiling: number;
}

/**
 * Weigh the export this room would write if `documents` were its map list —
 * the caller has already added or replaced the candidate — plus
 * `candidateSceneBytes`, what the candidate adds the moment it is the LIVE
 * scene (`liveSceneBytes`: the compiled scene, terrain and scenery the
 * snapshot carries; a kick installs them in the same message that mints), and
 * report the overflow past SESSION_MINT_CEILING_BYTES, or null when it fits.
 *
 * Bytes are the `load-session` FRAME's (the file minus assets), because that
 * frame is what the socket measures. The weigh is a full stringify of up to a
 * megabyte; a mint is rare and already ran a recipe, so that is the right
 * place to pay it — an incremental edit is not (plan §2.3). The scene part is
 * an upper bound for a mint nothing travels to yet, and counts the outgoing
 * scene's derived data as still present — a refusal a few dozen KB early,
 * never a table past the ceiling.
 */
export function mintOverflow(
  state: RoomState,
  documents: MapDocument[],
  actingUid: string,
  candidateSceneBytes = 0,
): MintOverflow | null {
  const bytes = exportBytes(state, documents, actingUid) + candidateSceneBytes;
  return bytes > SESSION_MINT_CEILING_BYTES ? { bytes, ceiling: SESSION_MINT_CEILING_BYTES } : null;
}

const mb = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

/**
 * The refusal every mint path shows the DM — one sentence, both numbers. The
 * count cap's twin ("holds the maximum of N map documents") stays as it was.
 */
export function mintRefusal(overflow: MintOverflow): string {
  return (
    `This would put the campaign's export at about ${mb(overflow.bytes)} — past the ` +
    `${mb(overflow.ceiling)} a table can load back in one message. Delete a map first.`
  );
}
