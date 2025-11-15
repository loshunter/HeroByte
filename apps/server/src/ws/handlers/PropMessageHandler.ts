/**
 * PropMessageHandler
 *
 * Handles all prop-related messages from clients.
 * Manages prop creation, updates, and deletion.
 *
 * Extracted from: apps/server/src/ws/messageRouter.ts
 * - create-prop (lines 415-432)
 * - update-prop (lines 434-450)
 * - delete-prop (lines 452-465)
 *
 * Extraction date: 2025-11-14
 *
 * @module ws/handlers/PropMessageHandler
 */

import type { TokenSize } from "@shared";
import type { RoomState } from "../../domains/room/model.js";
import type { PropService } from "../../domains/prop/service.js";
import type { SelectionService } from "../../domains/selection/service.js";

type Viewport = { x: number; y: number; scale: number };

/**
 * Result of handling a prop message
 */
export interface PropMessageResult {
  /** Whether a broadcast is needed */
  broadcast: boolean;
  /** Whether state should be saved */
  save: boolean;
}

/**
 * Options for updating a prop
 */
export interface UpdatePropOptions {
  label: string;
  imageUrl: string;
  owner: string | null;
  size: TokenSize;
}

/**
 * Handler for prop-related messages
 */
export class PropMessageHandler {
  private propService: PropService;
  private selectionService: SelectionService;

  constructor(propService: PropService, selectionService: SelectionService) {
    this.propService = propService;
    this.selectionService = selectionService;
  }

  /**
   * Handle create prop message (DM only)
   *
   * @param state - Room state
   * @param label - Prop label
   * @param imageUrl - Image URL
   * @param owner - Owner UID
   * @param size - Prop size
   * @param viewport - Current viewport
   * @param gridSize - Grid size
   * @returns Result indicating broadcast/save needs
   */
  handleCreateProp(
    state: RoomState,
    label: string,
    imageUrl: string,
    owner: string | null,
    size: TokenSize,
    viewport: Viewport,
    gridSize: number,
  ): PropMessageResult {
    this.propService.createProp(state, label, imageUrl, owner, size, viewport, gridSize);
    return { broadcast: true, save: true };
  }

  /**
   * Handle update prop message (DM only)
   *
   * @param state - Room state
   * @param propId - ID of prop to update
   * @param updates - Properties to update
   * @returns Result indicating broadcast/save needs
   */
  handleUpdateProp(
    state: RoomState,
    propId: string,
    updates: UpdatePropOptions,
  ): PropMessageResult {
    const updated = this.propService.updateProp(state, propId, updates);
    return { broadcast: updated, save: updated };
  }

  /**
   * Handle delete prop message (DM only)
   *
   * Deletes a prop and removes it from selection state.
   *
   * @param state - Room state
   * @param propId - ID of prop to delete
   * @returns Result indicating broadcast/save needs
   */
  handleDeleteProp(state: RoomState, propId: string): PropMessageResult {
    const removed = this.propService.deleteProp(state, propId);
    if (removed) {
      // Remove from selection state
      this.selectionService.removeObject(state, `prop:${propId}`);
      return { broadcast: true, save: true };
    }
    return { broadcast: false, save: false };
  }
}
