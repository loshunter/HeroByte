// ============================================================================
// AUTH DOMAIN - SECRET PERSISTENCE
// ============================================================================
// Load/save the room-secret file. Extracted from service.ts (no behavior
// change) to keep the service under the file-size guard. The service owns the
// in-memory state; these functions are the disk boundary.

import { existsSync, readFileSync, renameSync, writeFileSync } from "fs";
import { getRoomSecret, getDMPassword } from "../../config/auth.js";
import {
  ROOM_ID_PATTERN,
  hashSecret,
  type RoomSecretRecord,
  type StoredSecret,
} from "./authCrypto.js";

export interface LoadedSecrets {
  secret: StoredSecret;
  rooms: Record<string, RoomSecretRecord>;
}

/**
 * The default-room record + per-room overrides.
 *
 * The default table's passwords ALWAYS come from the server settings
 * (HEROBYTE_ROOM_SECRET / HEROBYTE_DM_PASSWORD, else the documented defaults), re-derived on every
 * start: nothing in the app can change them (the server refuses both password messages for the
 * default table), so a saved copy can only ever be stale. It used to win once the file existed —
 * and creating any private table writes the file — so a host who changed a setting after a leak
 * and restarted found the old password still working. Private tables' passwords live under
 * `rooms` and are loaded exactly as saved.
 */
export function loadSecretRecords(storagePath: string): LoadedSecrets {
  const persisted = loadPersistedSecret(storagePath);
  return { rooms: persisted?.rooms ?? {}, secret: seedDefaultRecord() };
}

function seedDefaultRecord(): StoredSecret {
  const envSecret = process.env.HEROBYTE_ROOM_SECRET?.trim();
  const roomSecret = envSecret || getRoomSecret();
  const { hash, salt } = hashSecret(roomSecret);

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

function loadPersistedSecret(storagePath: string): LoadedSecrets | null {
  if (!existsSync(storagePath)) {
    return null;
  }

  try {
    const raw = readFileSync(storagePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<StoredSecret> & {
      rooms?: Record<string, RoomSecretRecord>;
    };
    if (
      typeof parsed.hash !== "string" ||
      typeof parsed.salt !== "string" ||
      typeof parsed.updatedAt !== "number"
    ) {
      console.warn("[Auth] Secret file was invalid; ignoring persisted password.");
      return null;
    }

    // Per-room overrides ride alongside the legacy default-room record, so
    // pre-multi-room files load unchanged.
    const rooms: Record<string, RoomSecretRecord> = {};
    if (parsed.rooms && typeof parsed.rooms === "object") {
      for (const [roomId, record] of Object.entries(parsed.rooms)) {
        if (ROOM_ID_PATTERN.test(roomId) && record && typeof record === "object") {
          rooms[roomId] = record;
        }
      }
    }

    return {
      rooms,
      secret: {
        hash: parsed.hash,
        salt: parsed.salt,
        updatedAt: parsed.updatedAt,
        // Preserve the persisted source when it's a known value; default to
        // "user" otherwise. (A previous version collapsed every value to
        // "user", which made the landing page report the wrong hint state.)
        source: parsed.source === "env" || parsed.source === "fallback" ? parsed.source : "user",
        dmHash: parsed.dmHash,
        dmSalt: parsed.dmSalt,
        dmUpdatedAt: parsed.dmUpdatedAt,
        // Validate to a known source (mirrors `source` above); drop any other
        // value rather than the old no-op that passed garbage straight through.
        dmSource:
          parsed.dmSource === "env" || parsed.dmSource === "fallback" || parsed.dmSource === "user"
            ? parsed.dmSource
            : undefined,
      },
    };
  } catch (error) {
    console.error("[Auth] Failed to read room secret file:", error);
    return null;
  }
}

/** Write the default-room record + per-room overrides back to disk. */
export function persistSecretRecords(
  storagePath: string,
  secret: StoredSecret,
  rooms: Record<string, RoomSecretRecord>,
): void {
  try {
    const persistData: Partial<StoredSecret> & { rooms?: Record<string, RoomSecretRecord> } = {
      hash: secret.hash,
      salt: secret.salt,
      updatedAt: secret.updatedAt,
      source: secret.source,
    };

    if (secret.dmHash && secret.dmSalt) {
      persistData.dmHash = secret.dmHash;
      persistData.dmSalt = secret.dmSalt;
      persistData.dmUpdatedAt = secret.dmUpdatedAt;
      persistData.dmSource = secret.dmSource || "user";
    }

    if (Object.keys(rooms).length > 0) {
      persistData.rooms = rooms;
    }

    // tmp+rename so a crash mid-write can never truncate the secret file — a
    // torn write here would lock every room (including custom rooms' only
    // passwords) out on the next boot. Sync like the rest of this module;
    // password changes are rare and not on a hot path.
    const tmpPath = `${storagePath}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(persistData, null, 2));
    renameSync(tmpPath, storagePath);
  } catch (error) {
    console.error("[Auth] Failed to persist room password:", error);
  }
}
