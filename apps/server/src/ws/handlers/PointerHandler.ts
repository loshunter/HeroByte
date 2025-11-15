/**
 * PointerHandler
 *
 * Handles pointer placement messages for map interaction.
 * Players can place temporary pointers on the map to indicate locations.
 *
 * Extracted from: apps/server/src/ws/messageRouter.ts (lines 599-602)
 * Extraction date: 2025-11-14
 *
 * @module ws/handlers/PointerHandler
 */

import type { RoomState } from "@shared";
import type { MapService } from "../../domains/map/service.js";

/**
 * Handler for pointer placement messages
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
   * @param state - Room state containing pointers
   * @param senderUid - UID of the player placing the pointer
   * @param x - X coordinate on the map
   * @param y - Y coordinate on the map
   * @returns true if broadcast is needed (always true for pointer updates)
   *
   * @example
   * ```typescript
   * const handler = new PointerHandler(mapService);
   * const needsBroadcast = handler.handlePointer(state, "player-123", 100, 200);
   * if (needsBroadcast) {
   *   broadcast();
   * }
   * ```
   */
  handlePointer(state: RoomState, senderUid: string, x: number, y: number): boolean {
    this.mapService.placePointer(state, senderUid, x, y);
    return true; // Always broadcast to update all clients with pointer position
  }
}
