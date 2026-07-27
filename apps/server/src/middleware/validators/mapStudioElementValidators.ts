// Map-element zod schemas — split from mapStudioValidators (which sits at the
// 350-LOC structural ceiling, precedent mapStudioLiveValidators). The shared
// primitives live here with the element union so both files stay under the
// cap; mapStudioValidators re-imports what its document/command schemas need.

import { z } from "zod";

export const id = z.string().trim().min(1).max(128);
export const name = z.string().trim().min(1).max(200);
export const finite = z.number().finite();
export const positive = finite.positive();
export const unitInterval = finite.min(0).max(1);
const point = z.object({ x: finite, y: finite }).strict();
export const transform = z
  .object({ x: finite, y: finite, scaleX: positive, scaleY: positive, rotation: finite })
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

// Persistent authored curve (spline arc): anchors capped at 64 — a hand-
// authored curve, not a freehand stroke; kind routes bundled painter art.
const splineElement = z
  .object({
    ...elementBase,
    type: z.literal("spline"),
    data: z
      .object({
        points: z.array(point).min(2).max(64),
        kind: z.enum(["ribbon", "filigree", "rope", "chain"]),
        tint: z.string().max(64).optional(),
      })
      .strict(),
  })
  .strict();

export const element = z.discriminatedUnion("type", [
  tileElement,
  stampElement,
  shapeElement,
  wallElement,
  doorElement,
  lightElement,
  textElement,
  splineElement,
]);
