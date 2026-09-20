// ============================================================================
// CONNECTION LIFECYCLE MANAGER
// ============================================================================
// Manages WebSocket connection lifecycle: establishment, replacement, registration
// Single responsibility: Connection establishment and keepalive management
//
// Extracted from ConnectionHandler.handleConnection() (lines 82-123)

import type { WebSocket } from "ws";
import type { IncomingMessage } from "http";
import { WS_CLOSE_REPLACED } from "@herobyte/shared";
import type { RoomService } from "../../domains/room/service.js";
import type { SessionTokenService } from "../auth/SessionTokenService.js";

/**
 * Configuration for ConnectionLifecycleManager
 */
export interface ConnectionLifecycleConfig {
  /** The room a uid's session is in (the default room until it authenticates). */
  getRoomIdForUid: (uid: string) => string;
  /** RoomService for a room, so a replaced uid leaves the roster of ITS room. */
  getRoomServiceForRoom: (roomId: string) => RoomService;

  /**
   * Optional callback invoked when a connection is replaced
   * @param uid - Client unique identifier
   * @param wasAuthenticated - Whether the replaced connection was authenticated
   */
  onConnectionReplaced?: (uid: string, wasAuthenticated: boolean) => void;
}

/**
 * Result of connection handling
 */
export interface ConnectionLifecycleResult {
  /**
   * Extracted client UID from connection URL
   */
  uid: string;
  /**
   * True when the uid's session is LIVE and AUTHENTICATED on another socket.
   * This newcomer was neither registered nor did it evict anyone: it is a
   * bystander until its `authenticate` proves the session token, at which
   * point AuthenticationHandler swaps it in. Until then every other message
   * it sends is dropped (MessageAuthenticator checks the registered socket).
   */
  held: boolean;
}

/**
 * ConnectionLifecycleManager handles WebSocket connection lifecycle
 *
 * 1. Extract client UID from connection URL
 * 2. Decide who holds the uid's slot (see the rules below)
 * 3. Register the connection in uidToWs — or hold it
 * 4. Setup keepalive ping interval, per socket
 *
 * Who holds a uid's slot — the security rule this class enforces:
 * - A uid is CLIENT-SUPPLIED (the connect URL) and every uid is published in
 *   the roster, so a newcomer claiming one has proven nothing yet.
 * - If the uid's session is live and authenticated on another socket, the
 *   newcomer is HELD: not registered, and the incumbent is not closed. Before
 *   this rule, connecting as `?uid=dave` closed dave's socket and inherited
 *   dave's auth flag — DM included — with no password at all.
 * - A dead or unauthenticated occupant is replaced (closed with
 *   WS_CLOSE_REPLACED); that is the reconnect-after-blip path and stays fast.
 * - Adoption NEVER confers auth. The uid's auth flag and session are cleared
 *   on every adoption; the newcomer authenticates with its password and, if
 *   it holds one, the session token that lets it keep its DM elevation.
 *
 * Race Condition Prevention:
 * - The newcomer is registered BEFORE the old socket is closed, so a close
 *   handler that runs synchronously sees it is no longer current and skips
 *   cleanup (DisconnectionCleanupManager checks the registered socket).
 */
export class ConnectionLifecycleManager {
  private config: ConnectionLifecycleConfig;
  private uidToWs: Map<string, WebSocket>;
  private authenticatedUids: Set<string>;
  private authenticatedSessions: Map<string, { roomId: string; authedAt: number }>;
  private sessionTokens: SessionTokenService;
  // Keyed by SOCKET, not uid: a held newcomer needs its own ping, and a swap
  // must not have to hand a timer over from one socket to another.
  private keepalives: Map<WebSocket, NodeJS.Timeout>;

  /**
   * @param config - Room resolvers and optional callbacks
   * @param uidToWs - Map of client UIDs to WebSocket connections (shared reference)
   * @param authenticatedUids - Set of authenticated client UIDs (shared reference)
   * @param authenticatedSessions - Map of client UIDs to session data (shared reference)
   * @param sessionTokens - The per-uid session tokens (shared reference)
   */
  constructor(
    config: ConnectionLifecycleConfig,
    uidToWs: Map<string, WebSocket>,
    authenticatedUids: Set<string>,
    authenticatedSessions: Map<string, { roomId: string; authedAt: number }>,
    sessionTokens: SessionTokenService,
  ) {
    this.config = config;
    this.uidToWs = uidToWs;
    this.authenticatedUids = authenticatedUids;
    this.authenticatedSessions = authenticatedSessions;
    this.sessionTokens = sessionTokens;
    this.keepalives = new Map();
  }

  /**
   * Handle new WebSocket connection — see the class comment for the rules.
   *
   * @param ws - The WebSocket connection
   * @param req - The incoming HTTP request
   * @returns The extracted UID and whether the newcomer was held
   */
  handleConnection(ws: WebSocket, req: IncomingMessage): ConnectionLifecycleResult {
    // Extract player UID from connection URL
    const params = new URL(req.url || "", "http://localhost").searchParams;
    const uid = params.get("uid") || "anon";

    const existingWs = this.uidToWs.get(uid);
    const wasAuthenticated = this.authenticatedUids.has(uid);

    // Every socket pings, held or registered, so a cloud proxy never idles
    // one out while it waits to authenticate.
    this.startKeepalive(ws);

    const incumbentIsLive =
      existingWs !== undefined && existingWs !== ws && existingWs.readyState === 1;
    if (incumbentIsLive && wasAuthenticated) {
      console.log(
        `[WebSocket] Holding a second connection for ${uid}: session live on another socket`,
      );
      return { uid, held: true };
    }

    // The uid's room BEFORE the session record goes, so it leaves the right roster.
    const roomId = this.config.getRoomIdForUid(uid);

    if (existingWs && existingWs !== ws) {
      console.log(
        `[WebSocket] Replacing connection for ${uid} (was authenticated: ${wasAuthenticated})`,
      );
      // Register first, close second — see "Race Condition Prevention" above.
      this.uidToWs.set(uid, ws);
      existingWs.close(WS_CLOSE_REPLACED, "Replaced by new connection");
      this.config.onConnectionReplaced?.(uid, wasAuthenticated);
    } else {
      this.uidToWs.set(uid, ws);
    }

    // Adoption never confers auth: the newcomer proves itself in `authenticate`.
    this.authenticatedUids.delete(uid);
    this.authenticatedSessions.delete(uid);
    // The token record is detached with the session, not left attached: a
    // newcomer that never authenticates would otherwise keep a dead session's
    // token valid forever. Within the grace window it still proves a reconnect.
    this.sessionTokens.detach(uid);
    const state = this.config.getRoomServiceForRoom(roomId).getState();
    state.users = state.users.filter((u: string) => u !== uid);

    return { uid, held: false };
  }

  /** Ping every 25 s to keep cloud-provider proxies from idling the socket out. */
  private startKeepalive(ws: WebSocket): void {
    const keepalive = setInterval(() => {
      if (ws.readyState === 1) {
        ws.ping();
      }
    }, 25000);
    this.keepalives.set(ws, keepalive);
  }

  /**
   * Stop keepalive ping for a socket
   *
   * Clears the interval and removes it from internal tracking.
   * Safe to call even if no keepalive exists for the socket.
   *
   * @param ws - The socket whose keepalive should stop
   */
  stopKeepalive(ws: WebSocket): void {
    const keepalive = this.keepalives.get(ws);
    if (keepalive) {
      clearInterval(keepalive);
      this.keepalives.delete(ws);
    }
  }

  /**
   * Check if a WebSocket is the current connection for a UID
   *
   * Used to prevent race conditions when a connection is replaced
   * before the old connection's close handler runs.
   *
   * @param uid - Client unique identifier
   * @param ws - WebSocket to check
   * @returns True if this WebSocket is still the current connection for the UID
   */
  isCurrentConnection(uid: string, ws: WebSocket): boolean {
    return this.uidToWs.get(uid) === ws;
  }
}
