// ============================================================================
// CONNECTION LIFECYCLE MANAGER
// ============================================================================
// Manages WebSocket connection lifecycle: establishment, replacement, registration
// Single responsibility: Connection establishment and keepalive management
//
// Extracted from ConnectionHandler.handleConnection() (lines 82-123)

import type { WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { RoomService } from "../../services/room/roomService.js";
import type { SessionData } from "../auth/AuthenticationHandler.js";

/**
 * Configuration for ConnectionLifecycleManager
 */
export interface ConnectionLifecycleConfig {
  /**
   * Room service for managing room state
   */
  roomService: RoomService;

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
   * Keepalive interval handle for ping management
   */
  keepalive: NodeJS.Timeout;
}

/**
 * ConnectionLifecycleManager handles WebSocket connection lifecycle
 *
 * This class manages the complete lifecycle of establishing a new WebSocket connection:
 * 1. Extract client UID from connection URL
 * 2. Handle connection replacement (close existing connection)
 * 3. Manage seamless reconnection (preserve auth state)
 * 4. Register connection in uidToWs map
 * 5. Setup keepalive ping interval
 *
 * Connection Replacement Logic:
 * - If a UID already has a connection, close the old connection
 * - If the old connection was authenticated, preserve auth state
 * - If the old connection was not authenticated, clear auth state
 *
 * Race Condition Prevention:
 * - Checks that WebSocket reference matches before cleanup
 * - Prevents rapid reconnections from clearing wrong connection
 *
 * @example
 * ```typescript
 * const lifecycleManager = new ConnectionLifecycleManager(
 *   {
 *     roomService: roomService,
 *     onConnectionReplaced: (uid, wasAuth) => {
 *       console.log(`Replaced connection for ${uid} (was authenticated: ${wasAuth})`);
 *     }
 *   },
 *   uidToWs,
 *   authenticatedUids,
 *   authenticatedSessions
 * );
 *
 * // Handle new connection
 * const { uid, keepalive } = lifecycleManager.handleConnection(ws, req);
 *
 * // Later, on disconnection, clear keepalive
 * clearInterval(keepalive);
 * ```
 */
export class ConnectionLifecycleManager {
  private config: ConnectionLifecycleConfig;
  private uidToWs: Map<string, WebSocket>;
  private authenticatedUids: Set<string>;
  private authenticatedSessions: Map<string, SessionData>;

  /**
   * Create a new ConnectionLifecycleManager
   *
   * @param config - Configuration including RoomService and optional callbacks
   * @param uidToWs - Map of client UIDs to WebSocket connections (shared reference)
   * @param authenticatedUids - Set of authenticated client UIDs (shared reference)
   * @param authenticatedSessions - Map of client UIDs to session data (shared reference)
   */
  constructor(
    config: ConnectionLifecycleConfig,
    uidToWs: Map<string, WebSocket>,
    authenticatedUids: Set<string>,
    authenticatedSessions: Map<string, SessionData>,
  ) {
    this.config = config;
    this.uidToWs = uidToWs;
    this.authenticatedUids = authenticatedUids;
    this.authenticatedSessions = authenticatedSessions;
  }

  /**
   * Handle new WebSocket connection
   *
   * This method implements the connection establishment logic extracted from
   * ConnectionHandler.handleConnection().
   *
   * Connection Flow:
   * 1. Extract UID from connection URL (defaults to "anon")
   * 2. Get current room state
   * 3. Close existing connection if present (race condition prevention)
   * 4. Clear auth state only if old connection was not authenticated
   * 5. Register new connection in uidToWs map
   * 6. Setup keepalive ping interval (25 seconds)
   *
   * @param ws - The WebSocket connection
   * @param req - The incoming HTTP request
   * @returns Object containing extracted UID and keepalive interval handle
   */
  handleConnection(ws: WebSocket, req: IncomingMessage): ConnectionLifecycleResult {
    // Extract player UID from connection URL
    const params = new URL(req.url || "", "http://localhost").searchParams;
    const uid = params.get("uid") || "anon";

    const state = this.config.roomService.getState();

    // Close existing connection for this UID to prevent race conditions
    const existingWs = this.uidToWs.get(uid);
    const wasAuthenticated = this.authenticatedUids.has(uid);

    if (existingWs && existingWs !== ws) {
      console.log(
        `[WebSocket] Replacing connection for ${uid} (was authenticated: ${wasAuthenticated})`,
      );
      existingWs.close(4001, "Replaced by new connection");
      this.config.onConnectionReplaced?.(uid, wasAuthenticated);
    }

    // Only clear authentication if this is a truly new connection (not a replacement)
    // If the old connection was authenticated, keep the auth state for seamless reconnection
    if (!wasAuthenticated) {
      this.authenticatedUids.delete(uid);
      this.authenticatedSessions.delete(uid);
      state.users = state.users.filter((u) => u !== uid);
    }

    // Register connection
    this.uidToWs.set(uid, ws);

    // Keepalive ping to prevent cloud provider timeout
    const keepalive = setInterval(() => {
      if (ws.readyState === 1) {
        ws.ping();
      }
    }, 25000);

    return { uid, keepalive };
  }
}
