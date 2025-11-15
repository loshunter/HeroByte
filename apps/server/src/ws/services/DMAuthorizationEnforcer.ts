import { MessageLogger } from "./MessageLogger.js";

/**
 * DM Authorization Enforcer Service
 *
 * RESPONSIBILITY (SRP):
 * Enforce DM-only actions by checking authorization and logging unauthorized attempts.
 *
 * This service follows the Single Responsibility Principle by handling ONE concern:
 * - Determining whether a DM-only action should proceed
 * - Logging unauthorized attempts with consistent messaging
 *
 * SEPARATION OF CONCERNS (SoC):
 * - Authorization checking: Delegates to caller's isDM function
 * - Logging: Delegated to MessageLogger service (Phase 1 Week 5)
 * - Action execution: Handled by caller after enforcement check
 *
 * USAGE:
 * ```typescript
 * const messageLogger = new MessageLogger();
 * const enforcer = new DMAuthorizationEnforcer(messageLogger);
 * const canProceed = enforcer.enforceDMAction(
 *   senderUid,
 *   isDM,
 *   "create character"
 * );
 * if (!canProceed) {
 *   break; // Exit early from switch case
 * }
 * // Proceed with DM-only action...
 * ```
 *
 * Part of Phase 15 SOLID Refactor Initiative - Phase 1 Week 4 & Week 5
 */

/**
 * DM Authorization Enforcer
 *
 * Enforces DM-only actions by checking authorization and logging unauthorized attempts.
 */
export class DMAuthorizationEnforcer {
  private messageLogger: MessageLogger;

  constructor(messageLogger: MessageLogger) {
    this.messageLogger = messageLogger;
  }
  /**
   * Enforce a DM-only action
   *
   * Checks if the sender is authorized to perform a DM-only action.
   * If not authorized, logs a warning and returns false.
   *
   * @param senderUid - The UID of the user attempting the action
   * @param isDM - Whether the sender has DM privileges
   * @param action - Human-readable description of the action being attempted
   * @returns true if action should proceed (user is DM), false otherwise
   *
   * @example
   * ```typescript
   * const canProceed = enforcer.enforceDMAction(
   *   "player-123",
   *   false,
   *   "create character"
   * );
   * // Returns: false
   * // Logs: "Non-DM player-123 attempted to create character"
   * ```
   *
   * @example
   * ```typescript
   * const canProceed = enforcer.enforceDMAction(
   *   "dm-456",
   *   true,
   *   "create character"
   * );
   * // Returns: true
   * // No log output
   * ```
   */
  enforceDMAction(senderUid: string, isDM: boolean, action: string): boolean {
    if (!isDM) {
      this.messageLogger.logUnauthorizedAction(senderUid, action);
      return false;
    }
    return true;
  }
}
