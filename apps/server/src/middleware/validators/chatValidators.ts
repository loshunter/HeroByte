// ============================================================================
// CHAT VALIDATION
// ============================================================================
// Its own module rather than a block in roomValidators.ts, which sits close
// enough to the 350-LOC guardrail that adding to it trips the structure gate.
//
// Note what is NOT validated here: any notion of the author. A chat message
// carries no identity field at all — the server stamps it from the sending
// connection. A validator that accepted an author would be the same defect
// as D2 (forgeable dice), just relocated.

import type { ValidationResult, MessageRecord } from "./commonValidators.js";
import { STRING_LIMITS } from "./constants.js";

/**
 * `{ t: "chat"; text: string; to?: string }`
 *
 * House style is REJECT, not truncate: an over-long message is refused so
 * the sender finds out, rather than silently losing its tail. The one place
 * the server truncates instead (table names) does so because the value is
 * cosmetic; a chat message is not.
 */
export function validateChatMessage(message: MessageRecord): ValidationResult {
  if (typeof message.text !== "string") {
    return { valid: false, error: "chat: missing or invalid text" };
  }

  // Trim before measuring: whitespace-only is empty, and a message padded to
  // the cap with spaces should not be accepted as if it were content.
  const trimmed = message.text.trim();
  if (trimmed.length < STRING_LIMITS.CHAT_TEXT_MIN) {
    return { valid: false, error: "chat: text cannot be empty" };
  }
  if (trimmed.length > STRING_LIMITS.CHAT_TEXT_MAX) {
    return {
      valid: false,
      error: `chat: text exceeds ${STRING_LIMITS.CHAT_TEXT_MAX} characters`,
    };
  }

  // `to` is optional; when present it must be a plausible uid. It is NOT
  // checked against the player list here — an unknown target simply reaches
  // nobody, and probing which uids exist by watching for a validation error
  // would be an enumeration oracle.
  if (message.to !== undefined) {
    if (typeof message.to !== "string" || message.to.trim().length === 0) {
      return { valid: false, error: "chat: invalid whisper target" };
    }
    if (message.to.length > STRING_LIMITS.SECRET_MAX) {
      return { valid: false, error: "chat: whisper target too long" };
    }
  }

  return { valid: true };
}

/** `{ t: "clear-chat-log" }` — no payload; authorization is the router's job. */
export function validateClearChatLogMessage(): ValidationResult {
  return { valid: true };
}
