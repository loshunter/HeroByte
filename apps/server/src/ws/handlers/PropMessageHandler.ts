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

import type { TokenSize } from "@herobyte/shared";
import type { RoomState } from "../../domains/room/model.js";
import type { PropService } from "../../domains/prop/service.js";
import type { SelectionService } from "../../domains/selection/service.js";
import { SNAPSHOT_LIMITS } from "../../middleware/validators/sessionValidators.js";

type Viewport = { x: number; y: number; scale: number };

/**
 * Uniform ±2-cell jitter for scattered copies — tight enough to read as one
 * pile, loose enough that each lands grabbable on its own.
 */
function randomScatterOffset(): { dx: number; dy: number } {
  return { dx: Math.random() * 4 - 2, dy: Math.random() * 4 - 2 };
}

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
   * Handle create prop message (DM, or a player while the room's
   * player-props toggle is on — PropDispatcher decides; `owner` arrives
   * already forced to the sender for non-DMs)
   *
   * Creates `count` props (default 1) in one pass — one message in, one
   * broadcast and one save out, which is what keeps the client's single-flight
   * creation guard honest, same as bulk NPC creation.
   *
   * @param state - Room state
   * @param label - Prop label, numbered per copy when scattering
   * @param imageUrl - Image URL
   * @param owner - Owner UID
   * @param size - Prop size
   * @param viewport - Current viewport
   * @param gridSize - Grid size
   * @param count - How many to scatter. Validated upstream against PROP_CREATE_LIMITS.
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
    count?: number,
  ): PropMessageResult {
    const requested = Math.max(1, Math.floor(count ?? 1));

    // A room whose props outgrow the snapshot limit produces a session file
    // that fails its own load validation — the DM's backup stops being a
    // backup. Same headroom rule as bulk NPC creation.
    const headroom = Math.max(0, SNAPSHOT_LIMITS.props - state.props.length);
    if (headroom === 0) {
      console.warn(`Refusing to create prop: room is at the ${SNAPSHOT_LIMITS.props}-prop limit`);
      return { broadcast: false, save: false };
    }
    const toCreate = Math.min(requested, headroom);

    for (let i = 0; i < toCreate; i++) {
      // Numbered like bulk NPCs so "Crate 3" is findable in a list — but a
      // plain suffix, not allocateNpcNames: prop labels aren't identities
      // (the uuid is), so a collision with an earlier scatter is harmless.
      const numbered = toCreate > 1 ? `${label} ${i + 1}` : label;
      // The first lands at viewport centre like a single create always has;
      // the rest scatter around it so six crates don't stack on one spot.
      const offset = i === 0 ? undefined : randomScatterOffset();
      this.propService.createProp(
        state,
        numbered,
        imageUrl,
        owner,
        size,
        viewport,
        gridSize,
        offset,
      );
    }
    return { broadcast: true, save: true };
  }

  /**
   * Handle update prop message (DM, or the prop's owner while the room's
   * player-props toggle is on — PropDispatcher decides)
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
   * Handle delete prop message (DM, or the prop's owner while the room's
   * player-props toggle is on — PropDispatcher decides)
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
