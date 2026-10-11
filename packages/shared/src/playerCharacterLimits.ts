// ============================================================================
// Player character limits
// ============================================================================
// How many characters one player may hold at a table (the owner's number,
// 2026-10-10). The DM's are not counted: a DM runs allies, and a DM is trusted.
//
// Shared because both halves have to agree: the client says so before sending
// an add it knows the server would refuse. Its own sub-module for the reason
// npcLimits.ts gives: an `export const` in the barrel is erased for the server.
//
// Without it a player could add characters until the table passed the
// 500-character snapshot limit, and the DM's backup failed its own load check.

export const PLAYER_CHARACTER_LIMITS = {
  PER_PLAYER: 5,
} as const;
