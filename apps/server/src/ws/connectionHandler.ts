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
import { getDefaultRoomId } from "../config/auth.js";

/**
 * WebSocket connection handler
 * Manages client connections and delegates to domain services
 */
export class ConnectionHandler {
  private container: Container;
  private wss: WebSocketServer;
  private timeoutCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_TIMEOUT = 5 * 60 * 1000; // 5 minutes without heartbeat before timeout
  private readonly defaultRoomId: string;

  constructor(container: Container, wss: WebSocketServer) {
    this.container = container;
    this.wss = wss;
    this.defaultRoomId = getDefaultRoomId();
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
        const socket = this.container.uidToWs.get(uid);
        if (socket && socket.readyState === 1) {
          socket.close(4000, "Heartbeat timeout");
        }
        // Remove player
        state.players = state.players.filter((p) => p.uid !== uid);
        // Remove their token
        state.tokens = state.tokens.filter((t) => t.owner !== uid);
        // Remove from users list
        state.users = state.users.filter((u) => u !== uid);
        // Clean up WebSocket connection map
        this.container.uidToWs.delete(uid);
        this.container.authenticatedUids.delete(uid);
        this.container.authenticatedSessions.delete(uid);
        this.container.selectionService.deselect(state, uid);
      }

      // Broadcast updated state
      this.container.roomService.broadcast(this.container.getAuthenticatedClients());
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

    // Close existing connection for this UID to prevent race conditions
    const existingWs = this.container.uidToWs.get(uid);
    if (existingWs && existingWs !== ws) {
      console.log(`[WebSocket] Closing stale connection for ${uid}`);
      existingWs.close(4001, "Replaced by new connection");
    }

    // Reset any previous authentication state for this UID
    this.container.authenticatedUids.delete(uid);
    this.container.authenticatedSessions.delete(uid);
    state.users = state.users.filter((u) => u !== uid);

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
    ws.on("close", () => this.handleDisconnection(uid, keepalive));
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(buf: Buffer, uid: string): void {
    let rawMessage: unknown;
    try {
      // Message size limit check (1MB) to prevent DoS attacks
      const MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB
      if (buf.length > MAX_MESSAGE_SIZE) {
        console.warn(
          `Message from ${uid} exceeds size limit: ${buf.length} bytes (max: ${MAX_MESSAGE_SIZE})`,
        );
        return;
      }

      // Parse message
      rawMessage = JSON.parse(buf.toString());

      // Rate limiting
      if (!this.container.rateLimiter.check(uid)) {
        console.warn(`Rate limit exceeded for client ${uid}`);
        return;
      }

      // Input validation
      const validation = validateMessage(rawMessage);
      if (!validation.valid) {
        console.warn(`Invalid message from ${uid}: ${validation.error}`);
        return;
      }

      // At this point, message is validated as ClientMessage
      const message = rawMessage as ClientMessage;

      // Authentication handling
      if (message.t === "authenticate") {
        this.handleAuthentication(uid, message.secret, message.roomId);
        return;
      }

      if (!this.container.authenticatedUids.has(uid)) {
        console.warn(`Unauthenticated message from ${uid}, dropping.`);
        return;
      }

      // DM elevation handling
      if (message.t === "elevate-to-dm") {
        this.handleDMElevation(uid, message.dmPassword);
        return;
      }

      // DM revocation handling
      if (message.t === "revoke-dm") {
        this.handleDMRevocation(uid);
        return;
      }

      // DM password management (DM-only action)
      if (message.t === "set-dm-password") {
        this.handleSetDMPassword(uid, message.dmPassword);
        return;
      }

      // Route to appropriate handler
      console.log(`[ConnectionHandler] Received message type=${message.t} from uid=${uid}`);
      this.container.messageRouter.route(message, uid);
    } catch (err) {
      console.error(`[ConnectionHandler] Failed to process message from ${uid}:`, err);
      if (rawMessage !== undefined) {
        console.error(`[ConnectionHandler] Message was:`, JSON.stringify(rawMessage));
      } else {
        console.error(`[ConnectionHandler] Failed to parse message buffer`);
      }
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
    state.users = state.users.filter((u) => u !== uid);
    this.container.authenticatedUids.delete(uid);
    this.container.authenticatedSessions.delete(uid);
    this.container.uidToWs.delete(uid);
    this.container.selectionService.deselect(state, uid);

    // Broadcast updated state
    this.container.roomService.broadcast(this.container.getAuthenticatedClients());
  }

  /**
   * Authenticate a client connection using the shared room secret
   */
  private handleAuthentication(uid: string, secret: string, roomId?: string): void {
    const ws = this.container.uidToWs.get(uid);
    if (!ws) {
      return;
    }

    if (this.container.authenticatedUids.has(uid)) {
      ws.send(JSON.stringify({ t: "auth-ok" }));
      return;
    }

    const requestedRoomId = roomId?.trim() || this.defaultRoomId;
    if (requestedRoomId !== this.defaultRoomId) {
      this.rejectAuthentication(ws, "Unknown room");
      return;
    }

    const normalizedSecret = secret.trim();
    if (!this.container.authService.verify(normalizedSecret)) {
      console.warn(`Authentication failed for uid ${uid}`);
      this.rejectAuthentication(ws, "Invalid room password");
      return;
    }

    const state = this.container.roomService.getState();

    // Create or reconnect player entities
    let player = this.container.playerService.findPlayer(state, uid);
    if (!player) {
      player = this.container.playerService.createPlayer(state, uid);
    }

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

      // Create token for the character
      const spawn = this.container.roomService.getPlayerSpawnPosition();
      const token = this.container.tokenService.createToken(state, uid, spawn.x, spawn.y);
      this.container.characterService.linkToken(state, character.id, token.id);
    } else {
      // Player reconnecting - ensure they have a token
      const existingToken = this.container.tokenService.findTokenByOwner(state, uid);
      if (!existingToken) {
        const spawn = this.container.roomService.getPlayerSpawnPosition();
        const token = this.container.tokenService.createToken(state, uid, spawn.x, spawn.y);
        this.container.characterService.linkToken(state, existingCharacter.id, token.id);
      }
    }

    // Track authentication state
    this.container.authenticatedUids.add(uid);
    this.container.authenticatedSessions.set(uid, {
      roomId: requestedRoomId,
      authedAt: Date.now(),
    });

    // Register user for session lists
    state.users = state.users.filter((u) => u !== uid);
    state.users.push(uid);

    ws.send(JSON.stringify({ t: "auth-ok" }));
    console.log(`Client authenticated: ${uid}`);

    // Broadcast updated room state to authenticated clients
    this.container.roomService.broadcast(this.container.getAuthenticatedClients());
  }

  private rejectAuthentication(ws: WebSocket, reason: string): void {
    ws.send(JSON.stringify({ t: "auth-failed", reason }));
    setTimeout(() => {
      if (ws.readyState === 1) {
        ws.close(4001, reason);
      }
    }, 100);
  }

  /**
   * Handle DM elevation request
   */
  private handleDMElevation(uid: string, dmPassword: string): void {
    const ws = this.container.uidToWs.get(uid);
    if (!ws) {
      return;
    }

    const state = this.container.roomService.getState();
    const player = this.container.playerService.findPlayer(state, uid);

    if (!player) {
      ws.send(JSON.stringify({ t: "dm-elevation-failed", reason: "Player not found" }));
      return;
    }

    // Check if DM password is even set
    if (!this.container.authService.hasDMPassword()) {
      ws.send(
        JSON.stringify({
          t: "dm-elevation-failed",
          reason: "No DM password configured. Use set-dm-password to create one.",
        }),
      );
      return;
    }

    // Verify DM password
    const normalizedPassword = dmPassword.trim();
    if (!this.container.authService.verifyDMPassword(normalizedPassword)) {
      console.warn(`DM elevation failed for uid ${uid}: Invalid password`);
      ws.send(JSON.stringify({ t: "dm-elevation-failed", reason: "Invalid DM password" }));
      return;
    }

    // Grant DM powers
    player.isDM = true;
    ws.send(JSON.stringify({ t: "dm-status", isDM: true }));
    console.log(`DM elevation granted to ${uid}`);

    // Broadcast updated state
    this.container.roomService.broadcast(this.container.getAuthenticatedClients());
  }

  /**
   * Handle DM revocation request
   */
  private handleDMRevocation(uid: string): void {
    const ws = this.container.uidToWs.get(uid);
    if (!ws) {
      return;
    }

    const state = this.container.roomService.getState();
    const player = this.container.playerService.findPlayer(state, uid);

    if (!player) {
      console.warn(`DM revocation failed: player ${uid} not found`);
      return;
    }

    if (!player.isDM) {
      console.warn(`DM revocation ignored: player ${uid} is not DM`);
      return;
    }

    // Revoke DM status
    player.isDM = false;
    ws.send(JSON.stringify({ t: "dm-status", isDM: false }));
    console.log(`DM status revoked for ${uid}`);

    // Broadcast updated state
    this.container.roomService.broadcast(this.container.getAuthenticatedClients());
  }

  /**
   * Handle DM password set/update request (DM-only action)
   */
  private handleSetDMPassword(uid: string, dmPassword: string): void {
    const ws = this.container.uidToWs.get(uid);
    if (!ws) {
      return;
    }

    const state = this.container.roomService.getState();
    const player = this.container.playerService.findPlayer(state, uid);

    if (!player) {
      ws.send(JSON.stringify({ t: "dm-password-update-failed", reason: "Player not found" }));
      return;
    }

    // Only current DM can set/update DM password
    // OR if no DM password exists yet, anyone can set it (bootstrap case)
    const hasDMPassword = this.container.authService.hasDMPassword();
    if (hasDMPassword && !player.isDM) {
      ws.send(
        JSON.stringify({
          t: "dm-password-update-failed",
          reason: "Only DM can update DM password",
        }),
      );
      return;
    }

    // Update DM password
    try {
      const summary = this.container.authService.updateDMPassword(dmPassword);
      ws.send(JSON.stringify({ t: "dm-password-updated", updatedAt: summary.updatedAt }));
      console.log(`DM password updated by ${uid}`);

      // If this is first-time setup and player doesn't have DM status yet, grant it
      if (!hasDMPassword && !player.isDM) {
        player.isDM = true;
        ws.send(JSON.stringify({ t: "dm-status", isDM: true }));
        console.log(`DM status granted to ${uid} (first-time DM password setup)`);
        this.container.roomService.broadcast(this.container.getAuthenticatedClients());
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      ws.send(JSON.stringify({ t: "dm-password-update-failed", reason: errorMessage }));
    }
  }
}
