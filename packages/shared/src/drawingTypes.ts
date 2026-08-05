// ============================================================================
// Drawing shape kinds
// ============================================================================
// Its own module rather than a direct `export const` in index.ts, for the
// reason wsCloseCodes.ts and npcLimits.ts both record: the server maps
// `@herobyte/shared` to dist/index.d.ts and tsx honors that at runtime, where a
// direct declaration in the barrel is erased as an ambient type and cannot be
// imported as a value. Nothing on the server imports this one TODAY — which is
// exactly why it was a latent trap rather than a visible break.

/**
 * Every shape kind a `Drawing` can hold. `eraser` is a gesture, never a stored
 * record — it is in the union because the client's tool state shares it.
 * `template` is an area of effect: its `points` are a closed polygon and its
 * `template` field says what shape produced them (see areaTemplates.ts).
 */
export const DRAWING_TYPES = ["freehand", "line", "rect", "circle", "eraser", "template"] as const;
export type DrawingType = (typeof DRAWING_TYPES)[number];
