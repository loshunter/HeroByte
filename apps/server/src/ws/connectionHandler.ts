// ============================================================================
// WEBSOCKET CONNECTION HANDLER
// ============================================================================
// Handles WebSocket connection lifecycle: connect, message, disconnect
// Single responsibility: WebSocket event handling

import type { WebSocket, WebSocketServer } from "ws";
import type { IncomingMessage } from "http";
import type { ClientMessage } from "@shared";
import type { Container } from "../container.js";
import { validateMessage } from "../middleware/validation.js";

/**
 * WebSocket connection handler
 * Manages client connections and delegates to domain services
 */
export class ConnectionHandler {
  private container: Container;
  private wss: WebSocketServer;

  constructor(container: Container, wss: WebSocketServer) {
    this.container = container;
    this.wss = wss;
  }

  /**
   * Set up WebSocket server event handlers
   */
  attach(): void {
    this.wss.on("connection", (ws, req) => this.handleConnection(ws, req));
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    // Extract player UID from connection URL
    const params = new URL(req.url || "", "http://localhost").searchParams;
    const uid = params.get("uid") || "anon";

    const state = this.container.roomService.getState();

    // Register connection (remove from users list first to prevent duplicates)
    state.users = state.users.filter((u) => u !== uid);
    state.users.push(uid);
    this.container.uidToWs.set(uid, ws);

    // Keepalive ping to prevent cloud provider timeout
    const keepalive = setInterval(() => {
      if (ws.readyState === 1) {
        ws.ping();
      }
    }, 25000);

    // Check if this is a reconnecting player
    const existingPlayer = this.container.playerService.findPlayer(state, uid);
    const existingToken = this.container.tokenService.findTokenByOwner(state, uid);

    // Create new player if first time connecting
    if (!existingPlayer) {
      this.container.playerService.createPlayer(state, uid);
    }

    // Create initial token if player doesn't have one
    if (!existingToken) {
      this.container.tokenService.createToken(state, uid, 0, 0);
    } else {
      console.log("Player reconnected:", uid);
    }

    // Send initial room state to new connection
    this.container.roomService.broadcast(this.wss.clients);

    // Message handling
    ws.on("message", (buf) => this.handleMessage(Buffer.from(buf as ArrayBuffer), uid));

    // Disconnection handling
    ws.on("close", () => this.handleDisconnection(uid, keepalive));
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(buf: Buffer, uid: string): void {
    try {
      // Parse message
      const message: ClientMessage = JSON.parse(buf.toString());

      // Rate limiting
      if (!this.container.rateLimiter.check(uid)) {
        console.warn(`Rate limit exceeded for client ${uid}`);
        return;
      }

      // Input validation
      const validation = validateMessage(message);
      if (!validation.valid) {
        console.warn(`Invalid message from ${uid}: ${validation.error}`);
        return;
      }

      // Route to appropriate handler
      this.container.messageRouter.route(message, uid);
    } catch (err) {
      console.error(`Failed to process message from ${uid}:`, err);
    }
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(uid: string, keepalive: NodeJS.Timeout): void {
    // Clear keepalive interval
    clearInterval(keepalive);

    const state = this.container.roomService.getState();

    // Clean up disconnected player's connection
    // (but keep player and token data for reconnection)
    state.users = state.users.filter((u) => u !== uid);
    this.container.uidToWs.delete(uid);

    // Broadcast updated state
    this.container.roomService.broadcast(this.wss.clients);
  }
}
