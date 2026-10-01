// ============================================================================
// BACKUP FORMAT DETECTION
// ============================================================================
// HeroByte writes three kinds of JSON file and offers three file pickers —
// a table backup (Download table backup / Restore table backup), an editable
// map (Export / Import editable map) and a character (Save / Load character) —
// and until this existed no picker could tell which file it had been handed.
//
// Both files declare `schemaVersion: 1` — SessionFile and MapDocument were
// numbered independently and happen to collide — so the map importer's version
// check waved a whole table backup through, sent it as a map document, and the
// DM was eventually told the MAP SERVER DID NOT RESPOND. The server had in fact
// answered immediately, rejecting a document with no name. The mirror image was
// no better: a map backup handed to the table restore has no `snapshot` key, so
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

/** Which of HeroByte's three files this is, if any. */
export type BackupFormat =
  /** A SessionFile envelope, or the bare RoomSnapshot older saves wrote. */
  | "session"
  /** A single MapDocument, as Export editable map writes. */
  | "map"
  /** One character, as Save character writes. */
  | "character"
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
  // `id` as well as `name`: without it `{schemaVersion: 1, name: "anything"}`
  // classifies as a map, so the session loader sends the DM to Map Studio — and
  // the map importer then accepts the same file and ships it to a server that
  // refuses it. A real document always carries both.
  if (
    parsed.schemaVersion === 1 &&
    typeof parsed.name === "string" &&
    typeof parsed.id === "string"
  ) {
    return "map";
  }

  // A character file: a name and its two HP numbers, and none of the collections
  // that make a table or a map. Asked last, so a table or a map can never land here.
  if (
    typeof parsed.name === "string" &&
    typeof parsed.hp === "number" &&
    typeof parsed.maxHp === "number"
  ) {
    return "character";
  }

  return "unknown";
}

/**
 * What to tell someone who picked the right file in the wrong place. Each names
 * what the file IS and where its own picker is, since the honest next move is not
 * "try again".
 */
export const WRONG_FILE_FOR_MAP_IMPORT =
  "That is a table backup (the whole table), not an editable map. Restore it with Restore table " +
  "backup under DM Menu → Table → Backups — importing it here would not bring your characters or " +
  "tokens back.";

export const WRONG_FILE_FOR_SESSION_LOAD =
  "That is an editable map, not a table backup. Import it with Import editable map (.json) " +
  "under DM Menu → Maps → Map library — restoring it here would not restore a table.";

export const CHARACTER_FILE_FOR_SESSION_LOAD =
  "That is a character file, not a table backup. Load it with Load character, in that " +
  "character's ⚙️ settings — restoring it here would not bring a table back.";

export const CHARACTER_FILE_FOR_MAP_IMPORT =
  "That is a character file, not an editable map. Load it with Load character, in that " +
  "character's ⚙️ settings.";

export const TABLE_BACKUP_FOR_CHARACTER_LOAD =
  "That is a table backup (the whole table), not a character file. A DM restores it under " +
  "DM Menu → Table → Backups; Load character only reads a file saved with Save character.";

export const MAP_FOR_CHARACTER_LOAD =
  "That is an editable map, not a character file. A DM imports it under DM Menu → Maps → " +
  "Map library; Load character only reads a file saved with Save character.";
