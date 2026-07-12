// Validator for binding the room's live-authored map document. Lives in its own
// module because mapStudioValidators.ts sits at the 350-LOC structural ceiling.

import { z } from "zod";
import type { MessageRecord, ValidationResult } from "./commonValidators.js";

const id = z.string().trim().min(1).max(128);

// Bind (documentId string) or clear (documentId null) the live-bound document.
// NOT `.strict()`: the client's command-ack layer stamps a `commandId` onto
// every outgoing message, so a strict top-level object would reject every real
// set-live (the other map-studio validators omit top-level strict for the same
// reason). documentId is still validated as a 1..128-char id or null.
const setLiveSchema = z.object({
  t: z.literal("map-studio-set-live"),
  documentId: id.nullable(),
});

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
