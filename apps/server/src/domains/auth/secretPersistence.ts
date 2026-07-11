// ============================================================================
// AUTH DOMAIN - SECRET PERSISTENCE
// ============================================================================
// Load/save the room-secret file. Extracted from service.ts (no behavior
// change) to keep the service under the file-size guard. The service owns the
// in-memory state; these functions are the disk boundary.

import { existsSync, readFileSync, writeFileSync } from "fs";
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

/** The default-room record + per-room overrides, from disk or freshly seeded. */
export function loadSecretRecords(storagePath: string): LoadedSecrets {
  const persisted = loadPersistedSecret(storagePath);
  if (persisted) {
    return persisted;
  }

  const envSecret = process.env.HEROBYTE_ROOM_SECRET?.trim();
  const roomSecret = envSecret || getRoomSecret();
  const { hash, salt } = hashSecret(roomSecret);

  const dmPassword = getDMPassword();
  const dmHashData = hashSecret(dmPassword);

  return {
    rooms: {},
    secret: {
      hash,
      salt,
      updatedAt: Date.now(),
      source: envSecret ? "env" : "fallback",
      dmHash: dmHashData.hash,
      dmSalt: dmHashData.salt,
      dmUpdatedAt: Date.now(),
      dmSource: "fallback",
    },
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
        dmSource: parsed.dmSource === "user" ? "user" : parsed.dmSource,
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

    writeFileSync(storagePath, JSON.stringify(persistData, null, 2));
  } catch (error) {
    console.error("[Auth] Failed to persist room password:", error);
  }
}
