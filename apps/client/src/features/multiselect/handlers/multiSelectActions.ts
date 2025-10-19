/**
 * Multi-Select Actions Handlers
 * Pure utility functions for multi-select operations (delete, lock, etc.)
 */

import type { SceneObject } from "@shared";
import type { DeleteAnalysisResult, DeleteBlockReason } from "../types/index.js";

/**
 * Analyze which objects can be deleted based on permissions and lock status
 */
export function analyzeObjectsForDeletion(
  selectedIds: string[],
  sceneObjects: SceneObject[],
  uid: string,
  isDM: boolean,
): DeleteAnalysisResult {
  const allowed: string[] = [];
  const blocked = new Map<string, DeleteBlockReason>();

  for (const id of selectedIds) {
    const obj = sceneObjects.find((o) => o.id === id);
    if (!obj) {
      continue;
    }

    // Can't delete the map
    if (id.startsWith("map:")) {
      blocked.set(id, "no-permission");
      continue;
    }

    // LOCK BLOCKS EVERYONE: Can't delete locked objects (even DM must unlock first)
    if (obj.locked) {
      blocked.set(id, "locked");
      continue;
    }

    // DM can delete any unlocked object
    if (isDM) {
      allowed.push(id);
      continue;
    }

    // Non-DM can only delete objects they own (or no owner set)
    if (!obj.owner || obj.owner === uid) {
      allowed.push(id);
    } else {
      blocked.set(id, "not-owner");
    }
  }

  return { allowed, blocked };
}

/**
 * Check if an object should block deletion
 */
export function shouldBlockDelete(obj: SceneObject, uid: string, isDM: boolean): boolean {
  // Can't delete map
  if (obj.id.startsWith("map:")) return true;

  // Locked objects block deletion
  if (obj.locked) return true;

  // DM can delete anything unlocked
  if (isDM) return false;

  // Non-DM can only delete owned objects
  return obj.owner !== undefined && obj.owner !== uid;
}

/**
 * Build delete confirmation message based on object types
 */
export function buildDeleteConfirmationMessage(tokenCount: number, drawingCount: number): string {
  const parts: string[] = [];
  if (tokenCount > 0) {
    parts.push(`${tokenCount} token${tokenCount > 1 ? "s" : ""}`);
  }
  if (drawingCount > 0) {
    parts.push(`${drawingCount} drawing${drawingCount > 1 ? "s" : ""}`);
  }
  return `Delete ${parts.join(" and ")}? This cannot be undone.`;
}

/**
 * Build warning message when some objects can't be deleted
 */
export function buildPartialDeleteWarning(
  allowedCount: number,
  blockedCount: number,
  lockedCount: number,
): string {
  if (lockedCount > 0) {
    return `Cannot delete ${blockedCount} locked object${blockedCount > 1 ? "s" : ""}. Delete the ${allowedCount} unlocked object${allowedCount > 1 ? "s" : ""}?`;
  }
  return `You can only delete ${allowedCount} of ${allowedCount + blockedCount} selected objects (${blockedCount} owned by others). Continue?`;
}

/**
 * Build error message when no objects can be deleted
 */
export function buildDeleteBlockedMessage(hasLocked: boolean): string {
  if (hasLocked) {
    return "Cannot delete locked objects. Unlock them first using the lock icon.";
  }
  return "You can only delete objects you own.";
}

/**
 * Separate scene object IDs by type (token vs drawing)
 */
export function separateObjectsByType(objectIds: string[]): {
  tokenIds: string[];
  drawingIds: string[];
} {
  const tokenIds: string[] = [];
  const drawingIds: string[] = [];

  for (const id of objectIds) {
    if (id.startsWith("token:")) {
      const tokenId = id.split(":")[1];
      if (tokenId) tokenIds.push(tokenId);
    } else if (id.startsWith("drawing:")) {
      const drawingId = id.split(":")[1];
      if (drawingId) drawingIds.push(drawingId);
    }
  }

  return { tokenIds, drawingIds };
}
