// ============================================================================
// WEBSOCKET CONNECTION HANDLER
// ============================================================================
// Handles WebSocket connection lifecycle: connect, message, disconnect
// Single responsibility: WebSocket event handling

import type { WebSocket, WebSocketServer } from "ws";
import type { IncomingMessage } from "http";
import type { ClientMessage } from "@herobyte/shared";
import type { Container } from "../container.js";
import { AuthenticationHandler } from "./auth/AuthenticationHandler.js";
import { HeartbeatTimeoutManager } from "./lifecycle/HeartbeatTimeoutManager.js";
import { IdleRoomUnloadManager } from "./lifecycle/IdleRoomUnloadManager.js";
import { DisconnectionCleanupManager } from "./lifecycle/DisconnectionCleanupManager.js";
import { ConnectionLifecycleManager } from "./lifecycle/ConnectionLifecycleManager.js";
import { MessagePipelineManager } from "./message/MessagePipelineManager.js";
import { MessageAuthenticator } from "./auth/MessageAuthenticator.js";

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

  constructor(container: Container, wss: WebSocketServer) {
    this.container = container;
    this.wss = wss;
    this.authHandler = new AuthenticationHandler(
      container,
      container.uidToWs,
      container.authenticatedUids,
      container.authenticatedSessions,
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
    );
    this.lifecycleManager = new ConnectionLifecycleManager(
      {
        roomService: container.roomService,
      },
      container.uidToWs,
      container.authenticatedUids,
      container.authenticatedSessions,
    );
    this.heartbeatManager = new HeartbeatTimeoutManager(container, this.cleanupManager);
    this.idleRoomManager = new IdleRoomUnloadManager(container);
    this.pipelineManager = new MessagePipelineManager(
      {
        maxMessageSize: 1024 * 1024, // 1MB
        onValidMessage: (message, uid) => this.handleValidatedMessage(message, uid),
      },
      container.rateLimiter,
    );
    this.authenticator = new MessageAuthenticator(
      {
        authHandler: this.authHandler,
      },
      container.authenticatedUids,
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
    // Delegate connection lifecycle to ConnectionLifecycleManager
    const { uid } = this.lifecycleManager.handleConnection(ws, req);

    // Message handling
    ws.on("message", (buf) => this.handleMessage(Buffer.from(buf as ArrayBuffer), uid));

    // Disconnection handling
    ws.on("close", () => this.handleDisconnection(uid, ws));
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(buf: Buffer, uid: string): void {
    // Delegate to message pipeline for validation
    this.pipelineManager.processMessage(buf, uid);
  }

  /**
   * Handle validated message from pipeline
   * Performs authentication routing and message dispatch
   */
  private handleValidatedMessage(message: ClientMessage, uid: string): void {
    // Check authentication and route auth messages
    const wasHandled = this.authenticator.checkAuthentication(message, uid);

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
    this.lifecycleManager.stopKeepalive(uid);

    // Delegate player cleanup to DisconnectionCleanupManager
    // Pass WebSocket for race condition check
    this.cleanupManager.cleanupPlayer(uid, { ws });
  }
}
