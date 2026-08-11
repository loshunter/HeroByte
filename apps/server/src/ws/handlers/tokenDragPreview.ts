/**
 * Drag preview construction for token messages.
 *
 * Extracted from TokenMessageHandler when the link-token/set-token-size
 * permission gates pushed that file over the structural guardrail — this is
 * the one self-contained seam in it: pure functions over state, no service
 * dependencies, no mutation.
 *
 * @module ws/handlers/tokenDragPreview
 */

import type { DragPreviewEvent, DragPreviewUpdate } from "@herobyte/shared";
import type { RoomState } from "../../domains/room/model.js";

/**
 * Build a drag preview payload without mutating state.
 *
 * Filters updates so only authorized tokens are included and annotates each
 * entry with the canonical tokenId for downstream reconciliation.
 */
export function buildTokenDragPreview(
  state: RoomState,
  senderUid: string,
  updates: DragPreviewUpdate[],
  isDM: boolean,
): DragPreviewEvent | null {
  if (!updates || updates.length === 0) {
    return null;
  }

  const sanitized: DragPreviewEvent["objects"] = [];
  for (const update of updates) {
    const entry = toPreviewObject(state, senderUid, update, isDM);
    if (entry) {
      sanitized.push(entry);
    }
  }

  if (sanitized.length === 0) {
    return null;
  }

  return {
    uid: senderUid,
    timestamp: Date.now(),
    objects: sanitized,
  };
}

function toPreviewObject(
  state: RoomState,
  senderUid: string,
  update: DragPreviewUpdate,
  isDM: boolean,
) {
  if (!update || typeof update.id !== "string") {
    return null;
  }

  const tokenId = update.id.replace(/^token:/, "");
  if (!tokenId) {
    return null;
  }

  const token = state.tokens.find((candidate) => candidate.id === tokenId);
  if (!token) {
    return null;
  }

  if (!isDM && token.owner !== senderUid) {
    return null;
  }

  return {
    tokenId,
    id: `token:${tokenId}`,
    x: update.x,
    y: update.y,
  };
}
