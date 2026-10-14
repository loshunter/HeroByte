// ============================================================================
// SESSION FILE — the DM's table backup
// ============================================================================
// Moved out of the barrel (index.ts) for its 350-line ceiling; re-exported there.

import type { MapDocument } from "./mapStudioTypes.js";
import type { SceneState } from "./atlas.js";
import type { RoomSnapshot } from "./index.js";

/**
 * A complete, restorable session: the room AND the authored maps it references.
 *
 * WHY THIS IS AN ENVELOPE AND NOT JUST A SNAPSHOT. A RoomSnapshot carries the
 * map only as DERIVED output — compiledScene (walls/doors), mapTerrain (floor),
 * mapElements (scenery) — plus `liveMapDocumentId`, which is a POINTER. The
 * authored source is the MapDocument, and it lives server-side. Restore a bare
 * snapshot onto a fresh server and you get a map you can look at but never edit,
 * bound to a document that no longer exists. The documents make it whole.
 *
 * This matters because a session file has to survive being restored onto a
 * DIFFERENT server than the one that wrote it — a fresh deploy, a local dev box,
 * another DM's machine. A session file is the DM's way to carry a table across
 * that gap, so it has to be genuinely complete or it is not portable.
 *
 * PRIVACY: this is built from the DM's view and therefore contains secret doors,
 * hidden NPCs, and GM notes. It is a DM artefact — never hand it to players.
 */
export interface SessionFile {
  /** Bumped only on a breaking shape change; the loader also accepts a bare RoomSnapshot. */
  schemaVersion: 1;
  savedAt: number;
  snapshot: RoomSnapshot;
  /** Every map document in the room — not just the live one, so drafts survive too. */
  mapDocuments: MapDocument[];
  /** Which document was bound to the table, if any. */
  liveMapDocumentId?: string;
  /**
   * Every suspended scene, keyed inside each record by its mapDocumentId.
   * ENVELOPE-only on purpose: sceneStates can never ride a RoomSnapshot (they
   * serialize to no recipient), so the snapshot half of this file never holds
   * them — one carriage, no unvalidated decoy copy. Absent in older files.
   */
  sceneStates?: SceneState[];
  /**
   * The BYTES behind every `upload:<hash>` / `/assets/<hash>` reference anywhere
   * in this file. Optional: a file saved before this existed simply has none,
   * and a session using only external image URLs (imgur and friends) needs none.
   *
   * Without these a session file is only restorable on a server that still holds
   * the same asset store — restore it anywhere else and the reference would
   * round-trip perfectly and resolve to a broken image, which is the worst kind
   * of "saved".
   */
  assets?: SessionAsset[];
}

/** One uploaded image, inlined so a session file is self-contained. */
export interface SessionAsset {
  /** sha256 — the asset store is content-addressed, so re-uploading restores the same id. */
  hash: string;
  mime: string;
  /** base64, no data: prefix. */
  bytes: string;
}
