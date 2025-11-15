/**
 * TransformHandler
 *
 * Handles scene object transformations with permission checking and state synchronization.
 *
 * Responsibilities:
 * - Apply position, scale, and rotation transforms to scene objects
 * - Check permissions (DM-only, owner-only, shared objects)
 * - Handle locked state changes
 * - Synchronize transforms back to source entities (tokens, props, staging zone)
 *
 * Extracted from: apps/server/src/domains/room/service.ts (lines 176-350)
 * Extraction date: 2025-11-14
 *
 * @module domains/room/transform
 */

import type { SceneObject, PlayerStagingZone } from "@shared";
import type { RoomState } from "../model.js";

/**
 * Transform changes that can be applied to a scene object
 */
export interface TransformChanges {
  position?: { x: number; y: number };
  scale?: { x: number; y: number };
  rotation?: number;
  locked?: boolean;
}

/**
 * Handler for scene object transformations
 */
export class TransformHandler {
  /**
   * Apply a transform to a scene object
   *
   * @param id - Scene object ID
   * @param actorUid - Player UID performing the transform
   * @param changes - Transform changes to apply
   * @param state - Room state
   * @returns true if transform was applied, false if denied
   */
  applyTransform(
    id: string,
    actorUid: string,
    changes: TransformChanges,
    state: RoomState,
  ): boolean {
    const object = state.sceneObjects.find((candidate) => candidate.id === id);
    if (!object) {
      return false;
    }

    const actor = state.players.find((player) => player.uid === actorUid);
    const isDM = actor?.isDM ?? false;

    // Handle locked state change (DM only)
    if (typeof changes.locked === "boolean") {
      if (!isDM) return false;
      object.locked = changes.locked;
      return true;
    }

    // Locked objects can only be transformed by DM
    if (object.locked && !isDM) {
      return false;
    }

    // Dispatch to type-specific handlers
    switch (object.type) {
      case "map":
        return this.applyMapTransform(object, changes, isDM);

      case "token":
        return this.applyTokenTransform(object, changes, state, actorUid, isDM);

      case "staging-zone":
        return this.applyStagingZoneTransform(object, changes, state, isDM);

      case "drawing":
        return this.applyDrawingTransform(object, changes, state, actorUid, isDM);

      case "prop":
        return this.applyPropTransform(object, changes, state, actorUid, isDM);

      case "pointer":
        return this.applyPointerTransform(object, changes, actorUid);

      default:
        return false;
    }
  }

  /**
   * Apply transform to map object (DM only)
   */
  private applyMapTransform(
    object: SceneObject,
    changes: TransformChanges,
    isDM: boolean,
  ): boolean {
    if (!isDM) return false;

    this.applyPosition(object, changes.position);
    this.applyScale(object, changes.scale);
    this.applyRotation(object, changes.rotation);
    return true;
  }

  /**
   * Apply transform to token object (DM or owner)
   * Syncs position to backing Token entity
   */
  private applyTokenTransform(
    object: SceneObject,
    changes: TransformChanges,
    state: RoomState,
    actorUid: string,
    isDM: boolean,
  ): boolean {
    const tokenId = object.id.replace(/^token:/, "");
    const token = state.tokens.find((candidate) => candidate.id === tokenId);
    if (!token) return false;

    // Permission check: DM or token owner
    if (!isDM && token.owner !== actorUid) return false;

    // Sync position to Token entity
    if (changes.position) {
      token.x = changes.position.x;
      token.y = changes.position.y;
    }

    // Apply to SceneObject transform
    this.applyPosition(object, changes.position);
    this.applyScale(object, changes.scale);
    this.applyRotation(object, changes.rotation);
    return true;
  }

  /**
   * Apply transform to staging zone (DM only)
   * Syncs all transforms to playerStagingZone state
   */
  private applyStagingZoneTransform(
    object: SceneObject,
    changes: TransformChanges,
    state: RoomState,
    isDM: boolean,
  ): boolean {
    if (!isDM) return false;
    if (!state.playerStagingZone) return false;

    console.log("[DEBUG] Staging zone transform:", {
      position: changes.position,
      scale: changes.scale,
      rotation: changes.rotation,
      currentTransform: object.transform,
      currentZone: state.playerStagingZone,
    });

    // Sync position
    if (changes.position) {
      state.playerStagingZone.x = changes.position.x;
      state.playerStagingZone.y = changes.position.y;
      this.applyPosition(object, changes.position);
    }

    // Sync scale
    if (changes.scale) {
      state.playerStagingZone.scaleX = changes.scale.x;
      state.playerStagingZone.scaleY = changes.scale.y;
      // Apply scale to transform (don't bake into width/height)
      // The width/height remain as "base" values, and we scale them via transform
      this.applyScale(object, changes.scale);

      console.log("[DEBUG] Staging zone scale applied:", {
        baseWidth: state.playerStagingZone.width,
        baseHeight: state.playerStagingZone.height,
        scaleX: changes.scale.x,
        scaleY: changes.scale.y,
        finalWidth: state.playerStagingZone.width * changes.scale.x,
        finalHeight: state.playerStagingZone.height * changes.scale.y,
      });
    }

    // Sync rotation
    if (typeof changes.rotation === "number") {
      state.playerStagingZone.rotation = changes.rotation;
      this.applyRotation(object, changes.rotation);
      // Additional sync to data.rotation
      if (object.type === "staging-zone") {
        object.data.rotation = changes.rotation;
      }
    }

    return true;
  }

  /**
   * Apply transform to drawing object (DM or owner)
   */
  private applyDrawingTransform(
    object: SceneObject,
    changes: TransformChanges,
    state: RoomState,
    actorUid: string,
    isDM: boolean,
  ): boolean {
    const drawingId = object.id.replace(/^drawing:/, "");
    const drawing = state.drawings.find((candidate) => candidate.id === drawingId);
    const canEdit = isDM || drawing?.owner === actorUid;
    if (!drawing || !canEdit) return false;

    this.applyPosition(object, changes.position);
    this.applyScale(object, changes.scale);
    this.applyRotation(object, changes.rotation);
    return true;
  }

  /**
   * Apply transform to prop object (DM, owner, or shared)
   * Syncs all transforms to backing Prop entity
   */
  private applyPropTransform(
    object: SceneObject,
    changes: TransformChanges,
    state: RoomState,
    actorUid: string,
    isDM: boolean,
  ): boolean {
    const propId = object.id.replace(/^prop:/, "");
    const prop = state.props.find((candidate) => candidate.id === propId);
    if (!prop) return false;

    // Permission check: DM, owner="*" (everyone), or specific owner
    const canEdit = isDM || prop.owner === "*" || prop.owner === actorUid;
    if (!canEdit) return false;

    // Sync to Prop entity
    if (changes.position) {
      prop.x = changes.position.x;
      prop.y = changes.position.y;
    }
    if (changes.scale) {
      prop.scaleX = changes.scale.x;
      prop.scaleY = changes.scale.y;
    }
    if (typeof changes.rotation === "number") {
      prop.rotation = changes.rotation;
    }

    // Apply to SceneObject transform
    this.applyPosition(object, changes.position);
    this.applyScale(object, changes.scale);
    this.applyRotation(object, changes.rotation);
    return true;
  }

  /**
   * Apply transform to pointer object (owner only, position only)
   */
  private applyPointerTransform(
    object: SceneObject,
    changes: TransformChanges,
    actorUid: string,
  ): boolean {
    // Pointers are ephemeral and follow owner interactions only
    if (object.owner !== actorUid) return false;
    this.applyPosition(object, changes.position);
    return true;
  }

  /**
   * Apply position changes to scene object transform
   */
  private applyPosition(object: SceneObject, value: { x: number; y: number } | undefined): void {
    if (value) {
      object.transform.x = value.x;
      object.transform.y = value.y;
    }
  }

  /**
   * Apply scale changes to scene object transform
   */
  private applyScale(object: SceneObject, value: { x: number; y: number } | undefined): void {
    if (value) {
      object.transform.scaleX = value.x;
      object.transform.scaleY = value.y;
    }
  }

  /**
   * Apply rotation changes to scene object transform
   */
  private applyRotation(object: SceneObject, value: number | undefined): void {
    if (typeof value === "number") {
      object.transform.rotation = value;
    }
  }
}
