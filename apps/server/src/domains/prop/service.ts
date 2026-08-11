// ============================================================================
// PROP DOMAIN - SERVICE
// ============================================================================
// Handles prop-related business logic (items, scenery, objects)

import { randomUUID } from "crypto";
import type { Prop, TokenSize } from "@herobyte/shared";
import type { RoomState } from "../room/model.js";

/**
 * Prop service - manages props on the map
 */
export class PropService {
  /**
   * Find prop by ID
   */
  findProp(state: RoomState, propId: string): Prop | undefined {
    return state.props.find((p) => p.id === propId);
  }

  /**
   * Create a new prop on the map
   * @param viewport - Current viewport info from DM (for positioning at center)
   * @param gridSize - Grid size for coordinate conversion
   */
  createProp(
    state: RoomState,
    label: string,
    imageUrl: string,
    owner: string | null,
    size: TokenSize,
    viewport: { x: number; y: number; scale: number },
    gridSize: number,
    offset?: { dx: number; dy: number }, // Grid-cell jitter for scattered copies
  ): Prop {
    // Calculate viewport center in world coordinates
    const viewportWidth = 800; // Default fallback
    const viewportHeight = 600;
    const centerScreenX = viewportWidth / 2;
    const centerScreenY = viewportHeight / 2;

    // Convert screen center to world coordinates
    const centerWorldX = (centerScreenX - viewport.x) / viewport.scale;
    const centerWorldY = (centerScreenY - viewport.y) / viewport.scale;

    // Convert to grid coordinates
    const gridX = centerWorldX / gridSize + (offset?.dx ?? 0);
    const gridY = centerWorldY / gridSize + (offset?.dy ?? 0);

    const newProp: Prop = {
      id: randomUUID(),
      label: label.trim() || "Prop",
      imageUrl: imageUrl.trim(),
      owner,
      size,
      x: gridX,
      y: gridY,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    };

    state.props.push(newProp);
    console.log(
      `Created prop: ${newProp.label} (ID: ${newProp.id}) at (${gridX.toFixed(2)}, ${gridY.toFixed(2)})`,
    );
    return newProp;
  }

  /**
   * Update an existing prop's properties (label, imageUrl, owner, size)
   */
  updateProp(
    state: RoomState,
    propId: string,
    updates: {
      label: string;
      imageUrl: string;
      owner: string | null;
      size: TokenSize;
    },
  ): boolean {
    const prop = this.findProp(state, propId);
    if (!prop) {
      console.error(`Cannot update: Prop ${propId} not found`);
      return false;
    }

    prop.label = updates.label.trim() || "Prop";
    prop.imageUrl = updates.imageUrl.trim();
    prop.owner = updates.owner;
    prop.size = updates.size;

    console.log(`Updated prop: ${prop.label} (ID: ${propId})`);
    return true;
  }

  /**
   * Update prop transform (position, scale, rotation)
   * Called when prop is moved/transformed via transform tool
   */
  updateTransform(
    state: RoomState,
    propId: string,
    transform: {
      x?: number;
      y?: number;
      scaleX?: number;
      scaleY?: number;
      rotation?: number;
    },
  ): boolean {
    const prop = this.findProp(state, propId);
    if (!prop) {
      console.error(`Cannot transform: Prop ${propId} not found`);
      return false;
    }

    if (transform.x !== undefined) prop.x = transform.x;
    if (transform.y !== undefined) prop.y = transform.y;
    if (transform.scaleX !== undefined) prop.scaleX = transform.scaleX;
    if (transform.scaleY !== undefined) prop.scaleY = transform.scaleY;
    if (transform.rotation !== undefined) prop.rotation = transform.rotation;

    return true;
  }

  /**
   * Delete a prop by ID
   */
  deleteProp(state: RoomState, propId: string): Prop | undefined {
    const index = state.props.findIndex((p) => p.id === propId);
    if (index === -1) {
      console.error(`Cannot delete: Prop ${propId} not found`);
      return undefined;
    }
    const [removed] = state.props.splice(index, 1);
    console.log(`Deleted prop: ${removed.label} (ID: ${propId})`);
    return removed;
  }

  // NOTE: the permission questions used to be mirrored here as canTransform /
  // canDelete, but nothing ever called them — TransformHandler owns the
  // move/scale/rotate rule inline, and create/update/delete authorization
  // lives in PropDispatcher (owner-or-DM, gated on the room's
  // playerPropsEnabled toggle). Dead mirrors of permission logic drift into
  // lies, so they were removed rather than updated.
}
