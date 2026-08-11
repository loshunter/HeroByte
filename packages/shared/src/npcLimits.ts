// ============================================================================
// NPC creation limits
// ============================================================================
// Bounds on bulk NPC creation (`create-npc`'s `count`).
//
// Shared because both halves have to agree: the DM's ×N control must not offer
// a number the validator will reject, and the validator must not admit one the
// control could never produce. The ceiling exists because the handler LOOPS on
// this value — an unbounded count is a self-inflicted denial of service, and
// `Number.isInteger(1e308)` is true, so the RANGE is what does the bounding.
//
// This lives in its own module rather than inline in index.ts for the same
// reason wsCloseCodes.ts does, and it is the second constant to need it: the
// server's tsconfig maps `@herobyte/shared` to dist/index.d.ts and tsx honors
// that at runtime, where a direct `export declare const` in the barrel's .d.ts
// is erased as an ambient type. A value RE-EXPORT from a real sub-module is
// followed through to the compiled .js instead.
//
// The failure mode is worth naming, because it is invisible to the test gate:
// the unit suites and the whole e2e suite stayed green (they resolve the
// package by other routes) while `pnpm dev` could not boot at all, dying with
// "does not provide an export named NPC_CREATE_LIMITS".

/**
 * 20 is well above "five goblins" and well under the 500-character snapshot
 * limit a session file is validated against on load.
 */
export const NPC_CREATE_LIMITS = {
  COUNT_MIN: 1,
  COUNT_MAX: 20,
} as const;
