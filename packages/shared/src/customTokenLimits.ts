// Bounds for a table's own Library tokens (customTokens). A sub-module with a
// value re-export from the barrel: an `export const` in index.ts is erased for
// the server at runtime, and every gate stays green while `pnpm dev` cannot
// boot (see npcLimits.ts).
export const CUSTOM_TOKEN_LIMITS = {
  /** create-npc's own name cap, so a pick never mints a name the wire refuses. */
  NAME_MAX: 50,
  DESCRIPTION_MAX: 300,
  TAG_MAX: 24,
  TAGS_MAX: 12,
  URL_MAX: 2048,
  /** Per table. SNAPSHOT_LIMITS.customTokens mirrors it; a test pins the two together. */
  COUNT_MAX: 200,
} as const;
