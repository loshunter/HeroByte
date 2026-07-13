// ============================================================================
// AUTH DOMAIN - SERVICE
// ============================================================================
// Manages the shared room password with hashing, persistence, and verification.

import { getRoomSecret, getDefaultRoomId } from "../../config/auth.js";
import {
  ROOM_ID_PATTERN,
  compareSecret,
  hashSecret,
  type RoomSecretRecord,
  type SecretSource,
  type StoredSecret,
} from "./authCrypto.js";
import { loadSecretRecords, persistSecretRecords } from "./secretPersistence.js";

const SECRET_FILE = "./herobyte-room-secret.json";

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
    const loaded = loadSecretRecords(this.storagePath);
    this.secret = loaded.secret;
    this.rooms = loaded.rooms;
  }

  /**
   * Verify whether the provided secret matches the room's password (or the
   * default password when the room has not set its own).
   */
  verify(secret: string, roomId?: string): boolean {
    if (!secret || typeof secret !== "string") {
      return false;
    }
    const roomKey = this.roomKey(roomId);
    if (roomKey) {
      // Custom rooms are private: they open ONLY with the password set at
      // creation. The default/server password never opens a custom room, and a
      // never-created custom id is not joinable at all (no default fallback) —
      // so "know the link" alone can't get anyone in.
      const room = this.rooms[roomKey];
      if (room?.hash && room.salt) {
        return compareSecret(secret, room as StoredSecret);
      }
      return false;
    }
    // The default room (no roomId) uses the server-wide password.
    return compareSecret(secret, this.secret);
  }

  /**
   * Whether a custom room has been created (has its own room password). Used to
   * distinguish "join an existing table" from "mint a new one" and to reject
   * a create for a code that's already taken.
   */
  isRoomInitialized(roomId?: string): boolean {
    const roomKey = this.roomKey(roomId);
    if (!roomKey) {
      return true; // the default room always exists
    }
    const room = this.rooms[roomKey];
    return Boolean(room?.hash && room.salt);
  }

  /**
   * Mint a private room: set its own room password (required) and DM password
   * (optional). Throws if the code is already taken or a password is invalid.
   * The creator then authenticates with the room password like any player, and
   * elevates with the DM password.
   */
  createRoom(roomId: string, roomPassword: string, dmPassword?: string): void {
    const roomKey = this.roomKey(roomId);
    if (!roomKey) {
      throw new Error("Custom tables need a valid table code.");
    }
    if (this.isRoomInitialized(roomId)) {
      throw new Error("That table code is already taken. Try another.");
    }
    const trimmedRoom = roomPassword.trim();
    if (trimmedRoom.length < 6 || trimmedRoom.length > 128) {
      throw new Error("Room password must be between 6 and 128 characters.");
    }
    const trimmedDm = dmPassword?.trim();
    if (trimmedDm && (trimmedDm.length < 8 || trimmedDm.length > 128)) {
      throw new Error("DM password must be between 8 and 128 characters.");
    }

    const now = Date.now();
    const room: RoomSecretRecord = this.rooms[roomKey] ?? {};
    const roomHash = hashSecret(trimmedRoom);
    room.hash = roomHash.hash;
    room.salt = roomHash.salt;
    room.updatedAt = now;
    room.source = "user";
    if (trimmedDm) {
      const dmHash = hashSecret(trimmedDm);
      room.dmHash = dmHash.hash;
      room.dmSalt = dmHash.salt;
      room.dmUpdatedAt = now;
      room.dmSource = "user";
    }
    this.rooms[roomKey] = room;
    persistSecretRecords(this.storagePath, this.secret, this.rooms);
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
    persistSecretRecords(this.storagePath, this.secret, this.rooms);
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

    // Custom rooms are private (mirroring verify()): the server-wide default DM
    // password must NEVER elevate inside one. Only the room's OWN DM credential
    // works — a room minted without one simply has no DM password until its
    // creator bootstraps it via set-dm-password. The default room (no roomKey)
    // keeps the server-wide DM password.
    const roomKey = this.roomKey(roomId);
    const dmHash = roomKey ? this.rooms[roomKey]?.dmHash : this.secret.dmHash;
    const dmSalt = roomKey ? this.rooms[roomKey]?.dmSalt : this.secret.dmSalt;
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

    persistSecretRecords(this.storagePath, this.secret, this.rooms);

    return { source: "user", updatedAt };
  }

  /**
   * Check if a DM password is available for the room — its own, or the
   * default one it falls back to.
   */
  hasDMPassword(roomId?: string): boolean {
    // Custom rooms only report a DM password when they set their OWN — no
    // fallback to the server default (see verifyDMPassword). This is what lets a
    // creator who skipped the optional DM password bootstrap one later via
    // set-dm-password (that path is gated on hasDMPassword being false).
    const roomKey = this.roomKey(roomId);
    if (roomKey) {
      const room = this.rooms[roomKey];
      return !!(room?.dmHash && room.dmSalt);
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
}
