// ============================================================================
// SCENE GRAPH BUILDER
// ============================================================================
// Builds scene objects from room state entities

import type { SceneObject, Token, Drawing, Prop, PlayerStagingZone, Pointer } from "@shared";
import type { RoomState } from "../model.js";

/**
 * SceneGraphBuilder - Converts room entities into a unified scene graph
 *
 * Responsibilities:
 * - Convert map background → scene object
 * - Convert tokens → scene objects (preserve transforms)
 * - Convert drawings → scene objects
 * - Convert props → scene objects
 * - Convert staging zone → scene object
 * - Convert pointers → scene objects
 * - Detect duplicate IDs (debugging)
 *
 * Extracted from: apps/server/src/domains/room/service.ts:418-573
 */
export class SceneGraphBuilder {
  /**
   * Rebuild the complete scene graph from room state
   *
   * @param state - Current room state
   * @returns Array of scene objects representing all entities
   */
  rebuild(state: RoomState): SceneObject[] {
    const existing = new Map<string, SceneObject>(
      state.sceneObjects.map((obj) => [obj.id, obj]),
    );
    const next: SceneObject[] = [];

    // Build scene objects for each entity type
    const mapObject = this.buildMapObject(state.mapBackground, existing);
    if (mapObject) {
      next.push(mapObject);
    }

    next.push(...this.buildTokenObjects(state.tokens, existing));
    next.push(...this.buildDrawingObjects(state.drawings, existing));
    next.push(...this.buildPropObjects(state.props, existing));

    const stagingObject = this.buildStagingZoneObject(state.playerStagingZone, existing);
    if (stagingObject) {
      next.push(stagingObject);
    }

    next.push(...this.buildPointerObjects(state.pointers, existing));

    // Debug: Check for duplicate IDs
    this.detectDuplicateIds(next);

    return next;
  }

  /**
   * Build scene object for map background
   *
   * @param mapBackground - Map background URL
   * @param existing - Map of existing scene objects for preserving properties
   * @returns Map scene object or null if no map background
   */
  private buildMapObject(
    mapBackground: string | undefined,
    existing: Map<string, SceneObject>,
  ): SceneObject | null {
    if (!mapBackground) {
      return null;
    }

    const mapId = "map";
    const prev = existing.get(mapId);
    return {
      id: mapId,
      type: "map",
      owner: null,
      locked: prev?.locked ?? true,
      zIndex: prev?.zIndex ?? -100,
      transform: prev?.transform ?? { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      data: {
        imageUrl: mapBackground,
        width: prev?.type === "map" ? prev.data.width : undefined,
        height: prev?.type === "map" ? prev.data.height : undefined,
      },
    };
  }

  /**
   * Build scene objects for all tokens
   *
   * @param tokens - Array of tokens
   * @param existing - Map of existing scene objects for preserving properties
   * @returns Array of token scene objects
   */
  private buildTokenObjects(
    tokens: Token[],
    existing: Map<string, SceneObject>,
  ): SceneObject[] {
    const result: SceneObject[] = [];

    for (const token of tokens) {
      const id = `token:${token.id}`;
      const prev = existing.get(id);
      const transform = prev?.transform ?? {
        x: token.x,
        y: token.y,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      };
      // Update position from token, preserve scale and rotation
      transform.x = token.x;
      transform.y = token.y;

      result.push({
        id,
        type: "token",
        owner: token.owner,
        locked: prev?.locked ?? false,
        zIndex: prev?.zIndex ?? 10,
        transform: { ...transform },
        data: {
          characterId: prev?.type === "token" ? prev.data.characterId : undefined,
          color: token.color,
          imageUrl: token.imageUrl,
          size: token.size ?? "medium",
        },
      });
    }

    return result;
  }

  /**
   * Build scene objects for all drawings
   *
   * @param drawings - Array of drawings
   * @param existing - Map of existing scene objects for preserving properties
   * @returns Array of drawing scene objects
   */
  private buildDrawingObjects(
    drawings: Drawing[],
    existing: Map<string, SceneObject>,
  ): SceneObject[] {
    const result: SceneObject[] = [];

    for (const drawing of drawings) {
      const id = `drawing:${drawing.id}`;
      const prev = existing.get(id);
      result.push({
        id,
        type: "drawing",
        owner: drawing.owner ?? null,
        locked: prev?.locked ?? false,
        zIndex: prev?.zIndex ?? 5,
        transform: prev?.transform ?? { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        data: { drawing },
      });
    }

    return result;
  }

  /**
   * Build scene objects for all props
   *
   * @param props - Array of props
   * @param existing - Map of existing scene objects for preserving properties
   * @returns Array of prop scene objects
   */
  private buildPropObjects(
    props: Prop[],
    existing: Map<string, SceneObject>,
  ): SceneObject[] {
    const result: SceneObject[] = [];

    for (const prop of props) {
      const id = `prop:${prop.id}`;
      const prev = existing.get(id);
      result.push({
        id,
        type: "prop",
        owner: prop.owner,
        locked: prev?.locked ?? false,
        zIndex: prev?.zIndex ?? 7, // Above drawings (5), below tokens (10)
        transform: {
          x: prop.x,
          y: prop.y,
          scaleX: prop.scaleX,
          scaleY: prop.scaleY,
          rotation: prop.rotation,
        },
        data: {
          imageUrl: prop.imageUrl,
          label: prop.label,
          size: prop.size,
        },
      });
    }

    return result;
  }

  /**
   * Build scene object for player staging zone
   *
   * @param zone - Player staging zone (optional)
   * @param existing - Map of existing scene objects for preserving properties
   * @returns Staging zone scene object or null if no zone
   */
  private buildStagingZoneObject(
    zone: PlayerStagingZone | undefined,
    existing: Map<string, SceneObject>,
  ): SceneObject | null {
    if (!zone) {
      return null;
    }

    const id = "staging-zone";
    const prev = existing.get(id);
    return {
      id,
      type: "staging-zone",
      owner: null,
      locked: prev?.locked ?? false,
      zIndex: prev?.zIndex ?? 1,
      transform: {
        x: zone.x,
        y: zone.y,
        scaleX: zone.scaleX ?? 1,
        scaleY: zone.scaleY ?? 1,
        rotation: zone.rotation ?? 0,
      },
      data: {
        width: zone.width,
        height: zone.height,
        rotation: zone.rotation ?? 0,
        label:
          prev?.type === "staging-zone" && prev.data.label
            ? prev.data.label
            : "Player Staging Zone",
      },
    };
  }

  /**
   * Build scene objects for all pointers
   *
   * @param pointers - Array of pointers
   * @param existing - Map of existing scene objects for preserving properties
   * @returns Array of pointer scene objects
   */
  private buildPointerObjects(
    pointers: Pointer[],
    existing: Map<string, SceneObject>,
  ): SceneObject[] {
    const result: SceneObject[] = [];

    for (const pointer of pointers) {
      const pointerKey = pointer.id ?? pointer.uid;
      const id = `pointer:${pointerKey}`;
      const prev = existing.get(id);
      result.push({
        id,
        type: "pointer",
        owner: pointer.uid,
        locked: true,
        zIndex: prev?.zIndex ?? 20,
        transform: prev?.transform ?? {
          x: pointer.x,
          y: pointer.y,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
        },
        data: { uid: pointer.uid, pointerId: pointerKey, name: pointer.name },
      });
    }

    return result;
  }

  /**
   * Detect and log duplicate IDs in scene objects (for debugging)
   *
   * @param sceneObjects - Array of scene objects to check
   */
  private detectDuplicateIds(sceneObjects: SceneObject[]): void {
    const ids = sceneObjects.map((obj) => obj.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicates.length > 0) {
      console.error(`[rebuildSceneGraph] DUPLICATE IDs FOUND:`, duplicates);
    }
  }
}
