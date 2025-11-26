// ============================================================================
// AUTHENTICATION HANDLER
// ============================================================================
// Handles WebSocket authentication, DM elevation, and password management
// Single responsibility: Authentication flow management

import type { WebSocket } from "ws";
import type { Player } from "@shared";
import type { Container } from "../../container.js";
import { getDefaultRoomId } from "../../config/auth.js";

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
  private getAuthenticatedClients: () => Set<WebSocket>;
  private readonly defaultRoomId: string;

  constructor(
    container: Container,
    uidToWs: Map<string, WebSocket>,
    authenticatedUids: Set<string>,
    authenticatedSessions: Map<string, { roomId: string; authedAt: number }>,
    getAuthenticatedClients: () => Set<WebSocket>,
  ) {
    this.container = container;
    this.uidToWs = uidToWs;
    this.authenticatedUids = authenticatedUids;
    this.authenticatedSessions = authenticatedSessions;
    this.getAuthenticatedClients = getAuthenticatedClients;
    this.defaultRoomId = getDefaultRoomId();
  }

  /**
   * Authenticate a client connection using the shared room secret
   *
   * @param uid - Unique identifier for the client
   * @param secret - Room password provided by the client
   * @param roomId - Optional room identifier (defaults to default room)
   */
  authenticate(uid: string, secret: string, roomId?: string): void {
    const ws = this.uidToWs.get(uid);
    if (!ws) {
      return;
    }

    const state = this.container.roomService.getState();
    let player = this.container.playerService.findPlayer(state, uid);
    const now = Date.now();

    // Handle re-authentication (client already authenticated)
    if (this.authenticatedUids.has(uid)) {
      if (player) {
        this.touchPlayerHeartbeat(player, now);
      }

      this.refreshAuthenticatedSession(uid, now);
      this.sendAuthOk(ws);
      return;
    }

    // Validate room ID
    const requestedRoomId = roomId?.trim() || this.defaultRoomId;
    if (requestedRoomId !== this.defaultRoomId) {
      this.rejectAuthentication(ws, "Unknown room");
      return;
    }

    // Verify room password
    const normalizedSecret = secret.trim();
    if (!this.container.authService.verify(normalizedSecret)) {
      console.warn(`Authentication failed for uid ${uid}`);
      this.rejectAuthentication(ws, "Invalid room password");
      return;
    }

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
        const spawn = this.container.roomService.getPlayerSpawnPosition();
        const token = this.container.tokenService.createToken(state, uid, spawn.x, spawn.y);
        this.container.characterService.linkToken(state, character.id, token.id);
      }
    } else {
      // Player reconnecting - ensure they have a token (ONLY if not a DM)
      // DM players should never have tokens on the map
      if (!player.isDM) {
        const existingToken = this.container.tokenService.findTokenByOwner(state, uid);
        if (!existingToken) {
          const spawn = this.container.roomService.getPlayerSpawnPosition();
          const token = this.container.tokenService.createToken(state, uid, spawn.x, spawn.y);
          this.container.characterService.linkToken(state, existingCharacter.id, token.id);
        }
      }
    }

    // Track authentication state
    this.authenticatedUids.add(uid);
    this.refreshAuthenticatedSession(uid, now, requestedRoomId);

    // Register user for session lists
    state.users = state.users.filter((u) => u !== uid);
    state.users.push(uid);

    this.sendAuthOk(ws);
    console.log(`Client authenticated: ${uid}`);

    // Broadcast updated room state to authenticated clients
    this.container.roomService.broadcast(this.getAuthenticatedClients(), undefined, {
      reason: "auth-success",
    });
  }

  /**
   * Elevate a client to DM (Dungeon Master) role
   *
   * @param uid - Unique identifier for the client
   * @param dmPassword - DM password provided by the client
   */
  elevateToDM(uid: string, dmPassword: string): void {
    const ws = this.uidToWs.get(uid);
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
    this.container.roomService.broadcast(this.getAuthenticatedClients(), undefined, {
      reason: "dm-elevated",
    });
  }

  /**
   * Revoke DM (Dungeon Master) status from a client
   *
   * @param uid - Unique identifier for the client
   */
  revokeDM(uid: string): void {
    const ws = this.uidToWs.get(uid);
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
    this.container.roomService.broadcast(this.getAuthenticatedClients(), undefined, {
      reason: "dm-revoked",
    });
  }

  /**
   * Set or update the DM password (DM-only action, or anyone if no DM password exists)
   *
   * @param uid - Unique identifier for the client
   * @param dmPassword - New DM password to set
   */
  setDMPassword(uid: string, dmPassword: string): void {
    const ws = this.uidToWs.get(uid);
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
        this.container.roomService.broadcast(this.getAuthenticatedClients(), undefined, {
          reason: "dm-bootstrapped",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      ws.send(JSON.stringify({ t: "dm-password-update-failed", reason: errorMessage }));
    }
  }

  /**
   * Reject authentication attempt and close connection
   *
   * @param ws - WebSocket connection to reject
   * @param reason - Human-readable rejection reason
   */
  private rejectAuthentication(ws: WebSocket, reason: string): void {
    ws.send(JSON.stringify({ t: "auth-failed", reason }));
    setTimeout(() => {
      if (ws.readyState === 1) {
        ws.close(4001, reason);
      }
    }, 100);
  }

  /**
   * Update player's last heartbeat timestamp
   *
   * @param player - Player entity to update
   * @param timestamp - Current timestamp
   */
  private touchPlayerHeartbeat(player: Player, timestamp: number): void {
    player.lastHeartbeat = timestamp;
  }

  /**
   * Refresh or create authenticated session record
   *
   * @param uid - Unique identifier for the client
   * @param authedAt - Timestamp of authentication
   * @param roomId - Optional room identifier (preserves existing if not provided)
   */
  private refreshAuthenticatedSession(uid: string, authedAt: number, roomId?: string): void {
    const existingSession = this.authenticatedSessions.get(uid);
    const effectiveRoomId = roomId ?? existingSession?.roomId ?? this.defaultRoomId;

    this.authenticatedSessions.set(uid, {
      roomId: effectiveRoomId,
      authedAt,
    });
  }

  /**
   * Send authentication success message to client
   *
   * @param ws - WebSocket connection to send to
   */
  private sendAuthOk(ws: WebSocket): void {
    ws.send(JSON.stringify({ t: "auth-ok" }));
  }
}
