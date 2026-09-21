// ============================================================================
// SESSION TOKEN SERVICE
// ============================================================================
// The secret that binds a uid to the connection that authenticated it.
//
// A uid is client-supplied (read off the connect URL) and the roster ships
// every uid to every player, so on its own it proves nothing. Auth state and
// DM authority key on the uid, though — so before this service, any socket
// that could reach a table could claim a connected member's uid and inherit
// their session, DM included, with no password at all.
//
// The fix: a successful password authenticate mints a 256-bit bearer token.
// The client presents it on every later authenticate; adopting a uid's live
// session (its socket, its auth flag, its isDM) requires proving it. Only the
// SHA-256 of the token is held here — never the raw value, never on disk, and
// never in a URL (a WS query string leaks to proxy logs).
//
// One SESSION per uid, one PROOF per table it has authenticated into. The
// session (all of a uid's records) detaches when its socket goes and comes
// back attached on any successful auth; each table keeps its own token so a
// DM who visits another table and returns still proves the first one.
//
// Split out of AuthenticationHandler for the structural size guard, the same
// way dmElevation.ts and tableFork.ts were.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export interface SessionTokenRecord {
  /** SHA-256 of the raw token. Equal-length by construction, so the compare is constant-time. */
  tokenHash: Buffer;
  /** The table the token was minted for. A token for table A never confers DM in table B. */
  roomId: string;
  issuedAt: number;
  /**
   * When the uid's connection went away (disconnect, heartbeat timeout,
   * replacement at connect). Unset while connected. The record survives for
   * SESSION_TOKEN_GRACE_MS past this so a reload or a network blip can prove
   * itself and resume — including a DM's elevation — instead of forcing the
   * DM password again.
   */
  detachedAt?: number;
}

/**
 * How long a detached session can still be reclaimed by its token. Long enough
 * for a dinner break, short enough that a browser left logged in on a shared
 * machine is not a standing key. A stolen token is used at once, not hours
 * later, so this bounds convenience more than exposure. While the session is
 * live or inside this window, NOTHING but its token can claim the uid; after
 * it, a reclaim still works with the room password — as a non-DM.
 *
 * The auth gate's "Held in another window" copy quotes this as "up to six
 * hours" (apps/client/src/features/auth/AuthGate.tsx) — change both together.
 */
export const SESSION_TOKEN_GRACE_MS = 6 * 60 * 60 * 1000;

/** Detached records are swept lazily, at most this often, on the mint path. */
const PURGE_INTERVAL_MS = 60 * 1000;

function hashToken(token: string): Buffer {
  return createHash("sha256").update(token, "utf8").digest();
}

export class SessionTokenService {
  /** uid → (roomId → record). */
  private readonly records = new Map<string, Map<string, SessionTokenRecord>>();
  private lastPurgeAt = 0;

  /**
   * Mint a fresh token for a uid at a table (replacing that table's earlier
   * one) and return the RAW token. The whole session comes back attached: the
   * uid is connected again, so none of its records should be counting down.
   */
  mint(uid: string, roomId: string, now: number = Date.now()): string {
    this.purgeExpired(now);
    const token = randomBytes(32).toString("base64url");
    let byRoom = this.records.get(uid);
    if (!byRoom) {
      byRoom = new Map();
      this.records.set(uid, byRoom);
    }
    for (const record of byRoom.values()) record.detachedAt = undefined;
    byRoom.set(roomId, { tokenHash: hashToken(token), roomId, issuedAt: now });
    return token;
  }

  /**
   * Does `token` prove `uid`'s session AT `roomId`? False for an absent or
   * malformed token, an unknown uid or table, a rotated-away token, and a
   * session detached longer than the grace window. This is the table-bound
   * question that decides whether a persisted DM flag is honoured.
   */
  verify(uid: string, roomId: string, token: unknown, now: number = Date.now()): boolean {
    const record = this.liveRecords(uid, now).get(roomId);
    return record !== undefined && this.hashMatches(record, token);
  }

  /**
   * Does `token` prove `uid`'s session, whatever table it was minted for?
   * This is the takeover question — "are you the same session as whoever
   * holds this uid" — and a session may legitimately move tables (a second
   * tab opened on another table). Table-bound authority is verify()'s job.
   */
  matches(uid: string, token: unknown, now: number = Date.now()): boolean {
    for (const record of this.liveRecords(uid, now).values()) {
      if (this.hashMatches(record, token)) return true;
    }
    return false;
  }

  /** True while the uid has a session anyone could still prove — live, or within grace. */
  has(uid: string, now: number = Date.now()): boolean {
    return this.liveRecords(uid, now).size > 0;
  }

  /**
   * The uid's connection is gone. Every record is kept for the grace window so
   * the same client can reclaim it; calling this twice keeps the FIRST stamp,
   * so a late duplicate cleanup cannot extend the window.
   */
  detach(uid: string, now: number = Date.now()): void {
    for (const record of this.records.get(uid)?.values() ?? []) {
      if (record.detachedAt === undefined) record.detachedAt = now;
    }
  }

  /** Forget a uid's session outright. */
  revoke(uid: string): void {
    this.records.delete(uid);
  }

  /**
   * Forget every uid's proof for one table — for a table whose seats were
   * just wiped (the idle default-table clear), so no token keeps proving a
   * seat that no longer exists.
   */
  revokeRoom(roomId: string): void {
    for (const [uid, byRoom] of this.records) {
      byRoom.delete(roomId);
      if (byRoom.size === 0) this.records.delete(uid);
    }
  }

  /** Drop every record whose grace window has closed. Returns how many went. */
  purgeExpired(now: number = Date.now()): number {
    if (now - this.lastPurgeAt < PURGE_INTERVAL_MS) return 0;
    this.lastPurgeAt = now;
    let purged = 0;
    for (const uid of [...this.records.keys()]) {
      purged += this.records.get(uid)!.size - this.liveRecords(uid, now).size;
    }
    return purged;
  }

  clear(): void {
    this.records.clear();
    this.lastPurgeAt = 0;
  }

  /** Records held, across every uid and table. */
  get size(): number {
    let n = 0;
    for (const byRoom of this.records.values()) n += byRoom.size;
    return n;
  }

  /** The uid's records with the expired ones dropped on the way past. */
  private liveRecords(uid: string, now: number): Map<string, SessionTokenRecord> {
    const byRoom = this.records.get(uid);
    if (!byRoom) return new Map();
    for (const [roomId, record] of byRoom) {
      if (record.detachedAt !== undefined && now - record.detachedAt > SESSION_TOKEN_GRACE_MS) {
        byRoom.delete(roomId);
      }
    }
    if (byRoom.size === 0) this.records.delete(uid);
    return byRoom;
  }

  private hashMatches(record: SessionTokenRecord, token: unknown): boolean {
    if (typeof token !== "string" || token.length === 0) return false;
    // Both sides are SHA-256 digests, so lengths always match and
    // timingSafeEqual never throws; the compare itself leaks nothing about
    // how many leading bytes were right.
    return timingSafeEqual(hashToken(token), record.tokenHash);
  }
}
