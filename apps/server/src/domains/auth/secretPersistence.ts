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
  return { rooms: loadPersistedRooms(storagePath), secret: seedDefaultRecord() };
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
    dmSource: process.env.HEROBYTE_DM_PASSWORD?.trim() ? "env" : "fallback",
  };
}

/**
 * The private tables' records from the file. Only `rooms` is read: the file's top-level
 * record is the default table's, re-derived from the settings on every start, so it is
 * never needed — and a file missing it (hand-edited, or older) must not take every
 * private table's password with it, which would leave their codes claimable again. (A file
 * that is not JSON at all still loads as no records, as it always has.)
 */
function loadPersistedRooms(storagePath: string): Record<string, RoomSecretRecord> {
  if (!existsSync(storagePath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(readFileSync(storagePath, "utf-8")) as {
      rooms?: Record<string, RoomSecretRecord>;
    };
    const rooms: Record<string, RoomSecretRecord> = {};
    if (parsed.rooms && typeof parsed.rooms === "object") {
      for (const [roomId, record] of Object.entries(parsed.rooms)) {
        if (ROOM_ID_PATTERN.test(roomId) && record && typeof record === "object") {
          rooms[roomId] = record;
        }
      }
    }
    return rooms;
  } catch (error) {
    console.error("[Auth] Failed to read room secret file:", error);
    return {};
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
