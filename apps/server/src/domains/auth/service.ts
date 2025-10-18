// ============================================================================
// AUTH DOMAIN - SERVICE
// ============================================================================
// Manages the shared room password with hashing, persistence, and verification.

import { existsSync, readFileSync, writeFileSync } from "fs";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { getRoomSecret } from "../../config/auth.js";

const SECRET_FILE = "./herobyte-room-secret.json";

type SecretSource = "env" | "fallback" | "user";

interface StoredSecret {
  salt: string;
  hash: string;
  updatedAt: number;
  source: SecretSource;
}

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
 */
export class AuthService {
  private secret: StoredSecret;
  private storagePath: string;

  constructor(options?: { storagePath?: string }) {
    this.storagePath = options?.storagePath ?? SECRET_FILE;
    this.secret = this.loadSecret();
  }

  /**
   * Verify whether the provided secret matches the current room password.
   */
  verify(secret: string): boolean {
    if (!secret || typeof secret !== "string") {
      return false;
    }
    return compareSecret(secret, this.secret);
  }

  /**
   * Update the room password (DM initiated).
   * Persists the hashed secret to disk for future restarts.
   */
  update(secret: string): RoomPasswordSummary {
    const trimmed = secret.trim();
    if (trimmed.length < 6 || trimmed.length > 128) {
      throw new Error("Password must be between 6 and 128 characters.");
    }

    const { hash, salt } = hashSecret(trimmed);
    const record: StoredSecret = {
      hash,
      salt,
      updatedAt: Date.now(),
      source: "user",
    };

    this.secret = record;
    this.persistRecord(record);
    return { source: record.source, updatedAt: record.updatedAt };
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

  private loadSecret(): StoredSecret {
    const persisted = this.loadPersistedSecret();
    if (persisted) {
      return persisted;
    }

    const envSecret = process.env.HEROBYTE_ROOM_SECRET?.trim();
    if (envSecret) {
      const { hash, salt } = hashSecret(envSecret);
      return {
        hash,
        salt,
        updatedAt: Date.now(),
        source: "env",
      };
    }

    const fallback = getRoomSecret();
    const { hash, salt } = hashSecret(fallback);
    return {
      hash,
      salt,
      updatedAt: Date.now(),
      source: "fallback",
    };
  }

  private loadPersistedSecret(): StoredSecret | null {
    if (!existsSync(this.storagePath)) {
      return null;
    }

    try {
      const raw = readFileSync(this.storagePath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<StoredSecret>;
      if (
        typeof parsed.hash === "string" &&
        typeof parsed.salt === "string" &&
        typeof parsed.updatedAt === "number"
      ) {
        return {
          hash: parsed.hash,
          salt: parsed.salt,
          updatedAt: parsed.updatedAt,
          source: parsed.source === "user" ? "user" : "user",
        };
      }
      console.warn("[Auth] Secret file was invalid; ignoring persisted password.");
      return null;
    } catch (error) {
      console.error("[Auth] Failed to read room secret file:", error);
      return null;
    }
  }

  private persistRecord(record: StoredSecret): void {
    try {
      writeFileSync(
        this.storagePath,
        JSON.stringify(
          {
            hash: record.hash,
            salt: record.salt,
            updatedAt: record.updatedAt,
            source: "user",
          },
          null,
          2,
        ),
      );
    } catch (error) {
      console.error("[Auth] Failed to persist room password:", error);
    }
  }
}
