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
}
