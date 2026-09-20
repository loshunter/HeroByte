// ============================================================================
// AUTHENTICATION HANDLER
// ============================================================================
// Handles WebSocket authentication, DM elevation, and password management
// Single responsibility: Authentication flow management

import type { WebSocket } from "ws";
import {
  WS_CLOSE_AUTH_REJECTED,
  WS_CLOSE_REPLACED,
  WS_CLOSE_SESSION_CONFLICT,
} from "@herobyte/shared";
import type { CreateRoomRequest } from "./roomCreation.js";
import type { ForkTableRequest } from "./tableFork.js";
import { createRoomForUid, forkTableForSender } from "./roomMinting.js";
import { setDMPasswordForUid } from "./dmPasswordUpdate.js";
import { DMElevationThrottle } from "./dmElevationThrottle.js";
import { elevateUidToDM, revokeUidDM } from "./dmElevation.js";
import { leaveRoomRoster, provisionJoin } from "./joinProvisioning.js";
import type { SessionTokenService } from "./SessionTokenService.js";
import type { Container } from "../../container.js";
import { getDefaultRoomId } from "../../config/auth.js";
import { createAuthWorkLimiter, type TokenBucketLimiter } from "../../middleware/authWorkLimit.js";

/** The fields of an `authenticate` frame the handler acts on. */
export interface AuthenticateRequest {
  secret: string;
  roomId?: string;
  /** The session token a previous auth-ok minted, if the client holds one. */
  token?: string;
}

/**
 * Authentication handler for WebSocket connections
 * Manages room authentication, DM elevation, and DM password management
 * Delegates to AuthService for password verification
 */
export class AuthenticationHandler {
  private container: Container;
  private uidToWs: Map<string, WebSocket>;
  private authenticatedUids: Set<string>;
  private authenticatedSessions: Map<string, { roomId: string; authedAt: number }>;
  private readonly sessionTokens: SessionTokenService;
  private readonly defaultRoomId: string;
  private readonly dmThrottle = new DMElevationThrottle();
  // Uids with a password check in flight. verify() now yields to the
  // threadpool, so a client could stack concurrent attempts on one
  // connection and interleave the post-await state mutations; one at a
  // time per uid keeps the flow as serial as it was when it was sync.
  private readonly pendingAuthWork = new Set<string>();

  // Per-IP budget for scrypt-priced work, shared with the HTTP routes (D7).
  private readonly authWorkLimiter: TokenBucketLimiter;
  // Socket → remote IP, filled by ConnectionHandler at connection time. A
  // WeakMap so a closed socket's entry needs no lifecycle bookkeeping.
  private readonly ipOfWs: WeakMap<WebSocket, string>;

  constructor(
    container: Container,
    uidToWs: Map<string, WebSocket>,
    authenticatedUids: Set<string>,
    authenticatedSessions: Map<string, { roomId: string; authedAt: number }>,
    sessionTokens: SessionTokenService,
    authWorkLimiter?: TokenBucketLimiter,
    ipOfWs?: WeakMap<WebSocket, string>,
  ) {
    this.container = container;
    this.uidToWs = uidToWs;
    this.authenticatedUids = authenticatedUids;
    this.authenticatedSessions = authenticatedSessions;
    this.sessionTokens = sessionTokens;
    this.defaultRoomId = getDefaultRoomId();
    this.authWorkLimiter = authWorkLimiter ?? createAuthWorkLimiter();
    this.ipOfWs = ipOfWs ?? new WeakMap();
  }

  /**
   * Spend one unit of this connection's per-IP auth budget. Checked BEFORE
   * any scrypt runs — the uid is client-supplied and free to rotate, the IP
   * is not. Sockets with no recorded IP share the "unknown" bucket:
   * throttling them together beats exempting them.
   */
  private takeAuthWork(ws: WebSocket): boolean {
    return this.authWorkLimiter.take(this.ipOfWs.get(ws) ?? "unknown");
  }

  /** Success refund — only failed guesses stay charged against the IP. */
  private refundAuthWork(ws: WebSocket): void {
    this.authWorkLimiter.refund(this.ipOfWs.get(ws) ?? "unknown");
  }

  /**
   * Authenticate a client connection using the shared room secret
   *
   * Async because the password check is: the scrypt compare runs off the
   * event loop. Everything BEFORE the await is unchanged; everything after
   * re-checks that this socket is still the uid's current connection, since
   * the connection can be replaced while the hash is computing.
   *
   * @param uid - Unique identifier for the client
   * @param request - The authenticate frame: room password, optional room id,
   *   and the session token from a previous auth-ok when the client holds one
   * @param replyWs - The socket the frame arrived on. Defaults to the uid's
   *   registered socket for callers that have no other handle on it.
   */
  async authenticate(
    uid: string,
    request: AuthenticateRequest,
    replyWs?: WebSocket,
  ): Promise<void> {
    const ws = replyWs ?? this.uidToWs.get(uid);
    if (!ws) {
      return;
    }

    const now = Date.now();

    // Re-authentication by the socket that already HOLDS the session grants
    // nothing new, so it stays passwordless. Any other socket claiming an
    // authenticated uid — a held newcomer — must take the full path below and
    // prove the session token before it can take the slot over.
    if (this.authenticatedUids.has(uid) && this.uidToWs.get(uid) === ws) {
      const sessionRoomId = this.container.roomIdForUid(uid);
      const state = this.container.getRoomServiceForRoom(sessionRoomId).getState();
      const player = this.container.playerService.findPlayer(state, uid);
      if (player) player.lastHeartbeat = now;

      this.refreshAuthenticatedSession(uid, now);
      this.sendAuthOk(ws, this.sessionTokens.mint(uid, sessionRoomId, now));
      return;
    }

    // Validate room ID: URL-safe names only; rooms are created on first join.
    const requestedRoomId = request.roomId?.trim() || this.defaultRoomId;
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(requestedRoomId)) {
      this.rejectAuthentication(ws, "Invalid room id");
      return;
    }

    // Per-IP budget, spent BEFORE any scrypt. The re-auth path above is
    // exempt on purpose: it does no hashing, and heartbeat re-auths from an
    // established session must never burn the network's budget.
    if (!this.takeAuthWork(ws)) {
      this.rejectAuthentication(
        ws,
        "Too many attempts from your network. Wait a minute and try again.",
      );
      return;
    }

    // One in-flight check per uid: a second attempt while the first hashes
    // is a client bug or a flood, not a flow to support. Refund first — this
    // path spends no scrypt, and leaking the token here is what lets an
    // ordinary double-submit drain a whole network's budget.
    if (this.pendingAuthWork.has(uid)) {
      this.refundAuthWork(ws);
      return;
    }
    this.pendingAuthWork.add(uid);

    // Verify room password (per-room secret, falling back to the default)
    let verified: boolean;
    try {
      const normalizedSecret = request.secret.trim();
      verified = await this.container.authService.verify(normalizedSecret, requestedRoomId);
    } finally {
      this.pendingAuthWork.delete(uid);
    }

    // The world may have moved while the hash computed: bail if this socket
    // closed, or if a competing attempt on it already finished. A correct
    // password that lands here still earns its refund — the work was
    // legitimate, we just have nobody to tell.
    const occupant = this.uidToWs.get(uid);
    if (ws.readyState !== 1 || (occupant === ws && this.authenticatedUids.has(uid))) {
      if (verified) this.refundAuthWork(ws);
      return;
    }

    if (!verified) {
      console.warn(`Authentication failed for uid ${uid}`);
      this.rejectAuthentication(ws, "Invalid table password");
      return;
    }

    // Who may hold the uid. While the uid has a session anyone could still
    // prove — live on another socket, or detached inside the grace window —
    // only that session's token claims it: a reconnect, a second tab of the
    // same browser, a return after a break. Everyone else is turned away, and
    // whatever holds the uid is left exactly as it was: not evicted, not
    // impersonated, and NOT re-minted over (a password-only claim that was
    // first back after a blip used to replace the owner's record and lock the
    // owner out for as long as it stayed). The takeover proof is "same
    // session", so it accepts the token whatever table the session is in; the
    // DM check below is per table. A uid with no live session — fresh, expired,
    // or after a server restart — is claimed by the password alone.
    const sameSession = this.sessionTokens.matches(uid, request.token, now);
    if (!sameSession && this.sessionTokens.has(uid, now)) {
      console.warn(`[Auth] ${uid}: session belongs to another browser, claim turned away`);
      // Not refunded: a failed takeover stays charged, like a failed guess.
      ws.close(WS_CLOSE_SESSION_CONFLICT, "Session held by another connection");
      return;
    }
    const previousRoomId = this.container.roomIdForUid(uid);
    // Register the newcomer BEFORE closing any old socket, so a close handler
    // that runs synchronously sees it is stale and skips cleanup. The occupant
    // here is dead, never authenticated, or ours (sameSession).
    this.uidToWs.set(uid, ws);
    if (occupant && occupant !== ws) {
      occupant.close(WS_CLOSE_REPLACED, "Replaced by new connection");
    }

    // A correct password refunds its token: a full party joining together
    // must never exhaust their own network's budget.
    this.refundAuthWork(ws);

    const roomService = this.container.getRoomServiceForRoom(requestedRoomId);
    const state = roomService.getState();
    const player = provisionJoin(this.container, roomService, state, uid);
    player.lastHeartbeat = now;

    // A persisted DM flag is honoured only when the reconnect proves it is the
    // SAME session, by the token minted to it — for THIS table. The room
    // password is shared by the whole table and cannot tell dave from someone
    // who was handed it, so a tokenless reclaim of a DM's uid gets the record
    // — name, character, tokens — but must re-elevate with the DM password.
    if (player.isDM && !this.sessionTokens.verify(uid, requestedRoomId, request.token, now)) {
      console.log(`[Auth] tokenless reclaim of ${uid}: DM reset, re-elevation required`);
      player.isDM = false;
    }

    // A session that moved tables in one step leaves the old roster, or the
    // heartbeat sweep would later find the stale entry and clean up the NEW room.
    if (previousRoomId !== requestedRoomId) {
      leaveRoomRoster(this.container, this.uidToWs, uid, previousRoomId);
    }

    // Track authentication state
    this.authenticatedUids.add(uid);
    this.refreshAuthenticatedSession(uid, now, requestedRoomId);
    this.container.touchRoomActivity(requestedRoomId);

    // Register user for session lists
    state.users = state.users.filter((u) => u !== uid);
    state.users.push(uid);

    // A verified password mints the session's secret; the client sends it back
    // on every reconnect as the proof that it is the same session.
    this.sendAuthOk(ws, this.sessionTokens.mint(uid, requestedRoomId, now));
    console.log(`Client authenticated: ${uid} (room ${requestedRoomId})`);

    // Broadcast updated room state to the room's authenticated clients
    roomService.broadcast(
      this.container.getAuthenticatedClientsForRoom(requestedRoomId),
      this.uidToWs,
      {
        reason: "auth-success",
      },
    );
  }

  /**
   * Elevate a client to DM. Implementation lives in dmElevation.ts (extracted
   * for the file-size guard); async because the DM-password compare is.
   */
  async elevateToDM(uid: string, dmPassword: string): Promise<void> {
    await elevateUidToDM(this.dmElevationDeps(), uid, dmPassword);
  }

  /** Revoke DM status from a client (see dmElevation.ts). */
  revokeDM(uid: string): void {
    revokeUidDM(this.dmElevationDeps(), uid);
  }

  private dmElevationDeps() {
    return {
      container: this.container,
      uidToWs: this.uidToWs,
      dmThrottle: this.dmThrottle,
      pendingAuthWork: this.pendingAuthWork,
      takeAuthWork: (ws: WebSocket) => this.takeAuthWork(ws),
      refundAuthWork: (ws: WebSocket) => this.refundAuthWork(ws),
    };
  }

  /**
   * Set or update the DM password (DM-only, or anyone when none exists yet).
   * Refused outright on the test table, whose DM password is fixed.
   */
  setDMPassword(uid: string, dmPassword: string): void {
    setDMPasswordForUid(this.container, this.uidToWs.get(uid), uid, dmPassword, this.defaultRoomId);
  }

  /**
   * Mint a private table (pre-auth; see roomMinting.ts). Replies on the socket
   * the request arrived on — a held newcomer is not the uid's registered one.
   */
  async createRoom(uid: string, request: CreateRoomRequest, replyWs?: WebSocket): Promise<void> {
    await createRoomForUid(this.roomMintingDeps(), replyWs ?? this.uidToWs.get(uid), request);
  }

  /** Copy the sender's table into a new private one (DM-only; see roomMinting.ts). */
  async forkTable(uid: string, request: ForkTableRequest): Promise<void> {
    await forkTableForSender(this.roomMintingDeps(), this.uidToWs.get(uid), uid, request);
  }

  private roomMintingDeps() {
    return {
      container: this.container,
      defaultRoomId: this.defaultRoomId,
      takeAuthWork: (ws: WebSocket) => this.takeAuthWork(ws),
    };
  }

  /** Reject an authentication attempt and close the connection. */
  private rejectAuthentication(ws: WebSocket, reason: string): void {
    ws.send(JSON.stringify({ t: "auth-failed", reason }));
    setTimeout(() => {
      if (ws.readyState === 1) {
        ws.close(WS_CLOSE_AUTH_REJECTED, reason);
      }
    }, 100);
  }

  /** Refresh or create the authenticated-session record (preserving room if unset). */
  private refreshAuthenticatedSession(uid: string, authedAt: number, roomId?: string): void {
    const existingSession = this.authenticatedSessions.get(uid);
    const effectiveRoomId = roomId ?? existingSession?.roomId ?? this.defaultRoomId;

    this.authenticatedSessions.set(uid, {
      roomId: effectiveRoomId,
      authedAt,
    });
  }

  /** Send the authentication-success message, carrying the session token, to a client. */
  private sendAuthOk(ws: WebSocket, sessionToken: string): void {
    ws.send(JSON.stringify({ t: "auth-ok", sessionToken }));
  }
}
