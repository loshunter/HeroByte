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
  if (format !== "map") {
    return { error: "Import failed: that file is not a HeroByte map JSON backup." };
  }
  // A map, but from a HeroByte that numbered documents differently. Worth its
  // own sentence: nothing about the file is broken and there is nothing to fix
  // by picking it again.
  if ((parsed as { schemaVersion?: unknown }).schemaVersion !== 1) {
    return {
      error: "Import failed: that map backup was written by a different version of HeroByte.",
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
