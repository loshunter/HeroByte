import type { ClientMessage } from "@shared";
import { MessageLogger } from "./MessageLogger.js";

/**
 * Message Error Handler Service
 *
 * Centralized error handling logic for WebSocket message routing.
 * Extracted from MessageRouter.ts (lines 819-825) to follow Single Responsibility Principle.
 *
 * Responsibilities:
 * - Log routing errors with structured format
 * - Preserve error context (message type, sender, details)
 * - Provide graceful error handling (no rethrow)
 *
 * @see apps/server/src/ws/__tests__/characterization/error-handling.characterization.test.ts
 */
export class MessageErrorHandler {
  private messageLogger: MessageLogger;

  constructor(messageLogger: MessageLogger) {
    this.messageLogger = messageLogger;
  }
  /**
   * Handle and log an error that occurred during message routing
   *
   * @param error - The error that was thrown
   * @param message - The client message that caused the error
   * @param senderUid - UID of the player who sent the message
   *
   * @remarks
   * Error logging format (matching original implementation):
   * 1. First log: Error with message type and sender UID
   * 2. Second log: Full message details as JSON string
   *
   * Behavior:
   * - Does NOT rethrow errors (graceful degradation)
   * - Preserves error stack traces
   * - Handles non-Error throws (e.g., string errors)
   * - Logs full message content for debugging
   *
   * Original implementation: apps/server/src/ws/messageRouter.ts:819-825
   */
  handleError(error: unknown, message: ClientMessage, senderUid: string): void {
    // Log error with message type and sender (delegated to MessageLogger)
    this.messageLogger.logRoutingError(message.t, senderUid, error);

    // Log full message details as JSON (delegated to MessageLogger)
    this.messageLogger.logMessageDetails(message);

    // NOTE: Does not rethrow - allows router to continue processing future messages
  }
}
