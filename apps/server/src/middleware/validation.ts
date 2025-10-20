// ============================================================================
// INPUT VALIDATION MIDDLEWARE
// ============================================================================
// Validates incoming WebSocket messages to prevent malformed or malicious data

import type { DrawingSegmentPayload } from "@shared";

/**
 * Validation result
 */
interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a client message
 * Returns { valid: true } if message is valid, or { valid: false, error: string } if invalid
 */
type MessageRecord = Record<string, unknown>;

function isRecord(value: unknown): value is MessageRecord {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

const SELECTION_MODES = ["replace", "append", "subtract"] as const;
const MAX_PARTIAL_SEGMENTS = 50;
const MAX_SEGMENT_POINTS = 10_000;

interface Point {
  x: number;
  y: number;
}

function isPoint(value: unknown): value is Point {
  return (
    isRecord(value) &&
    isFiniteNumber((value as MessageRecord).x) &&
    isFiniteNumber((value as MessageRecord).y)
  );
}

function validatePartialSegment(segment: unknown, index: number): ValidationResult {
  if (!isRecord(segment)) {
    return { valid: false, error: `erase-partial: segment ${index} must be an object` };
  }

  const payload = segment as DrawingSegmentPayload;

  if (payload.type !== "freehand") {
    return { valid: false, error: "erase-partial: segment type must be freehand" };
  }

  if (!Array.isArray(payload.points)) {
    return { valid: false, error: "erase-partial: segments must provide point arrays" };
  }
  if (payload.points.length < 2) {
    return { valid: false, error: "erase-partial: segments must contain at least 2 points" };
  }
  if (payload.points.length > MAX_SEGMENT_POINTS) {
    return {
      valid: false,
      error: `erase-partial: segment exceeds point limit (max ${MAX_SEGMENT_POINTS})`,
    };
  }
  if (!payload.points.every((point) => isPoint(point))) {
    return { valid: false, error: "erase-partial: segment points must contain finite coordinates" };
  }

  if (
    typeof payload.color !== "string" ||
    payload.color.length === 0 ||
    payload.color.length > 128
  ) {
    return { valid: false, error: "erase-partial: segment color must be a non-empty string" };
  }

  if (!isFiniteNumber(payload.width) || payload.width <= 0 || payload.width > 200) {
    return { valid: false, error: "erase-partial: segment width must be between 0 and 200" };
  }

  if (!isFiniteNumber(payload.opacity) || payload.opacity < 0 || payload.opacity > 1) {
    return { valid: false, error: "erase-partial: segment opacity must be between 0 and 1" };
  }

  if ("filled" in payload && payload.filled !== undefined && typeof payload.filled !== "boolean") {
    return { valid: false, error: "erase-partial: segment filled flag must be boolean" };
  }

  if ("owner" in payload && payload.owner !== undefined && typeof payload.owner !== "string") {
    return { valid: false, error: "erase-partial: segment owner must be a string when provided" };
  }

  if ("selectedBy" in payload && payload.selectedBy !== undefined) {
    return { valid: false, error: "erase-partial: segment cannot include selection metadata" };
  }

  return { valid: true };
}

function validateStagingZone(value: unknown, context: string): ValidationResult {
  if (value === null || value === undefined) {
    return { valid: true };
  }

  if (!isRecord(value)) {
    return { valid: false, error: `${context}: zone must be an object, null, or undefined` };
  }

  const zone = value as MessageRecord;

  if (!isFiniteNumber(zone.x) || !isFiniteNumber(zone.y)) {
    return { valid: false, error: `${context}: zone x/y must be finite numbers` };
  }
  if (!isFiniteNumber(zone.width) || !isFiniteNumber(zone.height)) {
    return { valid: false, error: `${context}: zone width/height must be finite numbers` };
  }

  if (Math.abs(zone.width as number) < 0.5 || Math.abs(zone.height as number) < 0.5) {
    return { valid: false, error: `${context}: zone width/height must be at least 0.5` };
  }

  if (
    "rotation" in zone &&
    zone.rotation !== undefined &&
    !isFiniteNumber(zone.rotation as number)
  ) {
    return { valid: false, error: `${context}: zone rotation must be a number when provided` };
  }

  return { valid: true };
}

function validateDrawingPayload(drawing: unknown, context: string): ValidationResult {
  if (!isRecord(drawing)) {
    return { valid: false, error: `${context}: drawing must be an object` };
  }

  const payload = drawing as MessageRecord;

  if (payload.id !== undefined && typeof payload.id !== "string") {
    return { valid: false, error: `${context}: drawing id must be a string` };
  }

  if (typeof payload.type !== "string" || payload.type.length === 0) {
    return { valid: false, error: `${context}: drawing type must be a non-empty string` };
  }

  if (!Array.isArray(payload.points) || payload.points.length === 0) {
    return { valid: false, error: `${context}: drawing must include point coordinates` };
  }

  if (payload.points.length > MAX_SEGMENT_POINTS) {
    return {
      valid: false,
      error: `${context}: drawing exceeds point limit (max ${MAX_SEGMENT_POINTS})`,
    };
  }

  if (!payload.points.every((point) => isPoint(point))) {
    return { valid: false, error: `${context}: drawing points must contain finite coordinates` };
  }

  if (
    typeof payload.color !== "string" ||
    payload.color.length === 0 ||
    payload.color.length > 128
  ) {
    return { valid: false, error: `${context}: drawing color must be a non-empty string` };
  }

  if (!isFiniteNumber(payload.width) || payload.width <= 0 || payload.width > 200) {
    return { valid: false, error: `${context}: drawing width must be between 0 and 200` };
  }

  if (!isFiniteNumber(payload.opacity) || payload.opacity < 0 || payload.opacity > 1) {
    return { valid: false, error: `${context}: drawing opacity must be between 0 and 1` };
  }

  if ("filled" in payload && payload.filled !== undefined && typeof payload.filled !== "boolean") {
    return { valid: false, error: `${context}: drawing filled flag must be boolean` };
  }

  if ("owner" in payload && payload.owner !== undefined && typeof payload.owner !== "string") {
    return { valid: false, error: `${context}: drawing owner must be a string when provided` };
  }

  if ("selectedBy" in payload && payload.selectedBy !== undefined) {
    return { valid: false, error: `${context}: drawing cannot include selection metadata` };
  }

  return { valid: true };
}

export function validateMessage(raw: unknown): ValidationResult {
  if (!isRecord(raw) || typeof raw.t !== "string") {
    return { valid: false, error: "Missing or invalid message type" };
  }

  const message = raw;

  switch (message.t) {
    case "move": {
      const { id, x, y } = message;
      if (typeof id !== "string") {
        return { valid: false, error: "move: missing or invalid id" };
      }
      if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
        return { valid: false, error: "move: missing or invalid x/y coordinates" };
      }
      break;
    }

    case "recolor":
    case "delete-token": {
      if (typeof message.id !== "string") {
        return { valid: false, error: `${message.t}: missing or invalid id` };
      }
      break;
    }

    case "portrait": {
      const { data } = message;
      if (typeof data !== "string") {
        return { valid: false, error: "portrait: missing or invalid data" };
      }
      if (data.length > 2 * 1024 * 1024) {
        return { valid: false, error: "portrait: data too large (max 2MB)" };
      }
      break;
    }

    case "rename": {
      const { name } = message;
      if (typeof name !== "string") {
        return { valid: false, error: "rename: missing or invalid name" };
      }
      if (name.length === 0 || name.length > 50) {
        return { valid: false, error: "rename: name must be 1-50 characters" };
      }
      break;
    }

    case "mic-level": {
      const { level } = message;
      if (!isFiniteNumber(level) || level < 0 || level > 1) {
        return { valid: false, error: "mic-level: level must be between 0 and 1" };
      }
      break;
    }

    case "toggle-dm": {
      if (typeof message.isDM !== "boolean") {
        return { valid: false, error: "toggle-dm: isDM must be boolean" };
      }
      break;
    }

    case "set-room-password": {
      if (typeof message.secret !== "string") {
        return { valid: false, error: "set-room-password: secret must be a string" };
      }
      const trimmed = message.secret.trim();
      if (trimmed.length === 0) {
        return { valid: false, error: "set-room-password: secret is empty" };
      }
      if (trimmed.length > 256) {
        return { valid: false, error: "set-room-password: secret too long" };
      }
      break;
    }

    case "set-hp": {
      const { hp, maxHp } = message;
      if (!isFiniteNumber(hp) || !isFiniteNumber(maxHp)) {
        return { valid: false, error: "set-hp: missing or invalid hp/maxHp" };
      }
      if (hp < 0 || maxHp < 0) {
        return { valid: false, error: "set-hp: hp/maxHp cannot be negative" };
      }
      break;
    }

    case "set-status-effects": {
      const { effects } = message;
      if (!Array.isArray(effects)) {
        return { valid: false, error: "set-status-effects: effects must be an array" };
      }
      if (effects.length > 16) {
        return { valid: false, error: "set-status-effects: too many effects (max 16)" };
      }
      for (const effect of effects) {
        if (typeof effect !== "string") {
          return { valid: false, error: "set-status-effects: effects must be strings" };
        }
        const trimmed = effect.trim();
        if (trimmed.length === 0) {
          return { valid: false, error: "set-status-effects: effect labels cannot be empty" };
        }
        if (trimmed.length > 64) {
          return {
            valid: false,
            error: "set-status-effects: effect labels too long (max 64 chars)",
          };
        }
      }
      break;
    }

    case "create-character": {
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
      break;
    }

    case "create-npc": {
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
      break;
    }

    case "update-npc": {
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
      break;
    }

    case "delete-npc": {
      if (typeof message.id !== "string" || message.id.length === 0) {
        return { valid: false, error: "delete-npc: missing or invalid id" };
      }
      break;
    }

    case "place-npc-token": {
      if (typeof message.id !== "string" || message.id.length === 0) {
        return { valid: false, error: "place-npc-token: missing or invalid id" };
      }
      break;
    }

    case "claim-character": {
      if (typeof message.characterId !== "string" || message.characterId.length === 0) {
        return { valid: false, error: "claim-character: missing or invalid characterId" };
      }
      break;
    }

    case "add-player-character": {
      if (
        typeof message.name !== "string" ||
        message.name.length === 0 ||
        message.name.length > 100
      ) {
        return { valid: false, error: "add-player-character: name must be 1-100 characters" };
      }
      if (message.maxHp !== undefined && (!isFiniteNumber(message.maxHp) || message.maxHp <= 0)) {
        return { valid: false, error: "add-player-character: maxHp must be positive" };
      }
      break;
    }

    case "update-character-hp": {
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
      break;
    }

    case "link-token": {
      if (typeof message.characterId !== "string" || message.characterId.length === 0) {
        return { valid: false, error: "link-token: missing or invalid characterId" };
      }
      if (typeof message.tokenId !== "string" || message.tokenId.length === 0) {
        return { valid: false, error: "link-token: missing or invalid tokenId" };
      }
      break;
    }

    case "map-background": {
      const { data } = message;
      if (typeof data !== "string") {
        return { valid: false, error: "map-background: missing or invalid data" };
      }
      if (data.length > 10 * 1024 * 1024) {
        return { valid: false, error: "map-background: data too large (max 10MB)" };
      }
      break;
    }

    case "grid-size": {
      const { size } = message;
      if (!isFiniteNumber(size) || size < 10 || size > 500) {
        return { valid: false, error: "grid-size: size must be between 10 and 500" };
      }
      break;
    }

    case "grid-square-size": {
      const { size } = message;
      if (!isFiniteNumber(size) || size < 0.1 || size > 100) {
        return { valid: false, error: "grid-square-size: size must be between 0.1 and 100 feet" };
      }
      break;
    }

    case "set-player-staging-zone": {
      const validation = validateStagingZone(message.zone, "set-player-staging-zone");
      if (!validation.valid) {
        return validation;
      }
      break;
    }

    case "update-token-image": {
      if (typeof message.tokenId !== "string" || message.tokenId.length === 0) {
        return { valid: false, error: "update-token-image: missing or invalid tokenId" };
      }
      if (typeof message.imageUrl !== "string") {
        return { valid: false, error: "update-token-image: imageUrl must be a string" };
      }
      if (message.imageUrl.length > 2048) {
        return { valid: false, error: "update-token-image: imageUrl too long (max 2048 chars)" };
      }
      break;
    }

    case "set-token-size": {
      if (typeof message.tokenId !== "string" || message.tokenId.length === 0) {
        return { valid: false, error: "set-token-size: tokenId required" };
      }
      if (typeof message.size !== "string") {
        return { valid: false, error: "set-token-size: size must be a string" };
      }
      const validSizes = ["tiny", "small", "medium", "large", "huge", "gargantuan"];
      if (!validSizes.includes(message.size)) {
        return {
          valid: false,
          error: "set-token-size: invalid size (must be tiny/small/medium/large/huge/gargantuan)",
        };
      }
      break;
    }

    case "set-token-color": {
      if (typeof message.tokenId !== "string" || message.tokenId.length === 0) {
        return { valid: false, error: "set-token-color: tokenId required" };
      }
      if (typeof message.color !== "string") {
        return { valid: false, error: "set-token-color: color must be a string" };
      }
      const trimmed = message.color.trim();
      if (trimmed.length === 0) {
        return { valid: false, error: "set-token-color: color cannot be empty" };
      }
      if (trimmed.length > 128) {
        return { valid: false, error: "set-token-color: color too long (max 128 chars)" };
      }
      break;
    }

    case "select-object": {
      if (typeof message.uid !== "string" || message.uid.length === 0) {
        return { valid: false, error: "select-object: missing or invalid uid" };
      }
      if (typeof message.objectId !== "string" || message.objectId.length === 0) {
        return { valid: false, error: "select-object: missing or invalid objectId" };
      }
      break;
    }

    case "deselect-object": {
      if (typeof message.uid !== "string" || message.uid.length === 0) {
        return { valid: false, error: "deselect-object: missing or invalid uid" };
      }
      break;
    }

    case "select-multiple": {
      if (typeof message.uid !== "string" || message.uid.length === 0) {
        return { valid: false, error: "select-multiple: missing or invalid uid" };
      }
      if (!Array.isArray(message.objectIds) || message.objectIds.length === 0) {
        return {
          valid: false,
          error: "select-multiple: objectIds must be a non-empty string array",
        };
      }
      if (message.objectIds.length > 100) {
        return { valid: false, error: "select-multiple: too many objectIds (max 100)" };
      }
      if (!message.objectIds.every((id) => typeof id === "string" && id.length > 0)) {
        return {
          valid: false,
          error: "select-multiple: objectIds must be a non-empty string array",
        };
      }
      if ("mode" in message && message.mode !== undefined) {
        if (typeof message.mode !== "string") {
          return { valid: false, error: "select-multiple: mode must be a string" };
        }
        if (!SELECTION_MODES.includes(message.mode as (typeof SELECTION_MODES)[number])) {
          return {
            valid: false,
            error: "select-multiple: invalid mode (replace, append, subtract)",
          };
        }
      }
      break;
    }

    case "lock-selected": {
      if (typeof message.uid !== "string" || message.uid.length === 0) {
        return { valid: false, error: "lock-selected: missing or invalid uid" };
      }
      if (!Array.isArray(message.objectIds) || message.objectIds.length === 0) {
        return {
          valid: false,
          error: "lock-selected: objectIds must be a non-empty string array",
        };
      }
      if (message.objectIds.length > 100) {
        return { valid: false, error: "lock-selected: too many objectIds (max 100)" };
      }
      if (!message.objectIds.every((id) => typeof id === "string" && id.length > 0)) {
        return {
          valid: false,
          error: "lock-selected: objectIds must be a non-empty string array",
        };
      }
      break;
    }

    case "unlock-selected": {
      if (typeof message.uid !== "string" || message.uid.length === 0) {
        return { valid: false, error: "unlock-selected: missing or invalid uid" };
      }
      if (!Array.isArray(message.objectIds) || message.objectIds.length === 0) {
        return {
          valid: false,
          error: "unlock-selected: objectIds must be a non-empty string array",
        };
      }
      if (message.objectIds.length > 100) {
        return { valid: false, error: "unlock-selected: too many objectIds (max 100)" };
      }
      if (!message.objectIds.every((id) => typeof id === "string" && id.length > 0)) {
        return {
          valid: false,
          error: "unlock-selected: objectIds must be a non-empty string array",
        };
      }
      break;
    }

    case "point": {
      const { x, y } = message;
      if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
        return { valid: false, error: "point: missing or invalid x/y coordinates" };
      }
      break;
    }

    case "draw": {
      const validation = validateDrawingPayload(message.drawing, "draw");
      if (!validation.valid) {
        return validation;
      }
      break;
    }

    case "undo-drawing":
    case "redo-drawing":
    case "clear-drawings":
    case "deselect-drawing":
    case "clear-roll-history":
    case "clear-all-tokens":
    case "heartbeat": {
      break;
    }

    case "load-session": {
      const snapshot = message.snapshot;
      if (!isRecord(snapshot)) {
        return { valid: false, error: "load-session: missing or invalid snapshot data" };
      }
      if (
        !Array.isArray(snapshot.players) ||
        !Array.isArray(snapshot.tokens) ||
        !Array.isArray(snapshot.drawings)
      ) {
        return {
          valid: false,
          error: "load-session: snapshot must contain players, tokens, and drawings arrays",
        };
      }
      break;
    }

    case "select-drawing":
    case "delete-drawing": {
      if (typeof message.id !== "string" || message.id.length === 0) {
        return { valid: false, error: `${message.t}: missing or invalid drawing id` };
      }
      break;
    }

    case "erase-partial": {
      if (typeof message.deleteId !== "string" || message.deleteId.length === 0) {
        return { valid: false, error: "erase-partial: missing deleteId" };
      }
      if (!Array.isArray(message.segments)) {
        return { valid: false, error: "erase-partial: segments must be an array" };
      }
      if (message.segments.length > MAX_PARTIAL_SEGMENTS) {
        return {
          valid: false,
          error: `erase-partial: too many segments (max ${MAX_PARTIAL_SEGMENTS})`,
        };
      }
      for (let index = 0; index < message.segments.length; index += 1) {
        const validation = validatePartialSegment(message.segments[index], index);
        if (!validation.valid) {
          return validation;
        }
      }
      break;
    }

    case "sync-player-drawings": {
      if (!Array.isArray(message.drawings)) {
        return { valid: false, error: "sync-player-drawings: drawings must be an array" };
      }
      if (message.drawings.length > 200) {
        return { valid: false, error: "sync-player-drawings: too many drawings (max 200)" };
      }
      for (let index = 0; index < message.drawings.length; index += 1) {
        const validation = validateDrawingPayload(
          message.drawings[index],
          `sync-player-drawings[${index}]`,
        );
        if (!validation.valid) {
          return validation;
        }
      }
      break;
    }

    case "move-drawing": {
      const { id, dx, dy } = message;
      if (typeof id !== "string" || id.length === 0) {
        return { valid: false, error: "move-drawing: missing or invalid drawing id" };
      }
      if (!isFiniteNumber(dx) || !isFiniteNumber(dy)) {
        return { valid: false, error: "move-drawing: dx and dy must be numbers" };
      }
      break;
    }

    case "dice-roll": {
      if (!isRecord(message.roll)) {
        return { valid: false, error: "dice-roll: missing or invalid roll object" };
      }
      break;
    }

    case "rtc-signal": {
      if (typeof message.target !== "string") {
        return { valid: false, error: "rtc-signal: missing or invalid target" };
      }
      if (!("signal" in message)) {
        return { valid: false, error: "rtc-signal: missing signal data" };
      }
      break;
    }

    case "authenticate": {
      if (typeof message.secret !== "string" || message.secret.length === 0) {
        return { valid: false, error: "authenticate: missing or invalid secret" };
      }
      if (message.secret.length > 256) {
        return { valid: false, error: "authenticate: secret too long" };
      }
      if (
        "roomId" in message &&
        message.roomId !== undefined &&
        typeof message.roomId !== "string"
      ) {
        return { valid: false, error: "authenticate: roomId must be a string" };
      }
      break;
    }

    case "elevate-to-dm": {
      if (typeof message.dmPassword !== "string" || message.dmPassword.length === 0) {
        return { valid: false, error: "elevate-to-dm: missing or invalid dmPassword" };
      }
      if (message.dmPassword.length > 256) {
        return { valid: false, error: "elevate-to-dm: dmPassword too long" };
      }
      break;
    }

    case "set-dm-password": {
      if (typeof message.dmPassword !== "string" || message.dmPassword.length === 0) {
        return { valid: false, error: "set-dm-password: missing or invalid dmPassword" };
      }
      if (message.dmPassword.length > 256) {
        return { valid: false, error: "set-dm-password: dmPassword too long" };
      }
      break;
    }

    case "revoke-dm": {
      // No parameters to validate - just needs to be authenticated
      break;
    }

    case "transform-object": {
      if (typeof message.id !== "string" || message.id.length === 0) {
        return { valid: false, error: "transform-object: missing or invalid id" };
      }
      if ("position" in message && message.position !== undefined) {
        const pos = message.position;
        if (!isRecord(pos) || !isFiniteNumber(pos.x) || !isFiniteNumber(pos.y)) {
          return { valid: false, error: "transform-object: invalid position" };
        }
      }
      if ("scale" in message && message.scale !== undefined) {
        const scale = message.scale;
        if (!isRecord(scale) || !isFiniteNumber(scale.x) || !isFiniteNumber(scale.y)) {
          return { valid: false, error: "transform-object: invalid scale" };
        }
        if (scale.x <= 0 || scale.y <= 0) {
          return { valid: false, error: "transform-object: scale must be positive" };
        }
        // Staging zone handles scale differently (converts to width/height), so skip strict limits
        const isStagingZone = message.id === "staging-zone";
        if (!isStagingZone) {
          // Prevent extreme scale values that can break rendering
          if (scale.x > 10 || scale.y > 10) {
            return { valid: false, error: "transform-object: scale must not exceed 10x" };
          }
          if (scale.x < 0.1 || scale.y < 0.1) {
            return { valid: false, error: "transform-object: scale must be at least 0.1x" };
          }
        }
      }
      if ("rotation" in message && message.rotation !== undefined) {
        if (!isFiniteNumber(message.rotation)) {
          return { valid: false, error: "transform-object: rotation must be a number" };
        }
      }
      if ("locked" in message && message.locked !== undefined) {
        if (typeof message.locked !== "boolean") {
          return { valid: false, error: "transform-object: locked must be a boolean" };
        }
      }
      break;
    }

    default: {
      return { valid: false, error: `Unknown message type: ${message.t}` };
    }
  }

  return { valid: true };
}
