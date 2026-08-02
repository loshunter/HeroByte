// ============================================================================
// AUTH DOMAIN - CRYPTO & SECRET TYPES
// ============================================================================
// Pure scrypt hashing + constant-time comparison, and the persisted secret
// shapes. Extracted from service.ts so the service stays under the file-size
// guard.
//
// Two variants of each operation, on purpose:
// - Async (scrypt on the libuv threadpool) for everything request-driven —
//   a ~30ms scryptSync on the one Node thread stalls every room's broadcasts,
//   and verify() runs PRE-auth, so anyone can trigger it.
// - Sync for boot-time seeding only (loadSecretRecords, the AuthService
//   constructor's timing guard), where blocking once at startup is fine and
//   a synchronous constructor is worth keeping.

import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

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

/**
 * scrypt-derive a secret, blocking the event loop. Reuse `saltHex` to verify,
 * omit it to mint a new salt. BOOT-TIME ONLY — request paths must use
 * hashSecretAsync so password floods cannot stall the event loop.
 */
export function hashSecret(secret: string, saltHex?: string): { hash: string; salt: string } {
  const salt = saltHex ? Buffer.from(saltHex, "hex") : randomBytes(16);
  const derived = scryptSync(secret, salt, 64);
  return {
    hash: derived.toString("hex"),
    salt: salt.toString("hex"),
  };
}

/** hashSecret, off the event loop (libuv threadpool). Use on request paths. */
export async function hashSecretAsync(
  secret: string,
  saltHex?: string,
): Promise<{ hash: string; salt: string }> {
  const salt = saltHex ? Buffer.from(saltHex, "hex") : randomBytes(16);
  const derived = await scryptAsync(secret, salt, 64);
  return {
    hash: derived.toString("hex"),
    salt: salt.toString("hex"),
  };
}

/**
 * Constant-time compare of a plaintext secret against a stored hash+salt,
 * blocking the event loop. BOOT-TIME ONLY — request paths use the async form.
 */
export function compareSecret(secret: string, record: StoredSecret): boolean {
  const { hash } = hashSecret(secret, record.salt);
  return constantTimeHashEquals(hash, record.hash);
}

/** compareSecret, off the event loop. Use on every request-driven verify. */
export async function compareSecretAsync(secret: string, record: StoredSecret): Promise<boolean> {
  const { hash } = await hashSecretAsync(secret, record.salt);
  return constantTimeHashEquals(hash, record.hash);
}

function constantTimeHashEquals(incomingHex: string, expectedHex: string): boolean {
  const incoming = Buffer.from(incomingHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");

  if (incoming.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(incoming, expected);
}
