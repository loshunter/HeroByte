// ============================================================================
// PROP DOMAIN - SERVICE
// ============================================================================
// Handles prop-related business logic (items, scenery, objects)

import { randomUUID } from "crypto";
import type { Prop, TokenSize } from "@shared";
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
    const gridX = centerWorldX / gridSize;
    const gridY = centerWorldY / gridSize;

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

  /**
   * Check if a user can transform (move/scale/rotate) a prop
   * @param prop - The prop to check
   * @param actorUid - Player UID attempting the transform
   * @param isDM - Whether the actor is a DM
   * @param isLocked - Whether the prop scene object is locked
   */
  canTransform(prop: Prop, actorUid: string, isDM: boolean, isLocked: boolean): boolean {
    // Locked props cannot be transformed by anyone
    if (isLocked) return false;

    // DMs can always transform unlocked props
    if (isDM) return true;

    // Everyone can transform if owner is "*"
    if (prop.owner === "*") return true;

    // Specific player can transform their own props
    if (prop.owner === actorUid) return true;

    // DM-only props (owner=null) and other players' props cannot be transformed
    return false;
  }

  /**
   * Check if a user can delete a prop
   * Deletion is always DM-only
   */
  canDelete(isDM: boolean): boolean {
    return isDM;
  }
}
