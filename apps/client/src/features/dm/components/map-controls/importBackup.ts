// Validating a JSON backup BEFORE it goes near the wire. Extracted from
// MapStudioControl for the 350-LOC cap; the rules are unchanged.
import type { MapDocument } from "@herobyte/shared";
import { MAX_PUBLISH_BACKGROUND_BYTES } from "../../../map-studio";
import { WRONG_FILE_FOR_MAP_IMPORT, detectBackupFormat } from "../../../../utils/backupFormat";

export type BackupImport = { document: MapDocument } | { error: string };

export function parseBackupImport(fileText: string): BackupImport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    return { error: "Import failed: that file is not valid JSON." };
  }
  // WHAT KIND OF FILE IS THIS — asked before the version, because the version
  // cannot tell: a session backup also says `schemaVersion: 1`, so this used to
  // pass one straight through to the wire and report the server's silence
  // rather than the mismatch the DM could actually act on.
  const format = detectBackupFormat(parsed);
  if (format === "session") {
    return { error: `Import failed: ${WRONG_FILE_FOR_MAP_IMPORT}` };
  }

  // `null` IS valid JSON, and it is the one parse result that cannot be read
  // from. Dropping this guard when the format check went in turned a file whose
  // whole body is `null` into a TypeError on the version read below — and the
  // call site passes its handler as .then(onFulfilled, onRejected), where the
  // second argument catches a failed READ and not a throw from the first, so
  // the DM got no message at all. Silence is the exact failure this file exists
  // to abolish, so the guard is back and pinned by a test.
  if (typeof parsed !== "object" || parsed === null) {
    return { error: "Import failed: that file is not a HeroByte map JSON backup." };
  }

  // AND THAT IS THE ONLY THING DETECTION IS ALLOWED TO REJECT. Everything else
  // keeps the version check this has always had, because a client-side parser
  // must never be stricter than the server that follows it — the same rule
  // sessionPersistence writes down. Demanding a positive "map" match here
  // instead turned every partial-but-importable document into a refusal, which
  // is a worse failure than the one being fixed: it is a file that WOULD have
  // worked, refused locally, with no server to appeal to.
  if ((parsed as { schemaVersion?: unknown }).schemaVersion !== 1) {
    // A recognisable map at a version we do not read gets its own sentence:
    // nothing about it is broken, and picking it again cannot help.
    return {
      error:
        format === "map"
          ? "Import failed: that map backup was written by a different version of HeroByte."
          : "Import failed: that file is not a HeroByte map JSON backup.",
    };
  }
  // Guard the 1MB inbound WebSocket cap: the whole document ships over that
  // capped channel, and an oversized import would be dropped by the server
  // BEFORE any handler runs — silently — leaving the panel wedged in a
  // loading state. Measure the compact encoding the socket actually sends.
  const wireBytes = new TextEncoder().encode(JSON.stringify(parsed)).length;
  if (wireBytes > MAX_PUBLISH_BACKGROUND_BYTES) {
    return {
      error:
        "Import failed: that backup is too large to send (over ~1MB). Split the map or publish a raster instead.",
    };
  }
  return { document: parsed as MapDocument };
}
