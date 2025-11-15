// ============================================================================
// MESSAGE PIPELINE MANAGER
// ============================================================================
// Validates incoming WebSocket messages through a multi-stage pipeline
// Single responsibility: Message validation and pre-processing

import type { ClientMessage } from "@shared";
import type { RateLimiter } from "../../middleware/rateLimit.js";
import { validateMessage } from "../../middleware/validation.js";

/**
 * Configuration for the message validation pipeline
 */
export interface MessagePipelineConfig {
  /**
   * Maximum message size in bytes
   * Default: 1MB (1024 * 1024)
   * Used to prevent DoS attacks
   */
  maxMessageSize: number;

  /**
   * Callback invoked when a message passes all validation stages
   * @param message - The validated client message
   * @param uid - The user ID associated with the message
   */
  onValidMessage: (message: ClientMessage, uid: string) => void;

  /**
   * Optional callback invoked when a message fails validation
   * @param uid - The user ID associated with the invalid message
   * @param reason - Human-readable reason for rejection
   */
  onInvalidMessage?: (uid: string, reason: string) => void;
}

/**
 * Message validation pipeline manager
 *
 * Processes incoming WebSocket messages through a multi-stage validation pipeline:
 * 1. Message size check (DoS prevention)
 * 2. JSON parsing
 * 3. Rate limiting
 * 4. Schema validation
 *
 * @example
 * ```typescript
 * const pipeline = new MessagePipelineManager(
 *   {
 *     maxMessageSize: 1024 * 1024, // 1MB
 *     onValidMessage: (message, uid) => {
 *       messageRouter.route(message, uid);
 *     },
 *     onInvalidMessage: (uid, reason) => {
 *       console.warn(`Invalid message from ${uid}: ${reason}`);
 *     }
 *   },
 *   rateLimiter
 * );
 *
 * // Process incoming message
 * const wasProcessed = pipeline.processMessage(buffer, uid);
 * ```
 */
export class MessagePipelineManager {
  private config: MessagePipelineConfig;
  private rateLimiter: RateLimiter;

  /**
   * Create a new message pipeline manager
   * @param config - Pipeline configuration including callbacks
   * @param rateLimiter - Rate limiter instance for message throttling
   */
  constructor(config: MessagePipelineConfig, rateLimiter: RateLimiter) {
    this.config = config;
    this.rateLimiter = rateLimiter;
  }

  /**
   * Process incoming message through validation pipeline
   *
   * Validation stages (in order):
   * 1. Message size check - Prevents DoS attacks
   * 2. JSON parsing - Ensures message is valid JSON
   * 3. Rate limiting - Prevents spam
   * 4. Schema validation - Ensures message matches expected format
   *
   * @param buffer - Raw message buffer from WebSocket
   * @param uid - User ID of the message sender
   * @returns true if message was processed successfully, false if rejected
   */
  processMessage(buffer: Buffer, uid: string): boolean {
    let rawMessage: unknown;
    try {
      // Stage 1: Message size check
      if (!this.checkMessageSize(buffer, uid)) {
        return false;
      }

      // Stage 2: JSON parsing
      rawMessage = this.parseJSON(buffer, uid);
      if (rawMessage === null) {
        return false;
      }

      // Stage 3: Rate limiting
      if (!this.checkRateLimit(uid)) {
        return false;
      }

      // Stage 4: Schema validation
      const message = this.validateMessage(rawMessage, uid);
      if (message === null) {
        return false;
      }

      // All validation stages passed - invoke success callback
      this.config.onValidMessage(message, uid);
      return true;
    } catch (err) {
      // Handle unexpected errors during processing
      console.error(`[MessagePipelineManager] Failed to process message from ${uid}:`, err);
      if (rawMessage !== undefined) {
        console.error(`[MessagePipelineManager] Message was:`, JSON.stringify(rawMessage));
      } else {
        console.error(`[MessagePipelineManager] Failed to parse message buffer`);
      }

      // Notify about invalid message if callback provided
      this.config.onInvalidMessage?.(uid, "Internal processing error");
      return false;
    }
  }

  /**
   * Stage 1: Check message size to prevent DoS attacks
   *
   * @param buffer - Raw message buffer
   * @param uid - User ID for logging
   * @returns true if size is within limits, false otherwise
   */
  private checkMessageSize(buffer: Buffer, uid: string): boolean {
    if (buffer.length > this.config.maxMessageSize) {
      const reason = `Message exceeds size limit: ${buffer.length} bytes (max: ${this.config.maxMessageSize})`;
      console.warn(`Message from ${uid} ${reason.toLowerCase()}`);
      this.config.onInvalidMessage?.(uid, reason);
      return false;
    }
    return true;
  }

  /**
   * Stage 2: Parse JSON from buffer
   *
   * @param buffer - Raw message buffer
   * @param uid - User ID for logging
   * @returns Parsed JSON object, or null if parsing failed
   */
  private parseJSON(buffer: Buffer, uid: string): unknown | null {
    try {
      return JSON.parse(buffer.toString());
    } catch {
      const reason = "Invalid JSON";
      console.warn(`Invalid message from ${uid}: ${reason}`);
      this.config.onInvalidMessage?.(uid, reason);
      return null;
    }
  }

  /**
   * Stage 3: Check rate limit to prevent spam
   *
   * @param uid - User ID to check rate limit for
   * @returns true if within rate limit, false if exceeded
   */
  private checkRateLimit(uid: string): boolean {
    if (!this.rateLimiter.check(uid)) {
      const reason = "Rate limit exceeded";
      console.warn(`Rate limit exceeded for client ${uid}`);
      this.config.onInvalidMessage?.(uid, reason);
      return false;
    }
    return true;
  }

  /**
   * Stage 4: Validate message schema
   *
   * @param rawMessage - Parsed JSON message
   * @param uid - User ID for logging
   * @returns Validated ClientMessage, or null if validation failed
   */
  private validateMessage(rawMessage: unknown, uid: string): ClientMessage | null {
    const validation = validateMessage(rawMessage);
    if (!validation.valid) {
      const reason = validation.error || "Unknown validation error";
      console.warn(`Invalid message from ${uid}: ${reason}`);
      this.config.onInvalidMessage?.(uid, reason);
      return null;
    }

    // At this point, message is validated as ClientMessage
    return rawMessage as ClientMessage;
  }
}
