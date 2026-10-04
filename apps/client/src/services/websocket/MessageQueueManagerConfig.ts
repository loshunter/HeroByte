import type { ClientMessage } from "@herobyte/shared";

/**
 * Configuration for MessageQueueManager
 */
export interface MessageQueueManagerConfig {
  /**
   * Maximum number of messages to queue before dropping oldest
   * Default: 200
   */
  maxQueueSize?: number;
  /**
   * Optional hook invoked when the queue overflows and a message is dropped
   */
  onQueueOverflow?: (message: ClientMessage, queueLength: number) => void;

  /**
   * Maximum number of resend attempts before giving up (default: 3)
   */
  maxRetries?: number;

  /**
   * Base delay in milliseconds for retry backoff (default: 500ms)
   */
  retryBackoffMs?: number;

  /**
   * Callback invoked when a retry should be dispatched
   */
  /** Called before each physical socket write, including buffered flushes. */
  onBeforeSend?: (message: ClientMessage) => void;
  onRetryDispatch?: (message: ClientMessage) => void;

  /**
   * Callback invoked when a command exceeds retry attempts
   */
  onRetryExhausted?: (message: ClientMessage) => void;
}
