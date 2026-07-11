// Validator for binding the room's live-authored map document. Lives in its own
// module because mapStudioValidators.ts sits at the 350-LOC structural ceiling.

import { z } from "zod";
import type { MessageRecord, ValidationResult } from "./commonValidators.js";

const id = z.string().trim().min(1).max(128);

// Bind (documentId string) or clear (documentId null) the live-bound document.
// `.strict()` rejects stray fields; the id bound matches every other document
// reference (1..128 chars).
const setLiveSchema = z
  .object({ t: z.literal("map-studio-set-live"), documentId: id.nullable() })
  .strict();

export function validateMapStudioSetLiveMessage(message: MessageRecord): ValidationResult {
  const result = setLiveSchema.safeParse(message);
  if (result.success) {
    return { valid: true };
  }
  const issue = result.error.issues[0];
  const path = issue?.path.length ? ` at ${issue.path.join(".")}` : "";
  return {
    valid: false,
    error: `map-studio: invalid payload${path}: ${issue?.message ?? "unknown"}`,
  };
}
