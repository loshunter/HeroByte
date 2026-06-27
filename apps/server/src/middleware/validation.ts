// ============================================================================
// INPUT VALIDATION MIDDLEWARE (ORCHESTRATOR)
// ============================================================================
// Validates incoming WebSocket messages using domain-specific validators.
//
// The validator table below is keyed by ClientMessage["t"], so adding a new
// message type to the shared contract without registering a validator here is
// a COMPILE ERROR rather than a silent runtime rejection. (Previously,
// "request-room-resync", "clear-all-initiative", and
// "set-character-status-effects" were routed by dispatchers but unreachable in
// production because the validator switch didn't know about them.)

import type { ClientMessage } from "@herobyte/shared";
import type { ValidationResult, MessageRecord } from "./validators/index.js";
import { isRecord } from "./validators/index.js";

// Token validators
import {
  validateMoveMessage,
  validateRecolorMessage,
  validateDeleteTokenMessage,
  validateUpdateTokenImageMessage,
  validateSetTokenSizeMessage,
  validateSetTokenColorMessage,
  validateDragPreviewMessage,
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
  validateToggleNpcVisibilityMessage,
  validateClaimCharacterMessage,
  validateAddPlayerCharacterMessage,
  validateDeletePlayerCharacterMessage,
  validateUpdateCharacterNameMessage,
  validateUpdateCharacterHpMessage,
  validateSetCharacterPortraitMessage,
  validateSetCharacterStatusEffectsMessage,
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
  validateMapStudioControlMessage,
  validateMapStudioCreateMessage,
  validateMapStudioDocumentIdMessage,
  validateMapStudioCommandMessage,
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
  validateRequestRoomResyncMessage,
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

type ClientMessageType = ClientMessage["t"];

type MessageValidator = (message: MessageRecord) => ValidationResult;

/**
 * Exhaustive validator table.
 *
 * The mapped type `{ [K in ClientMessageType]: MessageValidator }` forces a
 * one-to-one correspondence with the shared ClientMessage union: a missing or
 * extraneous key fails type-checking.
 */
const messageValidators: { readonly [K in ClientMessageType]: MessageValidator } = {
  // ==========================================================================
  // TOKEN MESSAGES
  // ==========================================================================
  move: validateMoveMessage,
  recolor: validateRecolorMessage,
  "delete-token": validateDeleteTokenMessage,
  "update-token-image": validateUpdateTokenImageMessage,
  "set-token-size": validateSetTokenSizeMessage,
  "set-token-color": validateSetTokenColorMessage,
  "drag-preview": validateDragPreviewMessage,

  // ==========================================================================
  // PLAYER MESSAGES
  // ==========================================================================
  portrait: validatePortraitMessage,
  rename: validateRenameMessage,
  "mic-level": validateMicLevelMessage,
  "set-hp": validateSetHpMessage,
  "set-status-effects": validateSetStatusEffectsMessage,
  "toggle-dm": validateToggleDmMessage,

  // ==========================================================================
  // CHARACTER MESSAGES
  // ==========================================================================
  "create-character": validateCreateCharacterMessage,
  "create-npc": validateCreateNpcMessage,
  "update-npc": validateUpdateNpcMessage,
  "delete-npc": validateDeleteNpcMessage,
  "place-npc-token": validatePlaceNpcTokenMessage,
  "toggle-npc-visibility": validateToggleNpcVisibilityMessage,
  "claim-character": validateClaimCharacterMessage,
  "add-player-character": validateAddPlayerCharacterMessage,
  "delete-player-character": validateDeletePlayerCharacterMessage,
  "update-character-name": validateUpdateCharacterNameMessage,
  "update-character-hp": validateUpdateCharacterHpMessage,
  "set-character-portrait": validateSetCharacterPortraitMessage,
  "set-character-status-effects": validateSetCharacterStatusEffectsMessage,
  "link-token": validateLinkTokenMessage,

  // ==========================================================================
  // INITIATIVE / COMBAT MESSAGES
  // ==========================================================================
  "set-initiative": validateSetInitiativeMessage,
  "start-combat": validateCombatControlMessage,
  "end-combat": validateCombatControlMessage,
  "next-turn": validateCombatControlMessage,
  "previous-turn": validateCombatControlMessage,
  "clear-all-initiative": validateCombatControlMessage,

  // ==========================================================================
  // MAP MESSAGES
  // ==========================================================================
  "map-background": validateMapBackgroundMessage,
  "grid-size": validateGridSizeMessage,
  "grid-square-size": validateGridSquareSizeMessage,
  point: validatePointMessage,
  draw: validateDrawMessage,
  "undo-drawing": validateDrawingControlMessage,
  "redo-drawing": validateDrawingControlMessage,
  "clear-drawings": validateDrawingControlMessage,
  "deselect-drawing": validateDrawingControlMessage,
  "select-drawing": (message) => validateDrawingIdMessage(message, "select-drawing"),
  "delete-drawing": (message) => validateDrawingIdMessage(message, "delete-drawing"),
  "move-drawing": validateMoveDrawingMessage,
  "erase-partial": validateErasePartialMessage,
  "sync-player-drawings": validateSyncPlayerDrawingsMessage,
  "map-studio-list": validateMapStudioControlMessage,
  "map-studio-create": validateMapStudioCreateMessage,
  "map-studio-get": validateMapStudioDocumentIdMessage,
  "map-studio-command": validateMapStudioCommandMessage,
  "map-studio-delete": validateMapStudioDocumentIdMessage,

  // ==========================================================================
  // PROP MESSAGES
  // ==========================================================================
  "create-prop": validateCreatePropMessage,
  "update-prop": validateUpdatePropMessage,
  "delete-prop": validateDeletePropMessage,

  // ==========================================================================
  // SELECTION MESSAGES
  // ==========================================================================
  "select-object": validateSelectObjectMessage,
  "deselect-object": validateDeselectObjectMessage,
  "select-multiple": validateSelectMultipleMessage,
  "lock-selected": validateLockSelectedMessage,
  "unlock-selected": validateUnlockSelectedMessage,

  // ==========================================================================
  // ROOM / SESSION / AUTH MESSAGES
  // ==========================================================================
  "set-player-staging-zone": validateSetPlayerStagingZoneMessage,
  "set-room-password": validateSetRoomPasswordMessage,
  "clear-all-tokens": validateRoomControlMessage,
  heartbeat: validateRoomControlMessage,
  "load-session": validateLoadSessionMessage,
  "request-room-resync": validateRequestRoomResyncMessage,
  authenticate: validateAuthenticateMessage,
  "elevate-to-dm": validateElevateToDmMessage,
  "set-dm-password": validateSetDmPasswordMessage,
  "revoke-dm": validateRoomControlMessage,
  "transform-object": validateTransformObjectMessage,

  // ==========================================================================
  // DICE / RTC MESSAGES
  // ==========================================================================
  "dice-roll": validateDiceRollMessage,
  "clear-roll-history": validateRoomControlMessage,
  "rtc-signal": validateRtcSignalMessage,
};

/**
 * Validate a client message
 * Returns { valid: true } if message is valid, or { valid: false, error: string } if invalid
 */
export function validateMessage(raw: unknown): ValidationResult {
  if (!isRecord(raw) || typeof raw.t !== "string") {
    return { valid: false, error: "Missing or invalid message type" };
  }

  const validator = Object.prototype.hasOwnProperty.call(messageValidators, raw.t)
    ? messageValidators[raw.t as ClientMessageType]
    : undefined;

  if (!validator) {
    return { valid: false, error: `Unknown message type: ${raw.t}` };
  }

  return validator(raw);
}
