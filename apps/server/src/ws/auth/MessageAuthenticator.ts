// ============================================================================
// MESSAGE AUTHENTICATOR
// ============================================================================
// Handles authentication routing for WebSocket messages
// Single responsibility: Determine if message requires authentication and route auth messages
//
// Extracted from ConnectionHandler.handleValidatedMessage() (lines 130-163)

import type { WebSocket } from "ws";
import type { ClientMessage } from "@herobyte/shared";
import type { AuthenticationHandler } from "./AuthenticationHandler.js";

/**
 * Configuration for MessageAuthenticator
 */
export interface MessageAuthenticatorConfig {
  /**
   * Authentication handler for processing auth-related messages
   */
  authHandler: AuthenticationHandler;

  /**
   * Optional callback invoked when an auth message is received
   * @param uid - Client unique identifier
   * @param message - The authentication message
   */
  onAuthMessage?: (uid: string, message: ClientMessage) => void;

  /**
   * Optional callback invoked when an unauthenticated message is received
   * @param uid - Client unique identifier
   */
  onUnauthenticatedMessage?: (uid: string) => void;
}

/**
 * MessageAuthenticator handles authentication routing logic
 *
 * This class determines whether incoming messages require authentication and
 * routes authentication-related messages to the appropriate AuthenticationHandler
 * methods.
 *
 * Authentication Flow:
 * 1. "authenticate" messages are always allowed and routed to AuthenticationHandler
 * 2. All other messages require the client to be authenticated — where "the
 *    client" is a SOCKET, not a uid: the uid's auth flag counts only for the
 *    socket registered as its connection (see isAuthenticated)
 * 3. Once authenticated, DM-related messages ("elevate-to-dm", "revoke-dm",
 *    "set-dm-password") are routed to AuthenticationHandler
 * 4. All other authenticated messages are passed through to the MessageRouter
 *
 * @example
 * ```typescript
 * const authenticator = new MessageAuthenticator(
 *   {
 *     authHandler: authHandler,
 *     onAuthMessage: (uid, message) => console.log(`Auth message from ${uid}`),
 *     onUnauthenticatedMessage: (uid) => console.warn(`Unauthenticated: ${uid}`)
 *   },
 *   authenticatedUids,
 *   uidToWs
 * );
 *
 * // Returns true if message was handled (auth message or dropped)
 * // Returns false if message should be routed to MessageRouter
 * const shouldRoute = !authenticator.checkAuthentication(message, uid, ws);
 * if (shouldRoute) {
 *   messageRouter.route(message, uid);
 * }
 * ```
 */
export class MessageAuthenticator {
  private config: MessageAuthenticatorConfig;
  private authenticatedUids: Set<string>;
  private uidToWs: Map<string, WebSocket>;

  /**
   * Create a new MessageAuthenticator
   *
   * @param config - Configuration including AuthenticationHandler and optional callbacks
   * @param authenticatedUids - Set of authenticated client UIDs (shared reference)
   * @param uidToWs - The uid → registered socket map (shared reference)
   */
  constructor(
    config: MessageAuthenticatorConfig,
    authenticatedUids: Set<string>,
    uidToWs: Map<string, WebSocket>,
  ) {
    this.config = config;
    this.authenticatedUids = authenticatedUids;
    this.uidToWs = uidToWs;
  }

  /**
   * Check if message requires authentication and route auth messages
   *
   * Authentication Logic:
   * - "authenticate" messages: Always allowed, routed to AuthenticationHandler
   * - Unauthenticated sockets: All non-auth messages are dropped
   * - Authenticated sockets:
   *   - DM-related messages: Routed to AuthenticationHandler
   *   - Other messages: Passed through to MessageRouter (return false)
   *
   * @param message - The validated client message
   * @param uid - Client unique identifier
   * @param ws - The socket the message arrived on
   * @returns true if message was handled (auth message or dropped), false if should route to MessageRouter
   */
  checkAuthentication(message: ClientMessage, uid: string, ws: WebSocket): boolean {
    // Handle authentication message (always allowed)
    if (this.isAuthMessage(message)) {
      this.routeAuthMessage(message, uid, ws);
      return true;
    }

    // Minting a private table happens BEFORE auth (you can't be in a room that
    // doesn't exist yet), so create-room is allowed pre-authentication.
    if (message.t === "create-room") {
      // Async (password hashing off the event loop); replies go over the
      // socket, so the dispatch itself stays fire-and-forget. Promise.resolve
      // wrapping keeps sync test doubles (returning void) safe to supervise.
      void Promise.resolve(this.config.authHandler.createRoom(uid, message, ws)).catch((error) =>
        console.error(`[Auth] create-room failed for ${uid}:`, error),
      );
      this.config.onAuthMessage?.(uid, message);
      return true;
    }

    // Check if THIS SOCKET is authenticated
    if (!this.isAuthenticated(uid, ws)) {
      console.warn(`Unauthenticated message from ${uid}, dropping.`);
      this.config.onUnauthenticatedMessage?.(uid);
      return true; // Message handled (dropped)
    }

    // Route DM-related messages to AuthenticationHandler
    if (message.t === "elevate-to-dm") {
      void Promise.resolve(this.config.authHandler.elevateToDM(uid, message.dmPassword)).catch(
        (error) => console.error(`[Auth] elevate-to-dm failed for ${uid}:`, error),
      );
      this.config.onAuthMessage?.(uid, message);
      return true;
    }

    if (message.t === "revoke-dm") {
      this.config.authHandler.revokeDM(uid);
      this.config.onAuthMessage?.(uid, message);
      return true;
    }

    // Post-auth, unlike create-room: forking copies the table the sender is
    // already in, so it needs them to actually be in it.
    if (message.t === "fork-table") {
      void Promise.resolve(this.config.authHandler.forkTable(uid, message)).catch((error) =>
        console.error(`[Auth] fork-table failed for ${uid}:`, error),
      );
      this.config.onAuthMessage?.(uid, message);
      return true;
    }

    if (message.t === "set-dm-password") {
      this.config.authHandler.setDMPassword(uid, message.dmPassword);
      this.config.onAuthMessage?.(uid, message);
      return true;
    }

    // Message should be routed to MessageRouter
    return false;
  }

  /**
   * Check if message is an authentication message
   *
   * @param message - Client message to check
   * @returns true if message is "authenticate"
   */
  private isAuthMessage(message: ClientMessage): boolean {
    return message.t === "authenticate";
  }

  /**
   * Route authentication message to AuthenticationHandler
   *
   * @param message - Authentication message (must have t === "authenticate")
   * @param uid - Client unique identifier
   * @param ws - The socket to reply on (it may not be the uid's registered one)
   */
  private routeAuthMessage(message: ClientMessage, uid: string, ws: WebSocket): void {
    if (message.t === "authenticate") {
      // Async (scrypt off the event loop). The handler replies auth-ok /
      // auth-failed over the socket itself, so nothing here needs the result.
      void Promise.resolve(this.config.authHandler.authenticate(uid, message, ws)).catch((error) =>
        console.error(`[Auth] authenticate failed for ${uid}:`, error),
      );
      this.config.onAuthMessage?.(uid, message);
    }
  }

  /**
   * Is this socket the uid's authenticated connection?
   *
   * The session belongs to ONE socket. A second socket claiming the uid — held
   * at connect because the session is live elsewhere — has the uid's auth flag
   * in its favour but is not the registered connection, and acts with nothing
   * until its `authenticate` proves the session token and it is swapped in.
   * Without this check, connecting as a live DM's uid and sending a DM action
   * was enough to run it.
   *
   * @param uid - Client unique identifier
   * @param ws - The socket the message arrived on
   */
  private isAuthenticated(uid: string, ws: WebSocket): boolean {
    return this.authenticatedUids.has(uid) && this.uidToWs.get(uid) === ws;
  }
}
