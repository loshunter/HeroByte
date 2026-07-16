// ============================================================================
// SESSION VALIDATORS (session-export, and the load-session envelope)
// ============================================================================
// Its own module because roomValidators.ts sits near the 350-LOC structural
// ceiling (same precedent as generationValidators.ts / mapStudioLiveValidators.ts).
//
// These cover the SessionFile envelope only — the snapshot half of load-session
// is still validated by roomValidators.validateLoadSessionMessage.

import { z } from "zod";
import type { MessageRecord, ValidationResult } from "./commonValidators.js";
import { importDocument } from "./mapStudioValidators.js";

/**
 * A session file may legitimately carry every map in the room.
 */
const MAX_SESSION_DOCUMENTS = 64;

/**
 * The SAME schema map-studio-import uses — deliberately, not incidentally.
 *
 * This was briefly `z.object({ id }).passthrough()`, on the reasoning that
 * importMapDocument sanitizes each document anyway so a loose shape "fails
 * safe". It does not: sanitization is exactly where the cost is paid. A ~30-byte
 * chunk `{"0,0":[999999999,1]}` reaches decodeTerrainChunk, which pushes `count`
 * entries BEFORE checking the length — allocating ~1e9 slots to arrive at a
 * rejection. On a 512MB Render instance that is a heap OOM, which aborts the
 * process rather than throwing, so restoreMapDocuments' try/catch cannot contain
 * it, and one process serves every room. The import path already caps runs at
 * 512; a second door onto the same sanitizer must not have a weaker lock.
 */
const mapDocuments = z
  .array(importDocument)
  .max(MAX_SESSION_DOCUMENTS, { message: `exceeds ${MAX_SESSION_DOCUMENTS} map documents` });

const envelopeSchema = z.object({
  mapDocuments: mapDocuments.optional(),
  liveMapDocumentId: z.string().trim().min(1).max(128).optional(),
});

/**
 * Validate the map-document half of a load-session message. Both fields are
 * optional: a legacy save file is a bare snapshot with neither, and must still
 * load (it just restores a map that cannot be edited afterwards).
 */
export function validateLoadSessionEnvelope(message: MessageRecord): ValidationResult {
  const result = envelopeSchema.safeParse(message);
  if (result.success) {
    return { valid: true };
  }
  const issue = result.error.issues[0];
  const path = issue?.path.length ? ` at ${issue.path.join(".")}` : "";
  return {
    valid: false,
    error: `load-session: invalid session file${path}: ${issue?.message ?? "unknown"}`,
  };
}

/** session-export carries no payload; the DM check is the handler's job. */
export function validateSessionExportMessage(_message: MessageRecord): ValidationResult {
  return { valid: true };
}
