// ============================================================================
// BACKUP FORMAT DETECTION
// ============================================================================
// HeroByte writes two kinds of JSON backup and offers two file pickers, and
// until this existed neither picker could tell which file it had been handed.
//
// Both files declare `schemaVersion: 1` — SessionFile and MapDocument were
// numbered independently and happen to collide — so the map importer's version
// check waved a whole table backup through, sent it as a map document, and the
// DM was eventually told the MAP SERVER DID NOT RESPOND. The server had in fact
// answered immediately, rejecting a document with no name. The mirror image was
// no better: a map backup handed to Load Game State has no `snapshot` key, so
// the loader took its legacy bare-snapshot branch, tried to read the map AS a
// room, and reported TOKENS MUST BE AN ARRAY.
//
// Neither message names the real problem, which is that the file is the other
// kind. Both are indistinguishable from a broken file or a broken connection,
// so the honest next move looks like "try again" — and one of those paths had
// already gone to the wire.
//
// So: identify the file HERE, locally, before anything is sent. The two shapes
// have no fields in common beyond the colliding version number, which makes
// this a cheap structural check rather than a guess.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Which of HeroByte's two backup files this is, if either. */
export type BackupFormat =
  /** A SessionFile envelope, or the bare RoomSnapshot older saves wrote. */
  | "session"
  /** A single MapDocument, as BACKUP JSON writes. */
  | "map"
  /** Valid JSON, but not something HeroByte wrote. */
  | "unknown";

export function detectBackupFormat(parsed: unknown): BackupFormat {
  if (!isRecord(parsed)) return "unknown";

  // The current envelope. `mapDocuments` is NOT required: the loader already
  // tolerates its absence, and being stricter here than the loader would turn
  // a file that restores fine into a refusal.
  if (isRecord(parsed.snapshot)) return "session";

  // A bare RoomSnapshot, which is what saves older than the envelope hold. Two
  // collections rather than one, because `tokens` alone is weak — plenty of
  // unrelated JSON has a `tokens` array.
  if (Array.isArray(parsed.tokens) && Array.isArray(parsed.players)) return "session";

  // A map document. `name` alone would match almost anything, so this asks for
  // the two collections that make a document a map.
  if (
    typeof parsed.name === "string" &&
    Array.isArray(parsed.layers) &&
    Array.isArray(parsed.elements)
  ) {
    return "map";
  }

  // A map document THINNER than the rule above — `{schemaVersion: 1, id, name}`
  // with no collections yet. `parseBackupImport` deliberately accepts those (a
  // client parser must not be stricter than the server), so the session loader
  // has to RECOGNISE them or it hands them to the bare-snapshot branch and
  // reports "tokens must be an array" — the very message this file was written
  // to replace. Reached only after both session tests have failed, so a table
  // backup can never land here.
  if (parsed.schemaVersion === 1 && typeof parsed.name === "string") return "map";

  return "unknown";
}

/** What to tell someone who picked the right file in the wrong place. */
export const WRONG_FILE_FOR_MAP_IMPORT =
  "That is a table backup (a whole saved game), not a map. Restore it with Load Game State " +
  "under Session — importing it here would not bring your characters or tokens back.";

export const WRONG_FILE_FOR_SESSION_LOAD =
  "That is a map backup, not a table backup. Import it with IMPORT JSON BACKUP under Map " +
  "Studio — loading it here would not restore a table.";
