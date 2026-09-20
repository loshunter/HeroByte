// ============================================================================
// WEBSOCKET CONNECTION HANDLER
// ============================================================================
// Handles WebSocket connection lifecycle: connect, message, disconnect
// Single responsibility: WebSocket event handling

import type { WebSocket, WebSocketServer } from "ws";
import type { IncomingMessage } from "http";
import { WS_MAX_MESSAGE_BYTES, type ClientMessage } from "@herobyte/shared";
import type { Container } from "../container.js";
import { AuthenticationHandler } from "./auth/AuthenticationHandler.js";
import { HeartbeatTimeoutManager } from "./lifecycle/HeartbeatTimeoutManager.js";
import { IdleRoomUnloadManager } from "./lifecycle/IdleRoomUnloadManager.js";
import { DisconnectionCleanupManager } from "./lifecycle/DisconnectionCleanupManager.js";
import { ConnectionLifecycleManager } from "./lifecycle/ConnectionLifecycleManager.js";
import { MessagePipelineManager } from "./message/MessagePipelineManager.js";
import { MessageAuthenticator } from "./auth/MessageAuthenticator.js";
import { clientIpFor } from "../middleware/authWorkLimit.js";

/**
 * WebSocket connection handler
 * Manages client connections and delegates to domain services
 */
export class ConnectionHandler {
  private container: Container;
  private wss: WebSocketServer;
  private authHandler: AuthenticationHandler;
  private cleanupManager: DisconnectionCleanupManager;
  private lifecycleManager: ConnectionLifecycleManager;
  private heartbeatManager: HeartbeatTimeoutManager;
  private idleRoomManager: IdleRoomUnloadManager;
  private pipelineManager: MessagePipelineManager;
  private authenticator: MessageAuthenticator;
  // Socket → remote IP, recorded at connection time for the per-IP auth
  // budget. The uid in the query string is client-supplied; this is not.
  private readonly ipOfWs = new WeakMap<WebSocket, string>();

  constructor(container: Container, wss: WebSocketServer) {
    this.container = container;
    this.wss = wss;
    this.authHandler = new AuthenticationHandler(
      container,
      container.uidToWs,
      container.authenticatedUids,
      container.authenticatedSessions,
      container.sessionTokens,
      container.authWorkLimiter,
      this.ipOfWs,
    );
    this.cleanupManager = new DisconnectionCleanupManager(
      {
        getRoomIdForUid: (uid) => container.roomIdForUid(uid),
        getRoomServiceForRoom: (roomId) => container.getRoomServiceForRoom(roomId),
        getAuthenticatedClientsForRoom: (roomId) =>
          container.getAuthenticatedClientsForRoom(roomId),
        selectionService: container.selectionService,
      },
      container.uidToWs,
      container.authenticatedUids,
      container.authenticatedSessions,
      container.sessionTokens,
    );
    this.lifecycleManager = new ConnectionLifecycleManager(
      {
        getRoomIdForUid: (uid) => container.roomIdForUid(uid),
        getRoomServiceForRoom: (roomId) => container.getRoomServiceForRoom(roomId),
      },
      container.uidToWs,
      container.authenticatedUids,
      container.authenticatedSessions,
      container.sessionTokens,
    );
    this.heartbeatManager = new HeartbeatTimeoutManager(container, this.cleanupManager);
    this.idleRoomManager = new IdleRoomUnloadManager(container);
    this.pipelineManager = new MessagePipelineManager(
      {
        maxMessageSize: WS_MAX_MESSAGE_BYTES,
        onValidMessage: (message, uid, ws) => this.handleValidatedMessage(message, uid, ws),
      },
      container.rateLimiter,
    );
    this.authenticator = new MessageAuthenticator(
      {
        authHandler: this.authHandler,
      },
      container.authenticatedUids,
      container.uidToWs,
    );
  }

  /**
   * Set up WebSocket server event handlers
   */
  attach(): void {
    this.wss.on("connection", (ws, req) => this.handleConnection(ws, req));

    // Start heartbeat timeout checker
    this.heartbeatManager.start();

    // Start idle-room unloader (dormant tables cost no memory)
    this.idleRoomManager.start();
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    // Record the connection's real remote IP (x-forwarded-for's last entry
    // behind a trusted proxy, else the socket peer) for the auth budget.
    this.ipOfWs.set(ws, clientIpFor(req.socket?.remoteAddress, req.headers?.["x-forwarded-for"]));

    // A ws socket with NO "error" listener is a remote kill switch: `ws`
    // emits "error" on a protocol violation, and EventEmitter THROWS when
    // "error" has no listener, so the throw escapes as an uncaught exception
    // and takes the whole process — every table on the instance — down.
    // Reachable by any client: exceed maxPayload (raised off the DECLARED
    // frame length, before a payload byte is read, so the application-level
    // size check never runs), or send a malformed frame. ws has already
    // closed the socket with 1009 by this point; the close handler does the
    // cleanup, so this only has to stop the throw. Attached FIRST, so a
    // connection rejected below is covered too.
    ws.on("error", (error) => {
      console.warn(`[WebSocket] Connection error: ${error.message}`);
    });

    // Delegate connection lifecycle to ConnectionLifecycleManager. The socket
    // rides along with every message from here on: two sockets can claim one
    // uid (a held newcomer beside a live incumbent), so "which socket sent
    // this" cannot be recovered from the uid alone.
    const { uid, rejected } = this.lifecycleManager.handleConnection(ws, req);
    if (rejected) return; // closed on the spot; nothing was registered

    // Message handling
    ws.on("message", (buf) => this.handleMessage(Buffer.from(buf as ArrayBuffer), uid, ws));

    // Disconnection handling
    ws.on("close", () => this.handleDisconnection(uid, ws));
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(buf: Buffer, uid: string, ws: WebSocket): void {
    // Delegate to message pipeline for validation
    this.pipelineManager.processMessage(buf, uid, ws);
  }

  /**
   * Handle validated message from pipeline
   * Performs authentication routing and message dispatch
   */
  private handleValidatedMessage(message: ClientMessage, uid: string, ws?: WebSocket): void {
    // Check authentication and route auth messages. `ws` is always present on
    // this path (the pipeline passes it through); the guard is for the type.
    if (!ws) return;
    const wasHandled = this.authenticator.checkAuthentication(message, uid, ws);

    // If message was handled (auth message or dropped), return
    if (wasHandled) {
      return;
    }

    // Route through the sender's room
    this.container.routerForUid(uid).route(message, uid);
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(uid: string, ws: WebSocket): void {
    // Delegate keepalive cleanup to ConnectionLifecycleManager
    this.lifecycleManager.stopKeepalive(ws);

    // Delegate player cleanup to DisconnectionCleanupManager
    // Pass WebSocket for race condition check
    this.cleanupManager.cleanupPlayer(uid, { ws });
  }
}
