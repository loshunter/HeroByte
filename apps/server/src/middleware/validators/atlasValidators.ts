// Validators for the Atlas (campaign graph) messages. Their own module per the
// standalone-validator precedent (generationValidators.ts /
// mapStudioLiveValidators.ts): the big validator files sit at the 350-LOC
// structural ceiling.
//
// Top-level schemas are NOT `.strict()` — the client's command-ack layer stamps
// a `commandId` onto every outgoing message. Nested objects ARE strict.

import { z } from "zod";
import type { MessageRecord, ValidationResult } from "./commonValidators.js";

const id = z.string().trim().min(1).max(128);
const nodeName = z.string().trim().min(1).max(64);
const nodeKind = z.enum(["world", "region", "settlement", "building", "dungeon", "wilderness"]);
const linkType = z.enum(["door", "stair", "signpost"]);

// DOCUMENT px on the from-node's map. Finite and bounded here; the handler
// additionally clamps into the from-document's real dimensions.
const anchor = z
  .object({
    x: z.number().finite().min(-1_000_000).max(1_000_000),
    y: z.number().finite().min(-1_000_000).max(1_000_000),
  })
  .strict();

const createNodeSchema = z.object({
  t: z.literal("atlas-create-node"),
  node: z
    .object({
      id,
      kind: nodeKind,
      name: nodeName,
      parentId: id.optional(),
    })
    .strict(),
});

// `parentId: null` means "make this a root"; a string re-parents. An empty
// patch is legal and lands as an idempotent no-op.
const updateNodeSchema = z.object({
  t: z.literal("atlas-update-node"),
  nodeId: id,
  patch: z
    .object({
      name: nodeName.optional(),
      discovered: z.boolean().optional(),
      parentId: id.nullable().optional(),
    })
    .strict(),
});

const deleteNodeSchema = z.object({
  t: z.literal("atlas-delete-node"),
  nodeId: id,
});

const linkMapSchema = z.object({
  t: z.literal("atlas-link-map"),
  nodeId: id,
  documentId: id,
});

const createLinkSchema = z.object({
  t: z.literal("atlas-create-link"),
  link: z
    .object({
      id,
      fromNodeId: id,
      toNodeId: id,
      anchor,
      linkType,
      visibleToPlayers: z.boolean(),
    })
    .strict(),
});

const deleteLinkSchema = z.object({
  t: z.literal("atlas-delete-link"),
  linkId: id,
});

// The commandId becomes every generated element's id prefix (`${id}:e<n>`) and
// the element-id contract caps ids at 128 chars — 120 leaves room for the
// suffix (the generationValidators precedent).
const generateNodeSchema = z.object({
  t: z.literal("atlas-generate-node"),
  nodeId: id,
  commandId: z.string().trim().min(1).max(120),
  seed: z.number().int(),
  params: z
    .object({
      theme: z.enum(["stone", "wood"]),
      density: z.enum(["low", "medium", "high"]),
      size: z.enum(["small", "medium", "large"]),
    })
    .strict(),
});

function run(schema: z.ZodTypeAny, message: MessageRecord): ValidationResult {
  const result = schema.safeParse(message);
  if (result.success) {
    return { valid: true };
  }
  const issue = result.error.issues[0];
  const path = issue?.path.length ? ` at ${issue.path.join(".")}` : "";
  return {
    valid: false,
    error: `atlas: invalid payload${path}: ${issue?.message ?? "unknown"}`,
  };
}

export function validateAtlasCreateNodeMessage(message: MessageRecord): ValidationResult {
  return run(createNodeSchema, message);
}
export function validateAtlasUpdateNodeMessage(message: MessageRecord): ValidationResult {
  return run(updateNodeSchema, message);
}
export function validateAtlasDeleteNodeMessage(message: MessageRecord): ValidationResult {
  return run(deleteNodeSchema, message);
}
export function validateAtlasLinkMapMessage(message: MessageRecord): ValidationResult {
  return run(linkMapSchema, message);
}
export function validateAtlasCreateLinkMessage(message: MessageRecord): ValidationResult {
  return run(createLinkSchema, message);
}
export function validateAtlasDeleteLinkMessage(message: MessageRecord): ValidationResult {
  return run(deleteLinkSchema, message);
}
export function validateAtlasGenerateNodeMessage(message: MessageRecord): ValidationResult {
  return run(generateNodeSchema, message);
}

const travelSchema = z.object({
  t: z.literal("atlas-travel"),
  nodeId: id,
});

export function validateAtlasTravelMessage(message: MessageRecord): ValidationResult {
  return run(travelSchema, message);
}
