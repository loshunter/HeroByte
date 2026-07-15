// Validator for server-side generation recipes (map-studio-generate). Lives in
// its own module because mapStudioValidators.ts sits at the 350-LOC structural
// ceiling (same precedent as mapStudioLiveValidators.ts).

import { z } from "zod";
import type { MessageRecord, ValidationResult } from "./commonValidators.js";

const id = z.string().trim().min(1).max(128);
// The commandId becomes every generated element's id prefix (`${id}:e<n>`), and
// the element-id contract caps ids at 128 chars — a longer prefix would mint a
// document that exports but never re-imports. 120 leaves room for `:e4999`.
const commandId = z.string().trim().min(1).max(120);

// Bounds are document-grid CELLS. Per-field caps can't express the area limit,
// so the 16384-cell product rides a refinement. The 8×8 floor matches the
// resolver: anything smaller can't fit a room plus its margins.
const bounds = z
  .object({
    x: z.number().int().min(-65536).max(65536),
    y: z.number().int().min(-65536).max(65536),
    cols: z.number().int().min(8).max(16384),
    rows: z.number().int().min(8).max(16384),
  })
  .strict()
  .refine((value) => value.cols * value.rows <= 16384, {
    message: "bounds exceed 16384 cells",
  });

const params = z
  .object({
    theme: z.enum(["stone", "wood"]),
    density: z.enum(["low", "medium", "high"]),
    secretDoorChance: z.number().min(0).max(1),
  })
  .strict();

// NOT `.strict()` at the top level: the client's command-ack layer stamps a
// `commandId` onto every outgoing message (here it is also a declared field,
// but the non-strict convention holds for all map-studio message schemas).
const generateSchema = z.object({
  t: z.literal("map-studio-generate"),
  documentId: id,
  commandId,
  recipe: z.literal("dungeon"),
  seed: z.number().int(),
  bounds,
  params,
});

export function validateMapStudioGenerateMessage(message: MessageRecord): ValidationResult {
  const result = generateSchema.safeParse(message);
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
