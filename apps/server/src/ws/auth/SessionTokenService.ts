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
// Split out of AuthenticationHandler for the structural size guard, the same
// way dmElevation.ts and tableFork.ts were.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export interface SessionTokenRecord {
  /** SHA-256 of the raw token. Equal-length by construction, so the compare is constant-time. */
  tokenHash: Buffer;
  /** The table the token was minted for. A token for table A never authorizes table B. */
  roomId: string;
  issuedAt: number;
  /**
   * When the uid's connection went away (disconnect, heartbeat timeout). Unset
   * while connected. The record survives for SESSION_TOKEN_GRACE_MS past this
   * so a reload or a network blip can prove itself and resume — including a
   * DM's elevation — instead of forcing the DM password again.
   */
  detachedAt?: number;
}

/**
 * How long a detached session can still be reclaimed by its token. Long enough
 * for a dinner break, short enough that a browser left logged in on a shared
 * machine is not a standing key. A stolen token is used at once, not hours
 * later, so this bounds convenience more than exposure. After it, a reclaim
 * still works with the room password — as a non-DM.
 */
export const SESSION_TOKEN_GRACE_MS = 6 * 60 * 60 * 1000;

/** Detached records are swept lazily, at most this often, on the mint path. */
const PURGE_INTERVAL_MS = 60 * 1000;

function hashToken(token: string): Buffer {
  return createHash("sha256").update(token, "utf8").digest();
}

export class SessionTokenService {
  private readonly records = new Map<string, SessionTokenRecord>();
  private lastPurgeAt = 0;

  /** Mint a fresh token for a uid (replacing any earlier one) and return the RAW token. */
  mint(uid: string, roomId: string, now: number = Date.now()): string {
    this.purgeExpired(now);
    const token = randomBytes(32).toString("base64url");
    this.records.set(uid, { tokenHash: hashToken(token), roomId, issuedAt: now });
    return token;
  }

  /**
   * Does `token` prove `uid`'s session in `roomId`? False for an absent or
   * malformed token, an unknown uid, a token minted for another table, a
   * rotated-away token, and a record detached longer than the grace window.
   */
  verify(uid: string, roomId: string, token: unknown, now: number = Date.now()): boolean {
    const record = this.liveRecord(uid, now);
    return record !== undefined && this.hashMatches(record, token) && record.roomId === roomId;
  }

  /**
   * Does `token` prove `uid`'s session, whatever table it is in? This is the
   * takeover question — "are you the same session as the socket holding this
   * uid" — and a session may legitimately move tables (a second tab opened on
   * another table). Table-bound authority (DM) is verify()'s question, not this one.
   */
  matches(uid: string, token: unknown, now: number = Date.now()): boolean {
    const record = this.liveRecord(uid, now);
    return record !== undefined && this.hashMatches(record, token);
  }

  private liveRecord(uid: string, now: number): SessionTokenRecord | undefined {
    const record = this.records.get(uid);
    if (!record) return undefined;
    if (this.isExpired(record, now)) {
      this.records.delete(uid);
      return undefined;
    }
    return record;
  }

  private hashMatches(record: SessionTokenRecord, token: unknown): boolean {
    if (typeof token !== "string" || token.length === 0) return false;
    // Both sides are SHA-256 digests, so lengths always match and
    // timingSafeEqual never throws; the compare itself leaks nothing about
    // how many leading bytes were right.
    return timingSafeEqual(hashToken(token), record.tokenHash);
  }

  /**
   * The uid's connection is gone. The record is kept for the grace window so
   * the same client can reclaim it; calling this twice keeps the FIRST stamp,
   * so a late duplicate cleanup cannot extend the window.
   */
  detach(uid: string, now: number = Date.now()): void {
    const record = this.records.get(uid);
    if (record && record.detachedAt === undefined) {
      record.detachedAt = now;
    }
  }

  /** Forget a uid's token outright (nothing calls this yet beyond tests and resets). */
  revoke(uid: string): void {
    this.records.delete(uid);
  }

  /** True while a live-or-within-grace record exists for the uid. */
  has(uid: string, now: number = Date.now()): boolean {
    const record = this.records.get(uid);
    return record !== undefined && !this.isExpired(record, now);
  }

  /** Drop every record whose grace window has closed. Returns how many went. */
  purgeExpired(now: number = Date.now()): number {
    if (now - this.lastPurgeAt < PURGE_INTERVAL_MS) return 0;
    this.lastPurgeAt = now;
    let purged = 0;
    for (const [uid, record] of this.records) {
      if (this.isExpired(record, now)) {
        this.records.delete(uid);
        purged += 1;
      }
    }
    return purged;
  }

  clear(): void {
    this.records.clear();
    this.lastPurgeAt = 0;
  }

  get size(): number {
    return this.records.size;
  }

  private isExpired(record: SessionTokenRecord, now: number): boolean {
    return record.detachedAt !== undefined && now - record.detachedAt > SESSION_TOKEN_GRACE_MS;
  }
}
