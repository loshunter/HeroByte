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
  private timeoutCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_TIMEOUT = 60000; // 60 seconds without heartbeat = timeout

  constructor(container: Container, wss: WebSocketServer) {
    this.container = container;
    this.wss = wss;
  }

  /**
   * Set up WebSocket server event handlers
   */
  attach(): void {
    this.wss.on("connection", (ws, req) => this.handleConnection(ws, req));

    // Start heartbeat timeout checker
    this.startTimeoutChecker();
  }

  /**
   * Start periodic check for timed-out players
   */
  private startTimeoutChecker(): void {
    // Check every 30 seconds for timed-out players
    this.timeoutCheckInterval = setInterval(() => {
      this.checkForTimedOutPlayers();
    }, 30000);
  }

  /**
   * Check for and remove players that haven't sent heartbeat
   */
  private checkForTimedOutPlayers(): void {
    const state = this.container.roomService.getState();
    const now = Date.now();
    const timedOutPlayers: string[] = [];

    // Find players who haven't sent heartbeat in timeout window
    for (const player of state.players) {
      const lastHeartbeat = player.lastHeartbeat || 0;
      if (now - lastHeartbeat > this.HEARTBEAT_TIMEOUT) {
        timedOutPlayers.push(player.uid);
      }
    }

    // Remove timed out players and their tokens
    if (timedOutPlayers.length > 0) {
      console.log(`Removing ${timedOutPlayers.length} timed-out players:`, timedOutPlayers);

      for (const uid of timedOutPlayers) {
        // Remove player
        state.players = state.players.filter((p) => p.uid !== uid);
        // Remove their token
        state.tokens = state.tokens.filter((t) => t.owner !== uid);
        // Remove from users list
        state.users = state.users.filter((u) => u !== uid);
        // Clean up WebSocket connection map
        this.container.uidToWs.delete(uid);
      }

      // Broadcast updated state
      this.container.roomService.broadcast(this.wss.clients);
    }
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
