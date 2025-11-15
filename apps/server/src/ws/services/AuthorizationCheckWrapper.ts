// ============================================================================
// AUTHORIZATION CHECK WRAPPER
// ============================================================================
// Wraps handler execution with DM authorization checks
// Extracted from: apps/server/src/ws/messageRouter.ts

import { DMAuthorizationEnforcer } from "./DMAuthorizationEnforcer.js";

/**
 * Service responsible for wrapping handler execution with DM authorization checks.
 *
 * This service centralizes the repeated pattern of checking DM authorization before
 * executing a handler and routing the result. It eliminates the duplication that appears
 * 9 times throughout the messageRouter (73 lines of duplicated code).
 *
 * **Responsibilities:**
 * - Check if sender is authorized as DM before executing handler
 * - Execute handler ONLY if authorized
 * - Return handler result if authorized
 * - Return undefined if not authorized
 *
 * **Single Responsibility Principle (SRP):**
 * This service has ONE clear responsibility: conditionally execute handlers based on DM authorization.
 * It does NOT handle message routing, result processing, logging, or the actual authorization logic.
 *
 * **Separation of Concerns (SoC):**
 * - Authorization checking: Delegated to DMAuthorizationEnforcer service
 * - Handler execution: Delegated to caller-provided handler function
 * - Result processing: Delegated to caller (typically RouteResultHandler)
 * - Logging: Handled by DMAuthorizationEnforcer
 *
 * **Message Types Using This Service:**
 * 1. create-character (lines 286-302)
 * 2. create-npc (lines 305-323)
 * 3. update-npc (lines 326-344)
 * 4. delete-npc (lines 347-359)
 * 5. place-npc-token (lines 362-374)
 * 6. create-prop (lines 442-462)
 * 7. update-prop (lines 467-482)
 * 8. delete-prop (lines 487-497)
 * 9. clear-all-tokens (lines 770-781)
 *
 * **Pattern Replaced:**
 * Before:
 * ```typescript
 * case "create-character": {
 *   if (
 *     !this.dmAuthorizationEnforcer.enforceDMAction(
 *       senderUid,
 *       this.isDM(senderUid),
 *       "create character",
 *     )
 *   ) {
 *     break;
 *   }
 *   const result = handler.handleCreateCharacter(state, message.name, message.maxHp, message.portrait);
 *   this.routeResultHandler.handleResult(result);
 *   break;
 * }
 * ```
 *
 * After (planned for Week 7):
 * ```typescript
 * case "create-character": {
 *   this.authorizationCheckWrapper.executeIfDMAuthorized(
 *     senderUid,
 *     this.isDM(senderUid),
 *     "create character",
 *     () => {
 *       const result = handler.handleCreateCharacter(state, message.name, message.maxHp, message.portrait);
 *       this.routeResultHandler.handleResult(result);
 *     }
 *   );
 *   break;
 * }
 * ```
 *
 * @example
 * ```typescript
 * const messageLogger = new MessageLogger();
 * const enforcer = new DMAuthorizationEnforcer(messageLogger);
 * const wrapper = new AuthorizationCheckWrapper(enforcer);
 *
 * // Authorized DM - handler executes and returns result
 * const result = wrapper.executeIfDMAuthorized(
 *   "dm-123",
 *   true,
 *   "create character",
 *   () => ({ broadcast: true, save: true })
 * );
 * // Returns: { broadcast: true, save: true }
 *
 * // Unauthorized player - handler doesn't execute
 * const result2 = wrapper.executeIfDMAuthorized(
 *   "player-456",
 *   false,
 *   "create character",
 *   () => ({ broadcast: true, save: true })
 * );
 * // Returns: undefined
 * // Logs: "Non-DM player-456 attempted to create character"
 * ```
 */
export class AuthorizationCheckWrapper {
  private dmAuthorizationEnforcer: DMAuthorizationEnforcer;

  /**
   * Create a new AuthorizationCheckWrapper
   *
   * @param dmAuthorizationEnforcer - Service to enforce DM-only actions
   *
   * @example
   * ```typescript
   * const enforcer = new DMAuthorizationEnforcer(messageLogger);
   * const wrapper = new AuthorizationCheckWrapper(enforcer);
   * ```
   */
  constructor(dmAuthorizationEnforcer: DMAuthorizationEnforcer) {
    this.dmAuthorizationEnforcer = dmAuthorizationEnforcer;
  }

  /**
   * Execute a handler only if the sender is authorized as DM.
   *
   * This method wraps handler execution with a DM authorization check. If the sender
   * is not authorized, the handler is not executed and undefined is returned.
   *
   * **Type Safety:**
   * - Generic type parameter T represents the handler's return type
   * - Ensures type safety when working with different handler return types
   * - Return type is T | undefined to handle authorization failure
   *
   * **Behavior:**
   * 1. Check if sender is authorized as DM (via DMAuthorizationEnforcer)
   * 2. If NOT authorized:
   *    - Log unauthorized attempt (handled by DMAuthorizationEnforcer)
   *    - Return undefined without executing handler
   * 3. If authorized:
   *    - Execute the handler function
   *    - Return the handler's result
   *
   * @template T - The return type of the handler function
   * @param senderUid - UID of the sender attempting the action
   * @param isDM - Whether the sender has DM privileges
   * @param action - Human-readable action name for logging (e.g., "create character")
   * @param handler - Handler function to execute if authorized
   * @returns Handler result if authorized, undefined otherwise
   *
   * @example
   * ```typescript
   * // Example 1: Authorized DM creating a character
   * const result = wrapper.executeIfDMAuthorized(
   *   "dm-123",
   *   true,
   *   "create character",
   *   () => this.characterHandler.handleCreateCharacter(state, "Gandalf", 100, "wizard.png")
   * );
   * // Handler executes, returns: { broadcast: true, save: true }
   * ```
   *
   * @example
   * ```typescript
   * // Example 2: Unauthorized player attempting to create NPC
   * const result = wrapper.executeIfDMAuthorized(
   *   "player-456",
   *   false,
   *   "create NPC",
   *   () => this.npcHandler.handleCreateNPC(state, "Goblin", 20, "goblin.png", {})
   * );
   * // Handler doesn't execute, returns: undefined
   * // Logs: "Non-DM player-456 attempted to create NPC"
   * ```
   *
   * @example
   * ```typescript
   * // Example 3: Usage in messageRouter with result handling
   * this.authorizationCheckWrapper.executeIfDMAuthorized(
   *   senderUid,
   *   this.isDM(senderUid),
   *   "delete prop",
   *   () => {
   *     const result = this.propMessageHandler.handleDeleteProp(state, message.id);
   *     this.routeResultHandler.handleResult(result);
   *   }
   * );
   * ```
   */
  executeIfDMAuthorized<T>(
    senderUid: string,
    isDM: boolean,
    action: string,
    handler: () => T,
  ): T | undefined {
    // Check authorization via DMAuthorizationEnforcer
    // If not authorized, enforcer logs the attempt and returns false
    if (!this.dmAuthorizationEnforcer.enforceDMAction(senderUid, isDM, action)) {
      return undefined;
    }

    // Execute and return handler result if authorized
    return handler();
  }
}
