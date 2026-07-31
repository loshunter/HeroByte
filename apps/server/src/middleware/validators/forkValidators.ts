// ============================================================================
// TABLE FORK VALIDATION
// ============================================================================
// Its own module rather than a block in roomValidators.ts, which sits close
// enough to the 350-LOC guardrail that adding to it trips the structure gate.

import type { ValidationResult, MessageRecord } from "./commonValidators.js";
import { STRING_LIMITS } from "./constants.js";
import { validateCreateRoomMessage } from "./roomValidators.js";

/** Same shape as create-room, plus the display name the copy is filed under. */
export function validateForkTableMessage(message: MessageRecord): ValidationResult {
  const asCreate = validateCreateRoomMessage(message);
  if (!asCreate.valid) {
    return { valid: false, error: asCreate.error?.replace("create-room:", "fork-table:") };
  }
  if (typeof message.name !== "string" || message.name.trim().length === 0) {
    return { valid: false, error: "fork-table: missing or invalid name" };
  }
  if (message.name.length > STRING_LIMITS.SECRET_MAX) {
    return { valid: false, error: "fork-table: name too long" };
  }
  return { valid: true };
}
