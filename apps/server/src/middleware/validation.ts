// ============================================================================
// INPUT VALIDATION MIDDLEWARE (ORCHESTRATOR)
// ============================================================================
// Validates incoming WebSocket messages using domain-specific validators

import type { ValidationResult } from "./validators/index.js";
import { isRecord } from "./validators/index.js";

// Token validators
import {
  validateMoveMessage,
  validateRecolorMessage,
  validateDeleteTokenMessage,
  validateUpdateTokenImageMessage,
  validateSetTokenSizeMessage,
  validateSetTokenColorMessage,
} from "./validators/index.js";

// Player validators
import {
  validatePortraitMessage,
  validateRenameMessage,
  validateMicLevelMessage,
  validateSetHpMessage,
  validateSetStatusEffectsMessage,
  validateToggleDmMessage,
} from "./validators/index.js";

// Character validators
import {
  validateCreateCharacterMessage,
  validateCreateNpcMessage,
  validateUpdateNpcMessage,
  validateDeleteNpcMessage,
  validatePlaceNpcTokenMessage,
  validateClaimCharacterMessage,
  validateAddPlayerCharacterMessage,
  validateDeletePlayerCharacterMessage,
  validateUpdateCharacterNameMessage,
  validateUpdateCharacterHpMessage,
  validateLinkTokenMessage,
  validateSetInitiativeMessage,
  validateCombatControlMessage,
} from "./validators/index.js";

// Map validators
import {
  validateMapBackgroundMessage,
  validateGridSizeMessage,
  validateGridSquareSizeMessage,
  validatePointMessage,
  validateDrawMessage,
  validateDrawingControlMessage,
  validateDrawingIdMessage,
  validateMoveDrawingMessage,
  validateErasePartialMessage,
  validateSyncPlayerDrawingsMessage,
} from "./validators/index.js";

// Prop validators
import {
  validateCreatePropMessage,
  validateUpdatePropMessage,
  validateDeletePropMessage,
} from "./validators/index.js";

// Room validators
import {
  validateSetPlayerStagingZoneMessage,
  validateSetRoomPasswordMessage,
  validateRoomControlMessage,
  validateLoadSessionMessage,
  validateAuthenticateMessage,
  validateElevateToDmMessage,
  validateSetDmPasswordMessage,
  validateTransformObjectMessage,
  validateDiceRollMessage,
  validateRtcSignalMessage,
} from "./validators/index.js";

// Selection validators
import {
  validateSelectObjectMessage,
  validateDeselectObjectMessage,
  validateSelectMultipleMessage,
  validateLockSelectedMessage,
  validateUnlockSelectedMessage,
} from "./validators/index.js";

/**
 * Validate a client message
 * Returns { valid: true } if message is valid, or { valid: false, error: string } if invalid
 */
export function validateMessage(raw: unknown): ValidationResult {
  if (!isRecord(raw) || typeof raw.t !== "string") {
    return { valid: false, error: "Missing or invalid message type" };
  }

  const message = raw;

  switch (message.t) {
    // ========================================================================
    // TOKEN MESSAGES
    // ========================================================================
    case "move":
      return validateMoveMessage(message);
    case "recolor":
      return validateRecolorMessage(message);
    case "delete-token":
      return validateDeleteTokenMessage(message);
    case "update-token-image":
      return validateUpdateTokenImageMessage(message);
    case "set-token-size":
      return validateSetTokenSizeMessage(message);
    case "set-token-color":
      return validateSetTokenColorMessage(message);

    // ========================================================================
    // PLAYER MESSAGES
    // ========================================================================
    case "portrait":
      return validatePortraitMessage(message);
    case "rename":
      return validateRenameMessage(message);
    case "mic-level":
      return validateMicLevelMessage(message);
    case "set-hp":
      return validateSetHpMessage(message);
    case "set-status-effects":
      return validateSetStatusEffectsMessage(message);
    case "toggle-dm":
      return validateToggleDmMessage(message);

    // ========================================================================
    // CHARACTER MESSAGES
    // ========================================================================
    case "create-character":
      return validateCreateCharacterMessage(message);
    case "create-npc":
      return validateCreateNpcMessage(message);
    case "update-npc":
      return validateUpdateNpcMessage(message);
    case "delete-npc":
      return validateDeleteNpcMessage(message);
    case "place-npc-token":
      return validatePlaceNpcTokenMessage(message);
    case "claim-character":
      return validateClaimCharacterMessage(message);
    case "add-player-character":
      return validateAddPlayerCharacterMessage(message);
    case "delete-player-character":
      return validateDeletePlayerCharacterMessage(message);
    case "update-character-name":
      return validateUpdateCharacterNameMessage(message);
    case "update-character-hp":
      return validateUpdateCharacterHpMessage(message);
    case "link-token":
      return validateLinkTokenMessage(message);
    case "set-initiative":
      return validateSetInitiativeMessage(message);
    case "start-combat":
    case "end-combat":
    case "next-turn":
    case "previous-turn":
      return validateCombatControlMessage();

    // ========================================================================
    // MAP MESSAGES
    // ========================================================================
    case "map-background":
      return validateMapBackgroundMessage(message);
    case "grid-size":
      return validateGridSizeMessage(message);
    case "grid-square-size":
      return validateGridSquareSizeMessage(message);
    case "point":
      return validatePointMessage(message);
    case "draw":
      return validateDrawMessage(message);
    case "undo-drawing":
    case "redo-drawing":
    case "clear-drawings":
    case "deselect-drawing":
      return validateDrawingControlMessage();
    case "select-drawing":
      return validateDrawingIdMessage(message, "select-drawing");
    case "delete-drawing":
      return validateDrawingIdMessage(message, "delete-drawing");
    case "move-drawing":
      return validateMoveDrawingMessage(message);
    case "erase-partial":
      return validateErasePartialMessage(message);
    case "sync-player-drawings":
      return validateSyncPlayerDrawingsMessage(message);

    // ========================================================================
    // PROP MESSAGES
    // ========================================================================
    case "create-prop":
      return validateCreatePropMessage(message);
    case "update-prop":
      return validateUpdatePropMessage(message);
    case "delete-prop":
      return validateDeletePropMessage(message);

    // ========================================================================
    // SELECTION MESSAGES
    // ========================================================================
    case "select-object":
      return validateSelectObjectMessage(message);
    case "deselect-object":
      return validateDeselectObjectMessage(message);
    case "select-multiple":
      return validateSelectMultipleMessage(message);
    case "lock-selected":
      return validateLockSelectedMessage(message);
    case "unlock-selected":
      return validateUnlockSelectedMessage(message);

    // ========================================================================
    // ROOM / SESSION / AUTH MESSAGES
    // ========================================================================
    case "set-player-staging-zone":
      return validateSetPlayerStagingZoneMessage(message);
    case "set-room-password":
      return validateSetRoomPasswordMessage(message);
    case "clear-all-tokens":
    case "heartbeat":
      return validateRoomControlMessage();
    case "load-session":
      return validateLoadSessionMessage(message);
    case "authenticate":
      return validateAuthenticateMessage(message);
    case "elevate-to-dm":
      return validateElevateToDmMessage(message);
    case "set-dm-password":
      return validateSetDmPasswordMessage(message);
    case "revoke-dm":
      return validateRoomControlMessage();
    case "transform-object":
      return validateTransformObjectMessage(message);

    // ========================================================================
    // DICE / RTC MESSAGES
    // ========================================================================
    case "dice-roll":
      return validateDiceRollMessage(message);
    case "clear-roll-history":
      return validateRoomControlMessage();
    case "rtc-signal":
      return validateRtcSignalMessage(message);

    // ========================================================================
    // UNKNOWN MESSAGE TYPE
    // ========================================================================
    default: {
      return { valid: false, error: `Unknown message type: ${message.t}` };
    }
  }
}
