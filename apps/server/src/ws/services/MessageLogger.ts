import type { ClientMessage } from "@shared";

/**
 * Message Logger Service
 *
 * RESPONSIBILITY (SRP):
 * Centralized logging for all WebSocket message routing operations.
 *
 * This service follows the Single Responsibility Principle by handling ONE concern:
 * - Structured logging with consistent formatting for message routing operations
 *
 * SEPARATION OF CONCERNS (SoC):
 * - Logging logic: Centralized in this service
 * - Business logic: Handled by MessageRouter and handlers
 * - Error handling: Coordinated with MessageErrorHandler
 * - Authorization enforcement: Coordinated with DMAuthorizationEnforcer
 *
 * BENEFITS:
 * - Consistent log format across all routing operations
 * - Single point of change for log formatting
 * - Easier to add structured logging, log levels, or external logging services
 * - Clear separation between logging and business logic
 *
 * USAGE:
 * ```typescript
 * const logger = new MessageLogger();
 *
 * // Log message routing
 * logger.logMessageRouting("move", "player-123");
 *
 * // Log errors
 * logger.logRoutingError("set-hp", "player-456", error);
 * logger.logMessageDetails(message);
 *
 * // Log unauthorized actions
 * logger.logUnauthorizedAction("player-789", "create character");
 * ```
 *
 * Part of Phase 15 SOLID Refactor Initiative - Phase 1 Week 5
 */

/**
 * Message Logger
 *
 * Provides centralized, structured logging for WebSocket message routing operations.
 */
export class MessageLogger {
  /**
   * Log the start of message routing
   *
   * Called when MessageRouter begins processing a message.
   * Logs message type and sender UID for debugging and tracing.
   *
   * @param messageType - The type of message being routed (e.g., "move", "create-character")
   * @param senderUid - UID of the player who sent the message
   *
   * @example
   * ```typescript
   * logger.logMessageRouting("move", "player-123");
   * // Output: [MessageRouter] Routing message type: move from player-123
   * ```
   *
   * Original location: messageRouter.ts:165
   */
  logMessageRouting(messageType: string, senderUid: string): void {
    console.log(`[MessageRouter] Routing message type: ${messageType} from ${senderUid}`);
  }

  /**
   * Log completion of broadcast and state save operations
   *
   * Called after successfully broadcasting state to all clients and saving to disk.
   * Indicates successful completion of a state-changing operation.
   *
   * @example
   * ```typescript
   * logger.logBroadcastComplete();
   * // Output: [MessageRouter] Broadcast and save complete
   * ```
   *
   * Original location: messageRouter.ts:515
   */
  logBroadcastComplete(): void {
    console.log(`[MessageRouter] Broadcast and save complete`);
  }

  /**
   * Log a warning when encountering an unknown message type
   *
   * Called when MessageRouter receives a message type it doesn't recognize.
   * Helps identify client-server protocol mismatches or invalid messages.
   *
   * @param messageType - The unknown message type received
   *
   * @example
   * ```typescript
   * logger.logUnknownMessageType("invalid-action");
   * // Output: Unknown message type: invalid-action
   * ```
   *
   * Original location: messageRouter.ts:825
   */
  logUnknownMessageType(messageType: string): void {
    console.warn("Unknown message type:", messageType);
  }

  /**
   * Log an error that occurred during message routing
   *
   * Called when an error is thrown while processing a message.
   * Logs error with context (message type, sender) for debugging.
   *
   * @param messageType - The type of message that caused the error
   * @param senderUid - UID of the player who sent the message
   * @param error - The error that was thrown
   *
   * @example
   * ```typescript
   * logger.logRoutingError("set-hp", "player-123", new Error("Invalid HP"));
   * // Output: [MessageRouter] Error routing message type=set-hp from=player-123: Error: Invalid HP
   * ```
   *
   * Original location: MessageErrorHandler.ts:39-42
   */
  logRoutingError(messageType: string, senderUid: string, error: unknown): void {
    console.error(
      `[MessageRouter] Error routing message type=${messageType} from=${senderUid}:`,
      error,
    );
  }

  /**
   * Log full message details for debugging
   *
   * Called after logging an error to provide complete message context.
   * Logs message as JSON string to preserve structure.
   *
   * @param message - The client message that caused the error
   *
   * @example
   * ```typescript
   * const message = { t: "move", id: "token-1", x: 100, y: 200 };
   * logger.logMessageDetails(message);
   * // Output: [MessageRouter] Message details: {"t":"move","id":"token-1","x":100,"y":200}
   * ```
   *
   * Original location: MessageErrorHandler.ts:45
   */
  logMessageDetails(message: ClientMessage): void {
    console.error(`[MessageRouter] Message details:`, JSON.stringify(message));
  }

  /**
   * Log a warning when a non-DM attempts a DM-only action
   *
   * Called when DMAuthorizationEnforcer blocks an unauthorized action.
   * Helps identify potential security issues or client bugs.
   *
   * @param senderUid - UID of the player who attempted the unauthorized action
   * @param action - Human-readable description of the action attempted
   *
   * @example
   * ```typescript
   * logger.logUnauthorizedAction("player-123", "create character");
   * // Output: Non-DM player-123 attempted to create character
   * ```
   *
   * Original location: DMAuthorizationEnforcer.ts:74
   */
  logUnauthorizedAction(senderUid: string, action: string): void {
    console.warn(`Non-DM ${senderUid} attempted to ${action}`);
  }
}
