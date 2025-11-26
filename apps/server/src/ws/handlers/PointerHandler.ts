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

import type { Pointer } from "@shared";
import type { RoomState } from "../../domains/room/model.js";
import type { MapService } from "../../domains/map/service.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";

/**
 * Result object returned by pointer handler methods
 */
export interface PointerHandlerResult extends RouteHandlerResult {
  preview?: Pointer;
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
}
