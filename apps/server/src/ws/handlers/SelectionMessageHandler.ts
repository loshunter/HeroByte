/**
 * SelectionMessageHandler
 *
 * Handles all selection-related messages from clients.
 * Manages object selection, multi-selection, and locking operations.
 *
 * Extracted from: apps/server/src/ws/messageRouter.ts
 * - select-object (lines 616-626)
 * - deselect-object (lines 628-638)
 * - select-multiple (lines 640-659)
 * - lock-selected (lines 661-672)
 * - unlock-selected (lines 674-685)
 *
 * Extraction date: 2025-11-14
 *
 * @module ws/handlers/SelectionMessageHandler
 */

import type { RoomState } from "../model.js";
import type { SelectionService } from "../../domains/selection/service.js";
import type { RoomService } from "../../domains/room/service.js";

/**
 * Result of handling a selection message
 */
export interface SelectionMessageResult {
  /** Whether a broadcast is needed */
  broadcast: boolean;
  /** Whether state should be saved */
  save: boolean;
}

/**
 * Handler for selection-related messages
 */
export class SelectionMessageHandler {
  private selectionService: SelectionService;
  private roomService: RoomService;

  constructor(selectionService: SelectionService, roomService: RoomService) {
    this.selectionService = selectionService;
    this.roomService = roomService;
  }

  /**
   * Handle select-object message
   *
   * Selects a single object for a player.
   * Validates that the uid in the message matches the sender.
   *
   * @param state - Current room state
   * @param senderUid - UID of the sender
   * @param messageUid - UID from the message (must match senderUid)
   * @param objectId - ID of object to select
   * @returns Result indicating if broadcast/save is needed
   */
  handleSelectObject(
    state: RoomState,
    senderUid: string,
    messageUid: string,
    objectId: string,
  ): SelectionMessageResult {
    if (messageUid !== senderUid) {
      console.warn(`select-object spoofed uid from ${senderUid}`);
      return { broadcast: false, save: false };
    }
    console.info(`[DEBUG] select-object from ${senderUid}: objectId=${objectId}`);
    if (this.selectionService.selectObject(state, senderUid, objectId)) {
      return { broadcast: true, save: false };
    }
    return { broadcast: false, save: false };
  }

  /**
   * Handle deselect-object message
   *
   * Deselects the current selection for a player.
   * Validates that the uid in the message matches the sender.
   *
   * @param state - Current room state
   * @param senderUid - UID of the sender
   * @param messageUid - UID from the message (must match senderUid)
   * @returns Result indicating if broadcast/save is needed
   */
  handleDeselectObject(
    state: RoomState,
    senderUid: string,
    messageUid: string,
  ): SelectionMessageResult {
    if (messageUid !== senderUid) {
      console.warn(`deselect-object spoofed uid from ${senderUid}`);
      return { broadcast: false, save: false };
    }
    console.info(`[DEBUG] deselect-object from ${senderUid}`);
    if (this.selectionService.deselect(state, senderUid)) {
      return { broadcast: true, save: false };
    }
    return { broadcast: false, save: false };
  }

  /**
   * Handle select-multiple message
   *
   * Selects multiple objects for a player.
   * Validates that the uid in the message matches the sender.
   *
   * @param state - Current room state
   * @param senderUid - UID of the sender
   * @param messageUid - UID from the message (must match senderUid)
   * @param objectIds - IDs of objects to select
   * @param mode - Selection mode (replace, add, remove)
   * @returns Result indicating if broadcast/save is needed
   */
  handleSelectMultiple(
    state: RoomState,
    senderUid: string,
    messageUid: string,
    objectIds: string[],
    mode: "replace" | "add" | "remove",
  ): SelectionMessageResult {
    if (messageUid !== senderUid) {
      console.warn(`select-multiple spoofed uid from ${senderUid}`);
      return { broadcast: false, save: false };
    }
    console.info(
      `[DEBUG] select-multiple from ${senderUid}: objectIds=${JSON.stringify(objectIds)}, mode=${mode}`,
    );
    if (this.selectionService.selectMultiple(state, senderUid, objectIds, mode)) {
      return { broadcast: true, save: false };
    }
    return { broadcast: false, save: false };
  }

  /**
   * Handle lock-selected message
   *
   * Locks the selected objects.
   * Validates that the uid in the message matches the sender.
   *
   * @param state - Current room state
   * @param senderUid - UID of the sender
   * @param messageUid - UID from the message (must match senderUid)
   * @param objectIds - IDs of objects to lock
   * @returns Result indicating if broadcast/save is needed
   */
  handleLockSelected(
    state: RoomState,
    senderUid: string,
    messageUid: string,
    objectIds: string[],
  ): SelectionMessageResult {
    if (messageUid !== senderUid) {
      console.warn(`lock-selected spoofed uid from ${senderUid}`);
      return { broadcast: false, save: false };
    }
    const lockCount = this.roomService.lockSelectedObjects(senderUid, objectIds);
    if (lockCount > 0) {
      return { broadcast: true, save: true };
    }
    return { broadcast: false, save: false };
  }

  /**
   * Handle unlock-selected message
   *
   * Unlocks the selected objects.
   * Validates that the uid in the message matches the sender.
   *
   * @param state - Current room state
   * @param senderUid - UID of the sender
   * @param messageUid - UID from the message (must match senderUid)
   * @param objectIds - IDs of objects to unlock
   * @returns Result indicating if broadcast/save is needed
   */
  handleUnlockSelected(
    state: RoomState,
    senderUid: string,
    messageUid: string,
    objectIds: string[],
  ): SelectionMessageResult {
    if (messageUid !== senderUid) {
      console.warn(`unlock-selected spoofed uid from ${senderUid}`);
      return { broadcast: false, save: false };
    }
    const unlockCount = this.roomService.unlockSelectedObjects(senderUid, objectIds);
    if (unlockCount > 0) {
      return { broadcast: true, save: true };
    }
    return { broadcast: false, save: false };
  }
}
