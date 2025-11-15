// ============================================================================
// WEBSOCKET CONNECTION HANDLER
// ============================================================================
// Handles WebSocket connection lifecycle: connect, message, disconnect
// Single responsibility: WebSocket event handling

import type { WebSocket, WebSocketServer } from "ws";
import type { IncomingMessage } from "http";
import type { ClientMessage } from "@shared";
import type { Container } from "../container.js";
import { getDefaultRoomId } from "../config/auth.js";
import { AuthenticationHandler } from "./auth/AuthenticationHandler.js";
import { HeartbeatTimeoutManager } from "./lifecycle/HeartbeatTimeoutManager.js";
import { DisconnectionCleanupManager } from "./lifecycle/DisconnectionCleanupManager.js";
import { MessagePipelineManager } from "./message/MessagePipelineManager.js";

/**
 * WebSocket connection handler
 * Manages client connections and delegates to domain services
 */
export class ConnectionHandler {
  private container: Container;
  private wss: WebSocketServer;
  private authHandler: AuthenticationHandler;
  private cleanupManager: DisconnectionCleanupManager;
  private heartbeatManager: HeartbeatTimeoutManager;
  private pipelineManager: MessagePipelineManager;
  private readonly defaultRoomId: string;

  constructor(container: Container, wss: WebSocketServer) {
    this.container = container;
    this.wss = wss;
    this.defaultRoomId = getDefaultRoomId();
    this.authHandler = new AuthenticationHandler(
      container,
      container.uidToWs,
      container.authenticatedUids,
      container.authenticatedSessions,
      container.getAuthenticatedClients.bind(container),
    );
    this.cleanupManager = new DisconnectionCleanupManager(
      {
        roomService: container.roomService,
        selectionService: container.selectionService,
        getAuthenticatedClients: container.getAuthenticatedClients.bind(container),
      },
      container.uidToWs,
      container.authenticatedUids,
      container.authenticatedSessions,
    );
    this.heartbeatManager = new HeartbeatTimeoutManager(container, this.cleanupManager);
    this.pipelineManager = new MessagePipelineManager(
      {
        maxMessageSize: 1024 * 1024, // 1MB
        onValidMessage: (message, uid) => this.handleValidatedMessage(message, uid),
      },
      container.rateLimiter,
    );
  }

  /**
   * Set up WebSocket server event handlers
   */
  attach(): void {
    this.wss.on("connection", (ws, req) => this.handleConnection(ws, req));

    // Start heartbeat timeout checker
    this.heartbeatManager.start();
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    // Extract player UID from connection URL
    const params = new URL(req.url || "", "http://localhost").searchParams;
    const uid = params.get("uid") || "anon";

    const state = this.container.roomService.getState();

    // Close existing connection for this UID to prevent race conditions
    const existingWs = this.container.uidToWs.get(uid);
    const wasAuthenticated = this.container.authenticatedUids.has(uid);

    if (existingWs && existingWs !== ws) {
      console.log(
        `[WebSocket] Replacing connection for ${uid} (was authenticated: ${wasAuthenticated})`,
      );
      existingWs.close(4001, "Replaced by new connection");
    }

    // Only clear authentication if this is a truly new connection (not a replacement)
    // If the old connection was authenticated, keep the auth state for seamless reconnection
    if (!wasAuthenticated) {
      this.container.authenticatedUids.delete(uid);
      this.container.authenticatedSessions.delete(uid);
      state.users = state.users.filter((u) => u !== uid);
    }

    // Register connection
    this.container.uidToWs.set(uid, ws);

    // Keepalive ping to prevent cloud provider timeout
    const keepalive = setInterval(() => {
      if (ws.readyState === 1) {
        ws.ping();
      }
    }, 25000);

    // Message handling
    ws.on("message", (buf) => this.handleMessage(Buffer.from(buf as ArrayBuffer), uid));

    // Disconnection handling
    ws.on("close", () => this.handleDisconnection(uid, keepalive, ws));
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
    // Authentication handling
    if (message.t === "authenticate") {
      this.authHandler.authenticate(uid, message.secret, message.roomId);
      return;
    }

    if (!this.container.authenticatedUids.has(uid)) {
      console.warn(`Unauthenticated message from ${uid}, dropping.`);
      return;
    }

    // DM elevation handling
    if (message.t === "elevate-to-dm") {
      this.authHandler.elevateToDM(uid, message.dmPassword);
      return;
    }

    // DM revocation handling
    if (message.t === "revoke-dm") {
      this.authHandler.revokeDM(uid);
      return;
    }

    // DM password management (DM-only action)
    if (message.t === "set-dm-password") {
      this.authHandler.setDMPassword(uid, message.dmPassword);
      return;
    }

    // Route to appropriate handler
    console.log(`[ConnectionHandler] Received message type=${message.t} from uid=${uid}`);
    this.container.messageRouter.route(message, uid);
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(uid: string, keepalive: NodeJS.Timeout, ws: WebSocket): void {
    // Clear keepalive interval
    clearInterval(keepalive);

    // Delegate cleanup to DisconnectionCleanupManager
    // Pass WebSocket for race condition check
    this.cleanupManager.cleanupPlayer(uid, { ws });
  }
}
