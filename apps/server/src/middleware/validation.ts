// ============================================================================
// INPUT VALIDATION MIDDLEWARE
// ============================================================================
// Validates incoming WebSocket messages to prevent malformed or malicious data

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

    case "claim-character": {
      if (typeof message.characterId !== "string" || message.characterId.length === 0) {
        return { valid: false, error: "claim-character: missing or invalid characterId" };
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

    case "point": {
      const { x, y } = message;
      if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
        return { valid: false, error: "point: missing or invalid x/y coordinates" };
      }
      break;
    }

    case "draw": {
      const drawing = message.drawing;
      if (!isRecord(drawing)) {
        return { valid: false, error: "draw: missing or invalid drawing object" };
      }
      if (typeof drawing.id !== "string" || typeof drawing.type !== "string") {
        return { valid: false, error: "draw: invalid drawing structure" };
      }
      if (!Array.isArray(drawing.points)) {
        return { valid: false, error: "draw: invalid drawing structure" };
      }
      if (drawing.points.length > 10000) {
        return { valid: false, error: "draw: too many points (max 10000)" };
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

    default: {
      return { valid: false, error: `Unknown message type: ${message.t}` };
    }
  }

  return { valid: true };
}
