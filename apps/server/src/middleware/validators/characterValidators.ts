// ============================================================================
// CHARACTER VALIDATION
// ============================================================================
// Validates character and NPC-related messages

import type { ValidationResult, MessageRecord } from "./commonValidators.js";
import { isFiniteNumber } from "./commonValidators.js";

/**
 * Validate create-character message
 * Required: name (string, 1-50 chars), maxHp (positive finite number)
 * Optional: portrait (string, max 2MB)
 */
export function validateCreateCharacterMessage(message: MessageRecord): ValidationResult {
  const { name, maxHp, portrait } = message;
  if (typeof name !== "string" || name.length === 0 || name.length > 50) {
    return { valid: false, error: "create-character: name must be 1-50 characters" };
  }
  if (!isFiniteNumber(maxHp) || maxHp <= 0) {
    return { valid: false, error: "create-character: maxHp must be positive" };
  }
  if (portrait !== undefined) {
    if (typeof portrait !== "string") {
      return { valid: false, error: "create-character: portrait must be a string" };
    }
    if (portrait.length > 2 * 1024 * 1024) {
      return { valid: false, error: "create-character: portrait too large (max 2MB)" };
    }
  }
  return { valid: true };
}

/**
 * Validate create-npc message
 * Required: name (string, 1-50 chars), hp (positive), maxHp (positive)
 * Optional: portrait (string), tokenImage (string)
 */
export function validateCreateNpcMessage(message: MessageRecord): ValidationResult {
  const { name, hp, maxHp, portrait, tokenImage } = message;
  if (typeof name !== "string" || name.length === 0 || name.length > 50) {
    return { valid: false, error: "create-npc: name must be 1-50 characters" };
  }
  if (!isFiniteNumber(hp) || hp <= 0) {
    return { valid: false, error: "create-npc: hp must be positive" };
  }
  if (!isFiniteNumber(maxHp) || maxHp <= 0) {
    return { valid: false, error: "create-npc: maxHp must be positive" };
  }
  if (portrait !== undefined && typeof portrait !== "string") {
    return { valid: false, error: "create-npc: portrait must be a string" };
  }
  if (typeof tokenImage !== "undefined" && typeof tokenImage !== "string") {
    return { valid: false, error: "create-npc: tokenImage must be a string" };
  }
  return { valid: true };
}

/**
 * Validate update-npc message
 * Required: id (string), name (string, 1-50 chars), hp (non-negative), maxHp (positive)
 * Optional: portrait (string), tokenImage (string)
 */
export function validateUpdateNpcMessage(message: MessageRecord): ValidationResult {
  const { id, name, hp, maxHp, portrait, tokenImage } = message;
  if (typeof id !== "string" || id.length === 0) {
    return { valid: false, error: "update-npc: missing or invalid id" };
  }
  if (typeof name !== "string" || name.length === 0 || name.length > 50) {
    return { valid: false, error: "update-npc: name must be 1-50 characters" };
  }
  if (!isFiniteNumber(hp) || hp < 0) {
    return { valid: false, error: "update-npc: hp must be non-negative" };
  }
  if (!isFiniteNumber(maxHp) || maxHp <= 0) {
    return { valid: false, error: "update-npc: maxHp must be positive" };
  }
  if (portrait !== undefined && typeof portrait !== "string") {
    return { valid: false, error: "update-npc: portrait must be a string" };
  }
  if (tokenImage !== undefined && typeof tokenImage !== "string") {
    return { valid: false, error: "update-npc: tokenImage must be a string" };
  }
  return { valid: true };
}

/**
 * Validate delete-npc message
 * Required: id (string)
 */
export function validateDeleteNpcMessage(message: MessageRecord): ValidationResult {
  if (typeof message.id !== "string" || message.id.length === 0) {
    return { valid: false, error: "delete-npc: missing or invalid id" };
  }
  return { valid: true };
}

/**
 * Validate place-npc-token message
 * Required: id (string)
 */
export function validatePlaceNpcTokenMessage(message: MessageRecord): ValidationResult {
  if (typeof message.id !== "string" || message.id.length === 0) {
    return { valid: false, error: "place-npc-token: missing or invalid id" };
  }
  return { valid: true };
}

/**
 * Validate claim-character message
 * Required: characterId (string)
 */
export function validateClaimCharacterMessage(message: MessageRecord): ValidationResult {
  if (typeof message.characterId !== "string" || message.characterId.length === 0) {
    return { valid: false, error: "claim-character: missing or invalid characterId" };
  }
  return { valid: true };
}

/**
 * Validate add-player-character message
 * Required: name (string, 1-100 chars)
 * Optional: maxHp (positive finite number)
 */
export function validateAddPlayerCharacterMessage(message: MessageRecord): ValidationResult {
  if (typeof message.name !== "string" || message.name.length === 0 || message.name.length > 100) {
    return { valid: false, error: "add-player-character: name must be 1-100 characters" };
  }
  if (message.maxHp !== undefined && (!isFiniteNumber(message.maxHp) || message.maxHp <= 0)) {
    return { valid: false, error: "add-player-character: maxHp must be positive" };
  }
  return { valid: true };
}

/**
 * Validate delete-player-character message
 * Required: characterId (string)
 */
export function validateDeletePlayerCharacterMessage(message: MessageRecord): ValidationResult {
  if (typeof message.characterId !== "string" || message.characterId.length === 0) {
    return { valid: false, error: "delete-player-character: missing or invalid characterId" };
  }
  return { valid: true };
}

/**
 * Validate update-character-name message
 * Required: characterId (string), name (string, 1-100 chars)
 */
export function validateUpdateCharacterNameMessage(message: MessageRecord): ValidationResult {
  if (typeof message.characterId !== "string" || message.characterId.length === 0) {
    return { valid: false, error: "update-character-name: missing or invalid characterId" };
  }
  if (typeof message.name !== "string" || message.name.length === 0 || message.name.length > 100) {
    return { valid: false, error: "update-character-name: name must be 1-100 characters" };
  }
  return { valid: true };
}

/**
 * Validate update-character-hp message
 * Required: characterId (string), hp (non-negative), maxHp (non-negative)
 */
export function validateUpdateCharacterHpMessage(message: MessageRecord): ValidationResult {
  const { characterId, hp, maxHp } = message;
  if (typeof characterId !== "string" || characterId.length === 0) {
    return { valid: false, error: "update-character-hp: missing or invalid characterId" };
  }
  if (!isFiniteNumber(hp) || !isFiniteNumber(maxHp)) {
    return { valid: false, error: "update-character-hp: missing or invalid hp/maxHp" };
  }
  if (hp < 0 || maxHp < 0) {
    return { valid: false, error: "update-character-hp: hp/maxHp cannot be negative" };
  }
  return { valid: true };
}

/**
 * Validate link-token message (link character to token)
 * Required: characterId (string), tokenId (string)
 */
export function validateLinkTokenMessage(message: MessageRecord): ValidationResult {
  if (typeof message.characterId !== "string" || message.characterId.length === 0) {
    return { valid: false, error: "link-token: missing or invalid characterId" };
  }
  if (typeof message.tokenId !== "string" || message.tokenId.length === 0) {
    return { valid: false, error: "link-token: missing or invalid tokenId" };
  }
  return { valid: true };
}

/**
 * Validate set-initiative message
 * Required: characterId (string), initiative (finite number)
 * Optional: initiativeModifier (finite number)
 */
export function validateSetInitiativeMessage(message: MessageRecord): ValidationResult {
  if (typeof message.characterId !== "string" || message.characterId.length === 0) {
    return { valid: false, error: "set-initiative: missing or invalid characterId" };
  }
  if (!isFiniteNumber(message.initiative)) {
    return { valid: false, error: "set-initiative: initiative must be a number" };
  }
  if (
    "initiativeModifier" in message &&
    message.initiativeModifier !== undefined &&
    !isFiniteNumber(message.initiativeModifier)
  ) {
    return { valid: false, error: "set-initiative: initiativeModifier must be a number" };
  }
  return { valid: true };
}

/**
 * Validate combat control messages (no parameters needed)
 * These messages require authentication but have no payload validation
 */
export function validateCombatControlMessage(): ValidationResult {
  return { valid: true };
}
