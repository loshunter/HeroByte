// ============================================================================
// AUTH DOMAIN - CRYPTO & SECRET TYPES
// ============================================================================
// Pure scrypt hashing + constant-time comparison, and the persisted secret
// shapes. Extracted from service.ts so the service stays under the file-size
// guard; no behavior change.

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export type SecretSource = "env" | "fallback" | "user";

export interface StoredSecret {
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
export interface RoomSecretRecord {
  salt?: string;
  hash?: string;
  updatedAt?: number;
  source?: SecretSource;
  dmSalt?: string;
  dmHash?: string;
  dmUpdatedAt?: number;
  dmSource?: SecretSource;
}

export const ROOM_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

/** scrypt-derive a secret. Reuse `saltHex` to verify, omit it to mint a new salt. */
export function hashSecret(secret: string, saltHex?: string): { hash: string; salt: string } {
  const salt = saltHex ? Buffer.from(saltHex, "hex") : randomBytes(16);
  const derived = scryptSync(secret, salt, 64);
  return {
    hash: derived.toString("hex"),
    salt: salt.toString("hex"),
  };
}

/** Constant-time compare of a plaintext secret against a stored hash+salt. */
export function compareSecret(secret: string, record: StoredSecret): boolean {
  const { hash } = hashSecret(secret, record.salt);
  const incoming = Buffer.from(hash, "hex");
  const expected = Buffer.from(record.hash, "hex");

  if (incoming.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(incoming, expected);
}
