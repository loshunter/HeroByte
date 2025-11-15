// ============================================================================
// MESSAGE AUTHENTICATOR
// ============================================================================
// Handles authentication routing for WebSocket messages
// Single responsibility: Determine if message requires authentication and route auth messages
//
// Extracted from ConnectionHandler.handleValidatedMessage() (lines 130-163)

import type { ClientMessage } from "@shared";
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
 * 2. All other messages require the client to be authenticated
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
 *   authenticatedUids
 * );
 *
 * // Returns true if message was handled (auth message or dropped)
 * // Returns false if message should be routed to MessageRouter
 * const shouldRoute = !authenticator.checkAuthentication(message, uid);
 * if (shouldRoute) {
 *   messageRouter.route(message, uid);
 * }
 * ```
 */
export class MessageAuthenticator {
  private config: MessageAuthenticatorConfig;
  private authenticatedUids: Set<string>;

  /**
   * Create a new MessageAuthenticator
   *
   * @param config - Configuration including AuthenticationHandler and optional callbacks
   * @param authenticatedUids - Set of authenticated client UIDs (shared reference)
   */
  constructor(config: MessageAuthenticatorConfig, authenticatedUids: Set<string>) {
    this.config = config;
    this.authenticatedUids = authenticatedUids;
  }

  /**
   * Check if message requires authentication and route auth messages
   *
   * This method implements the authentication routing logic extracted from
   * ConnectionHandler.handleValidatedMessage().
   *
   * Authentication Logic:
   * - "authenticate" messages: Always allowed, routed to AuthenticationHandler
   * - Unauthenticated clients: All non-auth messages are dropped
   * - Authenticated clients:
   *   - DM-related messages: Routed to AuthenticationHandler
   *   - Other messages: Passed through to MessageRouter (return false)
   *
   * @param message - The validated client message
   * @param uid - Client unique identifier
   * @returns true if message was handled (auth message or dropped), false if should route to MessageRouter
   */
  checkAuthentication(message: ClientMessage, uid: string): boolean {
    // Handle authentication message (always allowed)
    if (this.isAuthMessage(message)) {
      this.routeAuthMessage(message, uid);
      return true;
    }

    // Check if client is authenticated
    if (!this.isAuthenticated(uid)) {
      console.warn(`Unauthenticated message from ${uid}, dropping.`);
      this.config.onUnauthenticatedMessage?.(uid);
      return true; // Message handled (dropped)
    }

    // Route DM-related messages to AuthenticationHandler
    if (message.t === "elevate-to-dm") {
      this.config.authHandler.elevateToDM(uid, message.dmPassword);
      this.config.onAuthMessage?.(uid, message);
      return true;
    }

    if (message.t === "revoke-dm") {
      this.config.authHandler.revokeDM(uid);
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
   */
  private routeAuthMessage(message: ClientMessage, uid: string): void {
    if (message.t === "authenticate") {
      this.config.authHandler.authenticate(uid, message.secret, message.roomId);
      this.config.onAuthMessage?.(uid, message);
    }
  }

  /**
   * Check if a client is authenticated
   *
   * @param uid - Client unique identifier
   * @returns true if client is authenticated
   */
  private isAuthenticated(uid: string): boolean {
    return this.authenticatedUids.has(uid);
  }
}
