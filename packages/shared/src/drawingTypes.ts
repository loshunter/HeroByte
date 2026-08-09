// ============================================================================
// Drawing shape kinds
// ============================================================================
// Its own module rather than a direct `export const` in index.ts, for the
// reason wsCloseCodes.ts and npcLimits.ts both record: the server maps
// `@herobyte/shared` to dist/index.d.ts and tsx honors that at runtime, where a
// direct declaration in the barrel is erased as an ambient type and cannot be
// imported as a value. Nothing on the SERVER imports this one, which is exactly
// why it was a latent trap rather than a visible break — keep it a sub-module
// even so, or the trap re-arms the moment a server file wants the list.
//
// The client DOES import the value now (utils/characterDrawings.ts). Note that
// proves nothing about the erasure hazard above: the client resolves this
// package from src/, so it never goes near dist/index.d.ts. What that import
// buys is a single source of truth — the sanitiser used to keep its own copy,
// and a SUBSET copy still assigns cleanly to Drawing["type"], so dropping a
// member from it compiled and typechecked green while silently rewriting every
// imported cone to "freehand".

/**
 * Every shape kind a `Drawing` can hold. `eraser` is a gesture, never a stored
 * record — it is in the union because the client's tool state shares it.
 * `template` is an area of effect: its `points` are a closed polygon and its
 * `template` field says what shape produced them (see areaTemplates.ts).
 */
export const DRAWING_TYPES = ["freehand", "line", "rect", "circle", "eraser", "template"] as const;
export type DrawingType = (typeof DRAWING_TYPES)[number];
