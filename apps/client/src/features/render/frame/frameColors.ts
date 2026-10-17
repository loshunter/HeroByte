// ============================================================================
// FRAME COLOURS — what "personal" means on one token (C5a)
// ============================================================================
// Through C1's normalizeColor, so an older table's hsl() colour still works.

import { normalizeColor, type TokenFrame } from "@herobyte/shared";

/** A colour nobody's token has, for an unreadable one: the frame still draws. */
export const FALLBACK_ACCENT = "#808080";

/** The colour the frame's "personal" palette roles take: its own pick, else the token's. */
export function frameAccent(frame: TokenFrame, color: string): string {
  const accent = frame.accent && frame.accent !== "personal" ? frame.accent : color;
  return normalizeColor(accent) ?? FALLBACK_ACCENT;
}

/** The character's own colour, for a "personal" glow even under a picked frame colour. */
export function framePersonal(color: string): string {
  return normalizeColor(color) ?? FALLBACK_ACCENT;
}
