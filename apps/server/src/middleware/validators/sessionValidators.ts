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

/**
 * A session file may legitimately carry every map in the room, and a single
 * generated dungeon is already thousands of elements — so the cap is on the
 * DOCUMENT COUNT, not their contents. Import sanitizes each document itself
 * (importMapDocument), and one bad document is skipped rather than fatal, so a
 * loose shape here fails safe. This exists to stop an absurd payload, not to
 * re-typecheck MapDocument at the edge.
 */
const MAX_SESSION_DOCUMENTS = 64;

const mapDocuments = z
  .array(z.object({ id: z.string().trim().min(1).max(128) }).passthrough())
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
