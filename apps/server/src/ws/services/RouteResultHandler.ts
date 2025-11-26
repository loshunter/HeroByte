// ============================================================================
// ROUTE RESULT HANDLER
// ============================================================================
// Handles the results of message handler execution
// Extracted from: apps/server/src/ws/messageRouter.ts

/**
 * Service responsible for processing message handler execution results.
 *
 * This service takes the result object returned by message handlers and performs
 * the appropriate follow-up actions based on the flags in the result. It centralizes
 * the repeated pattern of checking `result.broadcast` and `result.save` that appears
 * ~60 times throughout the messageRouter.
 *
 * **Responsibilities:**
 * - Check if broadcast is needed
 * - Check if state save is needed
 * - Execute the appropriate callback actions
 *
 * **Single Responsibility Principle (SRP):**
 * This service has ONE clear responsibility: process handler results and trigger appropriate actions.
 * It does NOT handle message routing, authorization, error handling, or the actual broadcast/save logic.
 *
 * **Separation of Concerns (SoC):**
 * - Result processing is separated from message routing
 * - Action execution (broadcast/save) is delegated via callbacks
 * - Handler logic is separated from result handling logic
 *
 * **Pattern Replaced:**
 * Before:
 * ```typescript
 * const result = handler.handleX(...);
 * if (result.broadcast) this.broadcast();
 * if (result.save) this.roomService.saveState();
 * ```
 *
 * After:
 * ```typescript
 * const result = handler.handleX(...);
 * this.routeResultHandler.handleResult(result);
 * ```
 *
 * @example
 * ```typescript
 * const resultHandler = new RouteResultHandler(
 *   () => broadcast(), // Broadcast callback
 *   () => saveState()  // Save callback
 * );
 *
 * // Handle a result that needs both broadcast and save
 * const result = { broadcast: true, save: true };
 * resultHandler.handleResult(result);
 * ```
 */
import type { PendingDelta } from "../types.js";

export interface RouteHandlerResult {
  broadcast?: unknown;
  save?: unknown;
  reason?: string;
  delta?: PendingDelta;
  skipBroadcast?: boolean;
}

export class RouteResultHandler {
  private broadcastCallback: (reason?: string) => void;
  private saveCallback: () => void;

  /**
   * Create a new RouteResultHandler
   *
   * @param broadcastCallback - Function to call when broadcast is needed
   * @param saveCallback - Function to call when state save is needed
   *
   * @example
   * ```typescript
   * const handler = new RouteResultHandler(
   *   () => this.broadcast(),
   *   () => this.roomService.saveState()
   * );
   * ```
   */
  constructor(broadcastCallback: (reason?: string) => void, saveCallback: () => void) {
    this.broadcastCallback = broadcastCallback;
    this.saveCallback = saveCallback;
  }

  /**
   * Process a message handler result and execute appropriate actions.
   *
   * Checks the result object for `broadcast` and `save` flags and executes
   * the corresponding callback functions if the flags are truthy.
   *
   * **Behavior:**
   * - If `result.broadcast` is truthy → Execute broadcast callback
   * - If `result.save` is truthy → Execute save callback
   * - If both flags are truthy → Execute broadcast first, then save
   * - If neither flag is truthy → No action taken
   *
   * **Truthy/Falsy Handling:**
   * - Truthy values (true, 1, "yes", {}, etc.) trigger the action
   * - Falsy values (false, 0, "", null, undefined) do not trigger the action
   *
   * @param result - The result object returned by a message handler
   *
   * @example
   * ```typescript
   * // Broadcast only
   * handler.handleResult({ broadcast: true, save: false });
   *
   * // Save only
   * handler.handleResult({ broadcast: false, save: true });
   *
   * // Both actions
   * handler.handleResult({ broadcast: true, save: true });
   *
   * // No actions
   * handler.handleResult({ broadcast: false, save: false });
   * ```
   */
  handleResult(result?: RouteHandlerResult | null): void {
    if (!result) {
      return;
    }

    // Execute broadcast if needed (truthy check handles all truthy values)
    if (result.broadcast && !result.skipBroadcast) {
      this.broadcastCallback(result.reason);
    }

    // Execute save if needed (truthy check handles all truthy values)
    if (result.save) {
      this.saveCallback();
    }
  }
}
