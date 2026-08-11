// ============================================================================
// Prop creation limits
// ============================================================================
// Bounds on bulk prop creation (`create-prop`'s `count` — the scatter control).
//
// Shared because both halves have to agree: the scatter control must not offer
// a number the validator will reject, and the validator must not admit one the
// control could never produce. The ceiling exists because the handler LOOPS on
// this value — an unbounded count is a self-inflicted denial of service, and
// `Number.isInteger(1e308)` is true, so the RANGE is what does the bounding.
//
// A real sub-module with a value re-export from index.ts, NOT an inline
// `export const` in the barrel — see npcLimits.ts for the full failure mode
// (green gates, dev server that cannot boot).

/**
 * 20 matches NPC_CREATE_LIMITS: enough to scatter a crate pile in one message,
 * well under the 500-prop snapshot limit a session file is validated against
 * on load.
 */
export const PROP_CREATE_LIMITS = {
  COUNT_MIN: 1,
  COUNT_MAX: 20,
} as const;
