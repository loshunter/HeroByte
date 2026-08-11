/**
 * MapMessageHandler
 *
 * Handles all map configuration messages from clients.
 * Manages map background, grid size, grid square size, and staging zone.
 *
 * Extracted from: apps/server/src/ws/messageRouter.ts
 * - map-background (lines 521-524)
 * - grid-size (lines 526-529)
 * - grid-square-size (lines 531-534)
 * - set-player-staging-zone (lines 536-560)
 *
 * Extraction date: 2025-11-14
 *
 * @module ws/handlers/MapMessageHandler
 */

import type { PlayerStagingZone } from "@herobyte/shared";
import type { RoomState } from "../../domains/room/model.js";
import type { MapService } from "../../domains/map/service.js";
import type { RoomService } from "../../domains/room/service.js";

/**
 * Result of handling a map message
 */
export interface MapMessageResult {
  /** Whether a broadcast is needed */
  broadcast: boolean;
  /** Whether state should be saved */
  save: boolean;
}

/**
 * Handler for map configuration messages
 */
export class MapMessageHandler {
  private mapService: MapService;
  private roomService: RoomService;

  constructor(mapService: MapService, roomService: RoomService) {
    this.mapService = mapService;
    this.roomService = roomService;
  }

  /**
   * Handle map-background message (DM only)
   *
   * Sets the background image for the map. The DM gate lives HERE, not just
   * in the client: the background control renders only in the DM menu, but a
   * crafted frame reaches this handler with no UI in the way, and it would
   * replace the table's map for everyone.
   *
   * @param state - Current room state
   * @param background - Background image URL or null to clear
   * @param isDM - Whether sender is DM
   * @returns Result indicating if broadcast/save is needed
   */
  handleMapBackground(
    state: RoomState,
    background: string | null,
    isDM: boolean,
  ): MapMessageResult {
    // Same silent-refusal shape as the staging zone below.
    if (!isDM) {
      return { broadcast: false, save: false };
    }
    this.mapService.setBackground(state, background);
    return { broadcast: true, save: false };
  }

  /**
   * Handle grid-size message (DM only)
   *
   * Sets the size of the grid in pixels — the lattice every vision,
   * measurement, and movement computation reads, which is why a player
   * socket must not be able to rewrite it.
   *
   * @param state - Current room state
   * @param size - Grid size in pixels
   * @param isDM - Whether sender is DM
   * @returns Result indicating if broadcast/save is needed
   */
  handleGridSize(state: RoomState, size: number, isDM: boolean): MapMessageResult {
    if (!isDM) {
      return { broadcast: false, save: false };
    }
    this.mapService.setGridSize(state, size);
    return { broadcast: true, save: false };
  }

  /**
   * Handle grid-square-size message (DM only)
   *
   * Sets the size of each grid square in feet — the feet-per-cell every
   * distance in the room is quoted in.
   *
   * @param state - Current room state
   * @param size - Grid square size in feet
   * @param isDM - Whether sender is DM
   * @returns Result indicating if broadcast/save is needed
   */
  handleGridSquareSize(state: RoomState, size: number, isDM: boolean): MapMessageResult {
    if (!isDM) {
      return { broadcast: false, save: false };
    }
    this.mapService.setGridSquareSize(state, size);
    return { broadcast: true, save: false };
  }

  /**
   * Handle set-player-staging-zone message
   *
   * Sets the staging zone configuration for players.
   * Only DMs can set the staging zone.
   *
   * @param state - Current room state
   * @param senderUid - UID of the sender
   * @param zone - Staging zone configuration
   * @param isDM - Whether sender is DM
   * @returns Result indicating if broadcast/save is needed
   */
  handleSetPlayerStagingZone(
    state: RoomState,
    senderUid: string,
    zone: PlayerStagingZone | undefined,
    isDM: boolean,
  ): MapMessageResult {
    console.log("[DEBUG] Received set-player-staging-zone message:", {
      senderUid,
      zone,
      timestamp: new Date().toISOString(),
    });

    const sender = state.players.find((player) => player.uid === senderUid);
    console.log("[DEBUG] Sender found:", {
      uid: sender?.uid,
      isDM: sender?.isDM,
      name: sender?.name,
    });

    if (!isDM) {
      console.log("[DEBUG] Rejected: sender is not DM");
      return { broadcast: false, save: false };
    }

    const result = this.roomService.setPlayerStagingZone(zone);
    console.log("[DEBUG] setPlayerStagingZone result:", result);

    if (result) {
      console.log("[DEBUG] Staging zone set successfully and saved");
      return { broadcast: true, save: true };
    }

    return { broadcast: false, save: false };
  }
}
