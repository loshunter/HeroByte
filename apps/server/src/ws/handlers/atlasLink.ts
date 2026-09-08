// ============================================================================
// ATLAS LINK PUSH — the one way a travel sprite reaches the graph
// ============================================================================
// `atlas-create-link` and the kick (which pins two doors in one block) share
// this core: the replay guard, the link cap, both endpoints present, the
// origin has a map to render on, and the anchor clamped into that map's real
// dimensions. A rule added here holds for every door the graph gains.

import { ATLAS_LIMITS, type MapLink } from "@herobyte/shared";
import type { MapStudioService } from "../../domains/mapStudio/service.js";
import type { RoomState } from "../../domains/room/model.js";

export type PushLinkOutcome =
  | { ok: true; pushed: boolean }
  | { ok: false; code: "rejected" | "not-found" | "at-cap"; reason: string };

export function pushLink(
  state: RoomState,
  roomId: string,
  mapStudioService: MapStudioService,
  link: MapLink,
): PushLinkOutcome {
  if (state.atlasLinks.some((existing) => existing.id === link.id)) {
    return { ok: true, pushed: false }; // replay of a create that landed
  }
  if (state.atlasLinks.length >= ATLAS_LIMITS.links) {
    return {
      ok: false,
      code: "at-cap",
      reason: `The atlas holds at most ${ATLAS_LIMITS.links} links.`,
    };
  }
  const fromNode = state.atlasNodes.find((existing) => existing.id === link.fromNodeId);
  if (!fromNode || !state.atlasNodes.some((existing) => existing.id === link.toNodeId)) {
    return { ok: false, code: "not-found", reason: "A link endpoint no longer exists." };
  }
  // The sprite renders ON the from-node's map, so a promise can't host one.
  if (!fromNode.mapDocumentId) {
    return {
      ok: false,
      code: "rejected",
      reason: "The origin node has no map to place a link on.",
    };
  }
  let anchor = { x: link.anchor.x, y: link.anchor.y };
  try {
    const document = mapStudioService.get(roomId, fromNode.mapDocumentId);
    anchor = {
      x: Math.min(Math.max(anchor.x, 0), document.width),
      y: Math.min(Math.max(anchor.y, 0), document.height),
    };
  } catch {
    return {
      ok: false,
      code: "not-found",
      reason: "The origin node's map document no longer exists.",
    };
  }
  state.atlasLinks.push({ ...link, anchor });
  return { ok: true, pushed: true };
}
