import { z } from "zod";
import type { MessageRecord, ValidationResult } from "./commonValidators.js";
import { PAYLOAD_LIMITS } from "./constants.js";

const id = z.string().trim().min(1).max(128);
const name = z.string().trim().min(1).max(200);
const finite = z.number().finite();
const positive = finite.positive();
const unitInterval = finite.min(0).max(1);
const point = z.object({ x: finite, y: finite }).strict();
const transform = z
  .object({ x: finite, y: finite, scaleX: positive, scaleY: positive, rotation: finite })
  .strict();

const grid = z
  .object({
    type: z.enum(["square", "hex-row", "hex-column", "isometric"]).optional(),
    size: positive.max(1000).optional(),
    squareSize: positive.max(1000).optional(),
    offsetX: finite.optional(),
    offsetY: finite.optional(),
    visible: z.boolean().optional(),
    snap: z.boolean().optional(),
  })
  .strict();

const createDocument = z
  .object({
    id,
    name,
    width: positive.max(32768).optional(),
    height: positive.max(32768).optional(),
    grid: grid.optional(),
    timestamp: finite.nonnegative().optional(),
  })
  .strict();

const layer = z
  .object({
    id,
    name,
    kind: z.enum(["background", "terrain", "objects", "walls", "lighting", "notes"]),
    visible: z.boolean(),
    locked: z.boolean(),
    opacity: unitInterval,
    zIndex: finite,
  })
  .strict();

const elementBase = {
  id,
  layerId: id,
  locked: z.boolean(),
  hidden: z.boolean(),
  transform,
};

const tileElement = z
  .object({
    ...elementBase,
    type: z.literal("tile"),
    data: z
      .object({
        assetId: id,
        columns: z.number().int().positive().max(1000),
        rows: z.number().int().positive().max(1000),
        tint: z.string().max(64).optional(),
      })
      .strict(),
  })
  .strict();

const stampElement = z
  .object({
    ...elementBase,
    type: z.literal("stamp"),
    data: z
      .object({
        assetId: id,
        width: positive.max(32768),
        height: positive.max(32768),
        tint: z.string().max(64).optional(),
      })
      .strict(),
  })
  .strict();

const shapeElement = z
  .object({
    ...elementBase,
    type: z.literal("shape"),
    data: z
      .object({
        shape: z.enum(["rectangle", "ellipse", "polygon"]),
        points: z.array(point).min(2).max(5000),
        stroke: z.string().max(64),
        strokeWidth: positive.max(1000),
        fill: z.string().max(64).optional(),
        opacity: unitInterval,
      })
      .strict(),
  })
  .strict();

const wallElement = z
  .object({
    ...elementBase,
    type: z.literal("wall"),
    data: z
      .object({
        points: z.array(point).min(2).max(5000),
        blocksMovement: z.boolean(),
        blocksVision: z.boolean(),
      })
      .strict(),
  })
  .strict();

const doorElement = z
  .object({
    ...elementBase,
    type: z.literal("door"),
    data: z
      .object({
        width: positive.max(1000),
        state: z.enum(["open", "closed", "locked", "secret"]),
        blocksMovement: z.boolean(),
        blocksVision: z.boolean(),
      })
      .strict(),
  })
  .strict();

const lightElement = z
  .object({
    ...elementBase,
    type: z.literal("light"),
    data: z
      .object({
        radius: positive.max(100000),
        color: z.string().max(64),
        intensity: unitInterval,
        castsShadows: z.boolean(),
      })
      .strict(),
  })
  .strict();

const textElement = z
  .object({
    ...elementBase,
    type: z.literal("text"),
    data: z
      .object({
        text: z.string().trim().min(1).max(2000),
        color: z.string().max(64),
        fontSize: positive.max(500),
        visibleToPlayers: z.boolean(),
      })
      .strict(),
  })
  .strict();

const element = z.discriminatedUnion("type", [
  tileElement,
  stampElement,
  shapeElement,
  wallElement,
  doorElement,
  lightElement,
  textElement,
]);

// Shared by paint-terrain and place-room (identical cell shape + 16384 cap).
const terrainCells = z
  .array(
    z
      .object({
        x: z.number().int().min(-65536).max(65536),
        y: z.number().int().min(-65536).max(65536),
        assetId: id.nullable(),
      })
      .strict(),
  )
  .min(1)
  .max(16384);
const elementsBatch = z.array(element).min(1).max(5000); // shared: add-elements + place-room

const commandBase = { commandId: id, documentId: id, baseRevision: z.number().int().nonnegative() };
const command = z.discriminatedUnion("type", [
  z.object({ ...commandBase, type: z.literal("undo") }).strict(),
  z.object({ ...commandBase, type: z.literal("redo") }).strict(),
  z.object({ ...commandBase, type: z.literal("update-grid"), update: grid }).strict(),
  z.object({ ...commandBase, type: z.literal("add-layer"), layer }).strict(),
  z
    .object({
      ...commandBase,
      type: z.literal("update-layer"),
      layerId: id,
      update: z
        .object({
          name: name.optional(),
          visible: z.boolean().optional(),
          locked: z.boolean().optional(),
          opacity: unitInterval.optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...commandBase,
      type: z.literal("move-layer"),
      layerId: id,
      targetIndex: z.number().int().nonnegative().max(1000),
    })
    .strict(),
  z.object({ ...commandBase, type: z.literal("remove-layer"), layerId: id }).strict(),
  z.object({ ...commandBase, type: z.literal("add-element"), element }).strict(),
  z.object({ ...commandBase, type: z.literal("add-elements"), elements: elementsBatch }).strict(),
  z
    .object({
      ...commandBase,
      type: z.literal("update-element"),
      elementId: id,
      update: z
        .object({
          layerId: id.optional(),
          locked: z.boolean().optional(),
          hidden: z.boolean().optional(),
          transform: transform.optional(),
        })
        .strict(),
    })
    .strict(),
  // Dedicated door-state authoring command: mirrors the doorElement.data
  // constraints (state enum, width <= 1000) so this narrow path is gated
  // exactly like add-element's door, without loosening update-element.
  z
    .object({
      ...commandBase,
      type: z.literal("update-door"),
      elementId: id,
      state: z.enum(["open", "closed", "locked", "secret"]),
      width: positive.max(1000),
    })
    .strict(),
  z.object({ ...commandBase, type: z.literal("remove-element"), elementId: id }).strict(),
  z.object({ ...commandBase, type: z.literal("paint-terrain"), cells: terrainCells }).strict(),
  z
    .object({
      ...commandBase,
      type: z.literal("place-room"),
      cells: terrainCells,
      elements: elementsBatch,
    })
    .strict(),
]);

export function validateMapStudioControlMessage(): ValidationResult {
  return { valid: true };
}

export function validateMapStudioCreateMessage(message: MessageRecord): ValidationResult {
  return validate(
    z.object({ t: z.literal("map-studio-create"), document: createDocument }),
    message,
  );
}

export function validateMapStudioDocumentIdMessage(message: MessageRecord): ValidationResult {
  return validate(
    z.object({ t: z.enum(["map-studio-get", "map-studio-delete"]), documentId: id }),
    message,
  );
}

export function validateMapStudioCommandMessage(message: MessageRecord): ValidationResult {
  return validate(z.object({ t: z.literal("map-studio-command"), command }), message);
}

// Shape-level bounds only; deep coverage rules (runs summing to one chunk,
// values inside the palette) are enforced by the shared sanitizeTerrainMap.
const terrainMap = z
  .object({
    schemaVersion: z.literal(1),
    palette: z.array(id).max(512),
    chunks: z.record(
      z.string().regex(/^-?\d+,-?\d+$/),
      z.array(z.number().int().min(0).max(512)).min(2).max(512),
    ),
  })
  .strict()
  .refine((value) => Object.keys(value.chunks).length <= 16384, {
    message: "Terrain map has too many chunks",
  });

export const importDocument = z
  .object({
    schemaVersion: z.literal(1),
    id,
    name,
    width: positive.max(32768),
    height: positive.max(32768),
    grid: grid.required(),
    layers: z.array(layer).min(1).max(200),
    elements: z.array(element).max(20000),
    terrain: terrainMap.optional(),
    revision: z.number().int().nonnegative(),
    createdAt: finite.nonnegative(),
    updatedAt: finite.nonnegative(),
  })
  .strict();

export function validateMapStudioImportMessage(message: MessageRecord): ValidationResult {
  return validate(
    z.object({ t: z.literal("map-studio-import"), document: importDocument }),
    message,
  );
}

export function validateMapStudioPublishMessage(message: MessageRecord): ValidationResult {
  return validate(
    z.object({
      t: z.literal("map-studio-publish"),
      documentId: id,
      // Same ceiling as the live map-background payload (10MB).
      background: z.string().min(1).max(PAYLOAD_LIMITS.MAP_SIZE),
      // Absent == "full" (legacy clients). "elements-only" makes the server
      // attach the document's terrain to the snapshot as data (R5).
      backgroundMode: z.enum(["full", "elements-only"]).optional(),
    }),
    message,
  );
}

function validate(schema: z.ZodTypeAny, message: MessageRecord): ValidationResult {
  const result = schema.safeParse(message);
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
