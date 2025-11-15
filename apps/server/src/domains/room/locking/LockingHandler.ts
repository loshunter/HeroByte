/**
 * LockingHandler
 *
 * Handles locking and unlocking of scene objects.
 *
 * Responsibilities:
 * - Lock multiple scene objects (DM only)
 * - Unlock multiple scene objects (DM only)
 * - Permission checking for lock operations
 * - Count and report successful operations
 *
 * Extracted from: apps/server/src/domains/room/service.ts (lines 135-177)
 * Extraction date: 2025-11-14
 *
 * @module domains/room/locking
 */

import type { RoomState } from "../model.js";

/**
 * Handler for scene object locking operations
 */
export class LockingHandler {
  /**
   * Lock multiple scene objects (DM only)
   *
   * @param actorUid - Player UID performing the lock
   * @param objectIds - Array of scene object IDs to lock
   * @param state - Room state
   * @returns Number of objects successfully locked
   */
  lockObjects(actorUid: string, objectIds: string[], state: RoomState): number {
    const actor = state.players.find((player) => player.uid === actorUid);
    const isDM = actor?.isDM ?? false;

    if (!isDM) {
      return 0;
    }

    let lockCount = 0;
    for (const id of objectIds) {
      const object = state.sceneObjects.find((candidate) => candidate.id === id);
      if (object) {
        object.locked = true;
        lockCount++;
      }
    }

    return lockCount;
  }

  /**
   * Unlock multiple scene objects (DM only)
   *
   * @param actorUid - Player UID performing the unlock
   * @param objectIds - Array of scene object IDs to unlock
   * @param state - Room state
   * @returns Number of objects successfully unlocked
   */
  unlockObjects(actorUid: string, objectIds: string[], state: RoomState): number {
    const actor = state.players.find((player) => player.uid === actorUid);
    const isDM = actor?.isDM ?? false;

    if (!isDM) {
      return 0;
    }

    let unlockCount = 0;
    for (const id of objectIds) {
      const object = state.sceneObjects.find((candidate) => candidate.id === id);
      if (object) {
        object.locked = false;
        unlockCount++;
      }
    }

    return unlockCount;
  }
}
