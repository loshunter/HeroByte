// ============================================================================
// AUTHENTICATION HANDLER
// ============================================================================
// Handles WebSocket authentication, DM elevation, and password management
// Single responsibility: Authentication flow management

import type { WebSocket } from "ws";
import { WS_CLOSE_AUTH_REJECTED, type Player } from "@herobyte/shared";
import { handleCreateRoom, type CreateRoomRequest } from "./roomCreation.js";
import { forkTableForUid, type ForkTableRequest } from "./tableFork.js";
import { setDMPasswordForUid } from "./dmPasswordUpdate.js";
import { DMElevationThrottle } from "./dmElevationThrottle.js";
import { elevateUidToDM, revokeUidDM } from "./dmElevation.js";
import type { Container } from "../../container.js";
import { getDefaultRoomId } from "../../config/auth.js";
import { createAuthWorkLimiter, type TokenBucketLimiter } from "../../middleware/authWorkLimit.js";

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
    authWorkLimiter?: TokenBucketLimiter,
    ipOfWs?: WeakMap<WebSocket, string>,
  ) {
    this.container = container;
    this.uidToWs = uidToWs;
    this.authenticatedUids = authenticatedUids;
    this.authenticatedSessions = authenticatedSessions;
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
   * @param secret - Room password provided by the client
   * @param roomId - Optional room identifier (defaults to default room)
   */
  async authenticate(uid: string, secret: string, roomId?: string): Promise<void> {
    const ws = this.uidToWs.get(uid);
    if (!ws) {
      return;
    }

    const now = Date.now();

    // Handle re-authentication (client already authenticated). The session
    // keeps its original room — switching rooms requires a fresh connection.
    if (this.authenticatedUids.has(uid)) {
      const sessionRoomId = this.container.roomIdForUid(uid);
      const state = this.container.getRoomServiceForRoom(sessionRoomId).getState();
      const player = this.container.playerService.findPlayer(state, uid);
      if (player) {
        this.touchPlayerHeartbeat(player, now);
      }

      this.refreshAuthenticatedSession(uid, now);
      this.sendAuthOk(ws);
      return;
    }

    // Validate room ID: URL-safe names only; rooms are created on first join.
    const requestedRoomId = roomId?.trim() || this.defaultRoomId;
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
      const normalizedSecret = secret.trim();
      verified = await this.container.authService.verify(normalizedSecret, requestedRoomId);
    } finally {
      this.pendingAuthWork.delete(uid);
    }

    // The world may have moved while the hash computed: bail if this socket
    // was replaced or closed, or if a competing attempt already finished.
    // A correct password that lands here still earns its refund — the work
    // was legitimate, we just have nobody to tell.
    if (this.uidToWs.get(uid) !== ws || this.authenticatedUids.has(uid)) {
      if (verified) this.refundAuthWork(ws);
      return;
    }

    if (!verified) {
      console.warn(`Authentication failed for uid ${uid}`);
      this.rejectAuthentication(ws, "Invalid table password");
      return;
    }

    // A correct password refunds its token: a full party joining together
    // must never exhaust their own network's budget.
    this.refundAuthWork(ws);

    const roomService = this.container.getRoomServiceForRoom(requestedRoomId);
    const state = roomService.getState();
    let player = this.container.playerService.findPlayer(state, uid);

    // Create or reconnect player entities
    if (!player) {
      player = this.container.playerService.createPlayer(state, uid);
    }

    this.touchPlayerHeartbeat(player, now);

    // Create character if player doesn't have one
    const existingCharacter = this.container.characterService.findCharacterByOwner(state, uid);
    if (!existingCharacter) {
      const character = this.container.characterService.createCharacter(
        state,
        player.name,
        100, // default maxHp
        player.portrait,
        "pc",
      );
      this.container.characterService.claimCharacter(state, character.id, uid);

      // Create token for the character (ONLY if not a DM)
      // DM players should never have tokens on the map
      if (!player.isDM) {
        const spawn = roomService.getPlayerSpawnPosition();
        const token = this.container.tokenService.createToken(state, uid, spawn.x, spawn.y);
        this.container.characterService.linkToken(state, character.id, token.id);
      }
    } else {
      // Player reconnecting - ensure they have a token (ONLY if not a DM)
      // DM players should never have tokens on the map
      if (!player.isDM) {
        const existingToken = this.container.tokenService.findTokenByOwner(state, uid);
        if (!existingToken) {
          const spawn = roomService.getPlayerSpawnPosition();
          const token = this.container.tokenService.createToken(state, uid, spawn.x, spawn.y);
          this.container.characterService.linkToken(state, existingCharacter.id, token.id);
        }
      }
    }

    // Track authentication state
    this.authenticatedUids.add(uid);
    this.refreshAuthenticatedSession(uid, now, requestedRoomId);
    this.container.touchRoomActivity(requestedRoomId);

    // Register user for session lists
    state.users = state.users.filter((u) => u !== uid);
    state.users.push(uid);

    this.sendAuthOk(ws);
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

  async createRoom(uid: string, request: CreateRoomRequest): Promise<void> {
    const ws = this.uidToWs.get(uid);
    // create-room is reachable PRE-auth and hashes up to two passwords, so it
    // spends the same per-IP budget as a password guess.
    if (ws && !this.takeAuthWork(ws)) {
      ws.send(
        JSON.stringify({
          t: "room-create-failed",
          reason: "Too many attempts from your network. Wait a minute and try again.",
        }),
      );
      return;
    }
    await handleCreateRoom(
      this.container.authService,
      ws,
      this.defaultRoomId,
      request,
      (roomId, name) => {
        this.container.getRoomServiceForRoom(roomId).setState({ tableName: name });
      },
    );
  }

  /**
   * Copy the sender's table into a new private one (DM-only, post-auth). This
   * is how work done on the test table is kept: that table's password is fixed
   * and it is wiped hourly, so a durable copy is the only way to hold on to it.
   */
  async forkTable(uid: string, request: ForkTableRequest): Promise<void> {
    const ws = this.uidToWs.get(uid);
    // Forking mints a room (hashing) — same budget as create-room.
    if (ws && !this.takeAuthWork(ws)) {
      ws.send(
        JSON.stringify({
          t: "table-fork-failed",
          reason: "Too many attempts from your network. Wait a minute and try again.",
        }),
      );
      return;
    }
    await forkTableForUid(this.container, ws, uid, request);
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

  /** Update a player's last-heartbeat timestamp. */
  private touchPlayerHeartbeat(player: Player, timestamp: number): void {
    player.lastHeartbeat = timestamp;
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

  /** Send the authentication-success message to a client. */
  private sendAuthOk(ws: WebSocket): void {
    ws.send(JSON.stringify({ t: "auth-ok" }));
  }
}
