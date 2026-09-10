/**
 * TransformMessageHandler
 *
 * Handles object transformation messages from clients.
 * Manages position, scale, and rotation transformations for scene objects.
 *
 * Extracted from: apps/server/src/ws/messageRouter.ts
 * - transform-object (lines 817-832)
 *
 * Extraction date: 2025-11-14
 *
 * @module ws/handlers/TransformMessageHandler
 */

import type { RoomState } from "../../domains/room/model.js";
import type { RoomService } from "../../domains/room/service.js";

type SceneTransformPayload = Parameters<RoomService["applySceneObjectTransform"]>[2];

/**
 * Result of handling a transform message
 */
export interface TransformMessageResult {
  /** Whether a broadcast is needed */
  broadcast: boolean;
  /** Whether state should be saved */
  save: boolean;
}

/**
 * Handler for transformation messages
 */
export class TransformMessageHandler {
  private roomService: RoomService;

  constructor(roomService: RoomService) {
    this.roomService = roomService;
  }

  /**
   * Handle transform-object message
   *
   * Applies a transformation (position, scale, rotation) to an object.
   *
   * @param state - Current room state
   * @param senderUid - UID of the sender
   * @param objectId - ID of object to transform
   * @param transform - Transform data
   * @returns Result indicating if broadcast/save is needed
   */
  handleTransformObject(
    state: RoomState,
    senderUid: string,
    objectId: string,
    transform: SceneTransformPayload,
  ): TransformMessageResult {
    if (this.roomService.applySceneObjectTransform(objectId, senderUid, transform)) {
      return { broadcast: true, save: true };
    }
    return { broadcast: false, save: false };
  }

  /**
   * step-object: one grid cell from where the object IS. The keyboard and the
   * phone d-pad send a direction, and the target is resolved here from the
   * authoritative cell — so latency, a refused step or a turn can never make
   * a client ask for a cell nobody is next to. Rides the same transform road
   * as a drag release: ownership, lock, the wall check, the player-props
   * switch and the movement charge all apply unchanged.
   */
  handleStepObject(
    state: RoomState,
    senderUid: string,
    objectId: string,
    dx: number,
    dy: number,
  ): TransformMessageResult {
    const object = state.sceneObjects.find((candidate) => candidate.id === objectId);
    if (!object) return { broadcast: false, save: false };
    // The TOKEN is the authority, not its scene object: the legacy `move`
    // road writes the token without rebuilding the scene graph when nothing
    // broadcasts, and a step from the stale object would yank it back.
    const token = objectId.startsWith("token:")
      ? state.tokens.find((candidate) => candidate.id === objectId.slice(6))
      : undefined;
    const origin = token ?? object.transform;
    // A token spawned or dragged with Snap off sits on a fractional cell; a
    // step lands on WHOLE cells, so the origin snaps first.
    const position = { x: Math.round(origin.x) + dx, y: Math.round(origin.y) + dy };
    return this.handleTransformObject(state, senderUid, objectId, { position });
  }
}
