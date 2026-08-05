/**
 * PointerHandler
 *
 * Handles pointer placement messages for map interaction.
 * Players can place temporary pointers on the map to indicate locations.
 *
 * Extracted from: apps/server/src/ws/messageRouter.ts (lines 599-602)
 * Extraction date: 2025-11-14
 * Refactored: 2025-11-15 (Week 8: Handler Pattern Standardization)
 *
 * @module ws/handlers/PointerHandler
 */

import type { MeasureEvent, MeasurePoint, Pointer } from "@herobyte/shared";
import type { RoomState } from "../../domains/room/model.js";
import type { MapService } from "../../domains/map/service.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";

/**
 * Result object returned by pointer handler methods
 */
export interface PointerHandlerResult extends RouteHandlerResult {
  preview?: Pointer;
  /** The live measurement to relay. Never touches state, never persisted. */
  measureEvent?: MeasureEvent;
}

/**
 * Handler for pointer placement messages
 *
 * **Week 8 Refactoring:**
 * - Changed return type from `boolean` to `{ broadcast: boolean, save?: boolean }`
 * - Now follows the standard RouteResultHandler pattern used by all other handlers
 * - Ensures consistent message handling across the entire messageRouter
 *
 * **Pattern Consistency:**
 * Before Week 8: `if (handler.handlePointer(...)) this.broadcast()`
 * After Week 8: `this.routeResultHandler.handleResult(handler.handlePointer(...))`
 */
export class PointerHandler {
  private mapService: MapService;

  /**
   * Create a new PointerHandler
   *
   * @param mapService - Service for map-related operations
   */
  constructor(mapService: MapService) {
    this.mapService = mapService;
  }

  /**
   * Handle pointer placement message
   *
   * Places a temporary pointer on the map at the specified coordinates.
   * Pointers are used by players to indicate locations during gameplay.
   *
   * **Week 8 Change:**
   * Now returns a result object `{ broadcast: true }` instead of `boolean`,
   * following the standard pattern used by all other message handlers.
   *
   * @param state - Room state containing pointers
   * @param senderUid - UID of the player placing the pointer
   * @param x - X coordinate on the map
   * @param y - Y coordinate on the map
   * @returns Result object emitting pointer delta without forcing a full broadcast
   *
   * @example
   * ```typescript
   * const handler = new PointerHandler(mapService);
   * const result = handler.handlePointer(state, "player-123", 100, 200);
   * routeResultHandler.handleResult(result); // Uses RouteResultHandler pattern
   * ```
   */
  handlePointer(state: RoomState, senderUid: string, x: number, y: number): PointerHandlerResult {
    const pointer = this.mapService.placePointer(state, senderUid, x, y);
    return {
      broadcast: true,
      preview: pointer,
    };
  }

  /**
   * Relay one player's live measurement to the table.
   *
   * The AUTHOR IS BOUND FROM THE CONNECTION, never read off the message — the
   * same rule chat (S2) and dice (S5) follow, so a tampered client cannot draw
   * a line under someone else's name. The client message carries coordinates
   * and nothing else.
   *
   * Nothing is written to `state`: a measurement is a gesture, not game data.
   * That means no persistence, no snapshot growth, no `SNAPSHOT_LIMITS` entry,
   * and no save on every mouse move — and a client that joins mid-drag simply
   * picks up the next update. `null` clears the sender's line for everyone.
   *
   * @returns A result that broadcasts nothing by itself; the router relays the
   *   event on the low-latency channel, exactly as it does a pointer preview.
   */
  handleMeasure(
    state: RoomState,
    senderUid: string,
    measure: { start: MeasurePoint; end: MeasurePoint } | null,
  ): PointerHandlerResult {
    const player = state.players.find((candidate) => candidate.uid === senderUid);
    const event: MeasureEvent = {
      uid: senderUid,
      name: player?.name ?? senderUid.slice(0, 6),
    };
    if (measure) {
      event.start = { x: measure.start.x, y: measure.start.y };
      event.end = { x: measure.end.x, y: measure.end.y };
    }
    return { broadcast: false, save: false, measureEvent: event };
  }
}
