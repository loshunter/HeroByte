// ============================================================================
// AUTH DOMAIN - SERVICE
// ============================================================================
// Manages the shared room password with hashing, persistence, and verification.

import { existsSync, readFileSync, writeFileSync } from "fs";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { getRoomSecret, getDMPassword, getDefaultRoomId } from "../../config/auth.js";

const SECRET_FILE = "./herobyte-room-secret.json";

type SecretSource = "env" | "fallback" | "user";

interface StoredSecret {
  salt: string;
  hash: string;
  updatedAt: number;
  source: SecretSource;
  dmSalt?: string;
  dmHash?: string;
  dmUpdatedAt?: number;
  dmSource?: SecretSource;
}

/**
 * A room's overrides. Either half may be absent: a room can customize just
 * its password, just its DM password, or both. Anything unset falls back to
 * the default room's record.
 */
interface RoomSecretRecord {
  salt?: string;
  hash?: string;
  updatedAt?: number;
  source?: SecretSource;
  dmSalt?: string;
  dmHash?: string;
  dmUpdatedAt?: number;
  dmSource?: SecretSource;
}

const ROOM_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

function hashSecret(secret: string, saltHex?: string): { hash: string; salt: string } {
  const salt = saltHex ? Buffer.from(saltHex, "hex") : randomBytes(16);
  const derived = scryptSync(secret, salt, 64);
  return {
    hash: derived.toString("hex"),
    salt: salt.toString("hex"),
  };
}

function compareSecret(secret: string, record: StoredSecret): boolean {
  const { hash } = hashSecret(secret, record.salt);
  const incoming = Buffer.from(hash, "hex");
  const expected = Buffer.from(record.hash, "hex");

  if (incoming.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(incoming, expected);
}

export interface RoomPasswordSummary {
  source: SecretSource;
  updatedAt: number;
}

/**
 * AuthService
 *
 * Responsibilities:
 * - Load the current room password (env, persisted, or fallback)
 * - Verify incoming secrets without exposing the plain text
 * - Allow DMs to set a new password that persists across restarts
 *
 * Multi-room: every method takes an optional roomId. The legacy top-level
 * record is the default room's; per-room overrides live under `rooms` and
 * fall back to the default record for anything they don't set, so a fresh
 * room is protected by the server password until its DM customizes it.
 */
export class AuthService {
  private secret: StoredSecret;
  private rooms: Record<string, RoomSecretRecord>;
  private storagePath: string;

  constructor(options?: { storagePath?: string }) {
    this.storagePath = options?.storagePath ?? SECRET_FILE;
    this.rooms = {};
    this.secret = this.loadSecret();
  }

  /**
   * Verify whether the provided secret matches the room's password (or the
   * default password when the room has not set its own).
   */
  verify(secret: string, roomId?: string): boolean {
    if (!secret || typeof secret !== "string") {
      return false;
    }
    const room = this.roomRecord(roomId);
    if (room?.hash && room.salt) {
      return compareSecret(secret, room as StoredSecret);
    }
    return compareSecret(secret, this.secret);
  }

  /**
   * Update the room password (DM initiated).
   * Persists the hashed secret to disk for future restarts.
   */
  update(secret: string, roomId?: string): RoomPasswordSummary {
    const trimmed = secret.trim();
    const defaultSecret = getRoomSecret();

    // Allow the default development password even if it's < 6 characters
    const isDefaultPassword = trimmed === defaultSecret;

    if (!isDefaultPassword && (trimmed.length < 6 || trimmed.length > 128)) {
      throw new Error("Password must be between 6 and 128 characters.");
    }

    const { hash, salt } = hashSecret(trimmed);
    const source: SecretSource = isDefaultPassword ? "fallback" : "user";
    const updatedAt = Date.now();

    const roomKey = this.roomKey(roomId);
    if (roomKey) {
      const record = this.rooms[roomKey] ?? {};
      record.hash = hash;
      record.salt = salt;
      record.updatedAt = updatedAt;
      record.source = source;
      this.rooms[roomKey] = record;
    } else {
      this.secret = { hash, salt, updatedAt, source };
    }
    this.persistAll();
    return { source, updatedAt };
  }

  /**
   * Expose basic metadata about the current password source.
   * Never returns the actual secret.
   */
  getSummary(): RoomPasswordSummary {
    return {
      source: this.secret.source,
      updatedAt: this.secret.updatedAt,
    };
  }

  /**
   * Verify whether the provided DM password matches the room's DM password
   * (or the default DM password when the room has not set its own).
   */
  verifyDMPassword(dmPassword: string, roomId?: string): boolean {
    if (!dmPassword || typeof dmPassword !== "string") {
      return false;
    }

    const room = this.roomRecord(roomId);
    const dmHash = room?.dmHash ?? this.secret.dmHash;
    const dmSalt = room?.dmSalt ?? this.secret.dmSalt;
    if (!dmHash || !dmSalt) {
      return false;
    }

    const dmRecord = {
      hash: dmHash,
      salt: dmSalt,
      updatedAt: Date.now(),
      source: "fallback",
    } as StoredSecret;

    // Trim whitespace to match update behavior
    return compareSecret(dmPassword.trim(), dmRecord);
  }

  /**
   * Update the DM password.
   * Persists the hashed secret to disk for future restarts.
   */
  updateDMPassword(dmPassword: string, roomId?: string): RoomPasswordSummary {
    const trimmed = dmPassword.trim();
    if (trimmed.length < 8 || trimmed.length > 128) {
      throw new Error("DM password must be between 8 and 128 characters.");
    }

    const { hash, salt } = hashSecret(trimmed);
    const updatedAt = Date.now();

    const roomKey = this.roomKey(roomId);
    if (roomKey) {
      const record = this.rooms[roomKey] ?? {};
      record.dmHash = hash;
      record.dmSalt = salt;
      record.dmUpdatedAt = updatedAt;
      record.dmSource = "user";
      this.rooms[roomKey] = record;
    } else {
      this.secret.dmHash = hash;
      this.secret.dmSalt = salt;
      this.secret.dmUpdatedAt = updatedAt;
      this.secret.dmSource = "user";
    }

    this.persistAll();

    return { source: "user", updatedAt };
  }

  /**
   * Check if a DM password is available for the room — its own, or the
   * default one it falls back to.
   */
  hasDMPassword(roomId?: string): boolean {
    const room = this.roomRecord(roomId);
    if (room?.dmHash && room.dmSalt) {
      return true;
    }
    return !!(this.secret.dmHash && this.secret.dmSalt);
  }

  /** The sanitized per-room key, or undefined for the default room. */
  private roomKey(roomId?: string): string | undefined {
    if (!roomId || roomId === getDefaultRoomId() || !ROOM_ID_PATTERN.test(roomId)) {
      return undefined;
    }
    return roomId;
  }

  private roomRecord(roomId?: string): RoomSecretRecord | undefined {
    const key = this.roomKey(roomId);
    return key ? this.rooms[key] : undefined;
  }

  private loadSecret(): StoredSecret {
    const persisted = this.loadPersistedSecret();
    if (persisted) {
      return persisted;
    }

    // Load room secret
    const envSecret = process.env.HEROBYTE_ROOM_SECRET?.trim();
    const roomSecret = envSecret || getRoomSecret();
    const { hash, salt } = hashSecret(roomSecret);

    // Load DM password (fallback for development)
    const dmPassword = getDMPassword();
    const dmHashData = hashSecret(dmPassword);

    return {
      hash,
      salt,
      updatedAt: Date.now(),
      source: envSecret ? "env" : "fallback",
      dmHash: dmHashData.hash,
      dmSalt: dmHashData.salt,
      dmUpdatedAt: Date.now(),
      dmSource: "fallback",
    };
  }

  private loadPersistedSecret(): StoredSecret | null {
    if (!existsSync(this.storagePath)) {
      return null;
    }

    try {
      const raw = readFileSync(this.storagePath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<StoredSecret> & {
        rooms?: Record<string, RoomSecretRecord>;
      };
      if (
        typeof parsed.hash === "string" &&
        typeof parsed.salt === "string" &&
        typeof parsed.updatedAt === "number"
      ) {
        // Per-room overrides ride alongside the legacy default-room record,
        // so pre-multi-room files load unchanged.
        if (parsed.rooms && typeof parsed.rooms === "object") {
          for (const [roomId, record] of Object.entries(parsed.rooms)) {
            if (ROOM_ID_PATTERN.test(roomId) && record && typeof record === "object") {
              this.rooms[roomId] = record;
            }
          }
        }
        return {
          hash: parsed.hash,
          salt: parsed.salt,
          updatedAt: parsed.updatedAt,
          // Preserve the persisted source when it's a known value; default to
          // "user" otherwise. (A previous version of this line collapsed every
          // value to "user", which made the landing page report the wrong
          // password-hint state for env-sourced secrets.)
          source: parsed.source === "env" || parsed.source === "fallback" ? parsed.source : "user",
          dmHash: parsed.dmHash,
          dmSalt: parsed.dmSalt,
          dmUpdatedAt: parsed.dmUpdatedAt,
          dmSource: parsed.dmSource === "user" ? "user" : parsed.dmSource,
        };
      }
      console.warn("[Auth] Secret file was invalid; ignoring persisted password.");
      return null;
    } catch (error) {
      console.error("[Auth] Failed to read room secret file:", error);
      return null;
    }
  }

  private persistAll(): void {
    try {
      const record = this.secret;
      const persistData: Partial<StoredSecret> & { rooms?: Record<string, RoomSecretRecord> } = {
        hash: record.hash,
        salt: record.salt,
        updatedAt: record.updatedAt,
        source: "user",
      };

      // Include DM password fields if they exist
      if (record.dmHash && record.dmSalt) {
        persistData.dmHash = record.dmHash;
        persistData.dmSalt = record.dmSalt;
        persistData.dmUpdatedAt = record.dmUpdatedAt;
        persistData.dmSource = record.dmSource || "user";
      }

      if (Object.keys(this.rooms).length > 0) {
        persistData.rooms = this.rooms;
      }

      writeFileSync(this.storagePath, JSON.stringify(persistData, null, 2));
    } catch (error) {
      console.error("[Auth] Failed to persist room password:", error);
    }
  }
}
