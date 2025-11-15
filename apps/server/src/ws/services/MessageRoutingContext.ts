import type { RoomState } from "../../domains/room/model.js";
import type { RoomService } from "../../domains/room/service.js";
import type { AuthorizationService } from "./AuthorizationService.js";

/**
 * MessageRoutingContext Service
 *
 * RESPONSIBILITY:
 * Provides immutable message routing context for a single message.
 * Caches state and authorization information to optimize performance.
 *
 * SINGLE RESPONSIBILITY PRINCIPLE (SRP):
 * This service has ONE responsibility: Provide efficient, cached access to
 * routing context (state + authorization) for the duration of a single message.
 *
 * SEPARATION OF CONCERNS (SoC):
 * - State retrieval: Delegates to RoomService
 * - DM authorization: Delegates to AuthorizationService
 * - Caching: Managed internally to this service
 * - Context lifecycle: One context per message, immutable during routing
 *
 * PERFORMANCE OPTIMIZATION:
 * Before: getState() called 12+ times per message (1 explicit + 11 isDM calls)
 * After: getState() called once per message, cached for entire routing cycle
 *
 * USAGE:
 * ```typescript
 * // In messageRouter.route()
 * const context = this.messageRoutingContext.create(senderUid);
 * const state = context.getState();
 * const isDM = context.isDM();
 * ```
 *
 * IMMUTABILITY:
 * Context provides read-only access to state. All state modifications
 * must go through domain services.
 */
export class MessageRoutingContext {
  constructor(
    private roomService: RoomService,
    private authorizationService: AuthorizationService,
  ) {}

  /**
   * Create a new routing context for a message
   *
   * @param senderUid - The UID of the user sending the message
   * @returns An immutable routing context with cached state and authorization
   *
   * @example
   * ```typescript
   * const context = messageRoutingContext.create("user-123");
   * const state = context.getState();
   * const isDM = context.isDM();
   * ```
   */
  create(senderUid: string): RoutingContext {
    return new RoutingContext(senderUid, this.roomService, this.authorizationService);
  }
}

/**
 * Immutable routing context for a single message
 *
 * LIFECYCLE:
 * Created once per message, lives for the duration of message routing,
 * then discarded. Never reused across messages.
 *
 * CACHING STRATEGY:
 * - State: Cached on first access, reused for all subsequent accesses
 * - DM status: Cached on first access, reused for all subsequent accesses
 * - Both caches are private and immutable
 */
export class RoutingContext {
  private cachedState: RoomState | null = null;
  private cachedIsDM: boolean | null = null;

  constructor(
    private readonly senderUid: string,
    private readonly roomService: RoomService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  /**
   * Get the room state
   *
   * State is cached on first access and reused for all subsequent calls.
   * This ensures:
   * 1. Consistent state snapshot during message routing
   * 2. Performance: Only one getState() call per message
   * 3. Predictable behavior: All handlers see the same state
   *
   * @returns The cached room state
   *
   * @example
   * ```typescript
   * const state = context.getState();
   * const players = state.players;
   * ```
   */
  getState(): RoomState {
    if (this.cachedState === null) {
      this.cachedState = this.roomService.getState();
    }
    return this.cachedState;
  }

  /**
   * Check if the sender has DM privileges
   *
   * DM status is cached on first access and reused for all subsequent calls.
   * This ensures:
   * 1. Consistent authorization during message routing
   * 2. Performance: Only one isDM() check per message
   * 3. Predictable behavior: Authorization doesn't change during routing
   *
   * @returns true if the sender is a DM, false otherwise
   *
   * @example
   * ```typescript
   * if (context.isDM()) {
   *   // Handle DM-only action
   * }
   * ```
   */
  isDM(): boolean {
    if (this.cachedIsDM === null) {
      const state = this.getState(); // Use cached state
      this.cachedIsDM = this.authorizationService.isDM(state, this.senderUid);
    }
    return this.cachedIsDM;
  }

  /**
   * Get the sender's UID
   *
   * @returns The UID of the user who sent the message
   *
   * @example
   * ```typescript
   * const senderUid = context.getSenderUid();
   * logger.log(`Processing message from ${senderUid}`);
   * ```
   */
  getSenderUid(): string {
    return this.senderUid;
  }
}
