// ============================================================================
// ATLAS KICK — adopt or resolve the origin, mint the child under it, cash it,
// pin both doors, travel: ONE message
// ============================================================================
// VISION's Signature Move 1 (the kicked-in door): mid-session, one keystroke,
// and the party is standing in a compiled, stocked scene with a door back.
// The composition goes THROUGH handleAtlasTravel → travelToDocument, never
// around it (plan §4.1), and steps 4–7 are ONE synchronous block: no
// recipient, and no racing fork, sees a node without its map, a link without
// its node, or a party without its scene.
//
// Replay is the NODE guard (§4.4): the first attempt is atomic, so "the child
// exists" means "the whole kick landed" — a replay re-broadcasts the document
// to DMs and never re-travels. Every id rides the message, client-minted, so
// a retry after a timeout reuses them and lands on that guard.
//
// After pre-flight the only reachable failure is the recipe (inside cashNode,
// before anything is pushed); a door push or the travel failing afterwards is
// unreachable by construction and fails LOUDLY rather than acking a half-kick.

import {
  ATLAS_LIMITS,
  gridCellToWorldPoint,
  inverseTransformScenePoint,
  type AtlasNode,
  type GenerateRequest,
  type MapDocument,
  type MapLink,
  type PlayerStagingZone,
} from "@herobyte/shared";
import { RECIPES } from "../../domains/generation/recipes.js";
import type { RoomState } from "../../domains/room/model.js";
import { isTravelingToken } from "../../domains/room/scene/sceneSuspend.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";
import { cashNode } from "./atlasCash.js";
import type { AtlasGenerateDeps } from "./atlasGenerate.js";
import { pushLink } from "./atlasLink.js";
import { handleAtlasTravel } from "./sceneTravel.js";

export interface AtlasKickMessage {
  /** The recipe's element idPrefix and the place-room dedupe key (≤120 chars). */
  commandId: string;
  /** The CHILD node — and the replay guard. */
  nodeId: string;
  /** Used only when the origin must be ADOPTED (the table's map has no node). */
  originNodeId: string;
  /** origin → child, at the party's position. */
  linkId: string;
  /** child → origin, at the entrance. */
  returnLinkId: string;
  name: string;
  seed: number;
  recipe: GenerateRequest;
  linkType?: MapLink["linkType"];
}

const NO_OP: RouteHandlerResult = { broadcast: false, save: false };
const MUTATED: RouteHandlerResult = { broadcast: true, save: true };

export function handleAtlasKick(
  deps: AtlasGenerateDeps,
  state: RoomState,
  senderUid: string,
  roomId: string,
  message: AtlasKickMessage,
): RouteHandlerResult {
  // 0. REPLAY — the whole kick landed the first time.
  const existing = state.atlasNodes.find((candidate) => candidate.id === message.nodeId);
  if (existing) {
    if (existing.mapDocumentId) {
      try {
        deps.broadcastToDMs(roomId, {
          t: "map-studio-document",
          document: deps.mapStudioService.get(roomId, existing.mapDocumentId),
        });
      } catch {
        // The document store desynced; travel reports it properly.
      }
    }
    return NO_OP;
  }

  // 1. ORIGIN — the scene on the table first, the binding second: they part
  // after an unbind or a publish, and the party stands on the SCENE. Nothing
  // compiled and nothing bound is the true limbo: there is no document to
  // suspend, so there is nothing to kick a door out of.
  const originDocumentId = state.compiledScene?.sourceDocumentId ?? state.liveMapDocumentId;
  if (!originDocumentId) {
    return deps.sendError(
      senderUid,
      "rejected",
      "Start a live map first — there is nothing on the table to kick a door into.",
      message.nodeId,
    );
  }
  const origin = state.atlasNodes.find((candidate) => candidate.mapDocumentId === originDocumentId);

  // 2. PRE-FLIGHT — state untouched on every failure; constant reasons.
  const mintedNodes = origin ? 1 : 2;
  if (state.atlasNodes.length + mintedNodes > ATLAS_LIMITS.nodes) {
    return deps.sendError(
      senderUid,
      "at-cap",
      `The atlas holds at most ${ATLAS_LIMITS.nodes} nodes.`,
      message.nodeId,
    );
  }
  if (state.atlasLinks.length + 2 > ATLAS_LIMITS.links) {
    return deps.sendError(
      senderUid,
      "at-cap",
      `The atlas holds at most ${ATLAS_LIMITS.links} links.`,
      message.nodeId,
    );
  }
  const minted = [message.nodeId, message.originNodeId, message.linkId, message.returnLinkId];
  const collides =
    new Set(minted).size !== minted.length ||
    state.atlasLinks.some(
      (link) => link.id === message.linkId || link.id === message.returnLinkId,
    ) ||
    (!origin && state.atlasNodes.some((node) => node.id === message.originNodeId));
  if (collides) {
    return deps.sendError(
      senderUid,
      "rejected",
      "The kick's minted ids collide with the graph — roll again.",
      message.nodeId,
    );
  }
  let originDocument: MapDocument;
  try {
    originDocument = deps.mapStudioService.get(roomId, originDocumentId);
  } catch {
    return deps.sendError(
      senderUid,
      "not-found",
      "The map on the table is missing from the store.",
      message.nodeId,
    );
  }
  // (The document-count cap is cashNode's own check — it runs before any push.)

  // 3. ANCHOR — computed NOW, before anything moves.
  const anchor = partyAnchor(state, originDocument);

  // 4. CASH — an object, not yet pushed; nothing else is mutated on failure.
  const now = deps.now();
  const child: AtlasNode = {
    id: message.nodeId,
    kind: RECIPES[message.recipe.recipeId].nodeKind,
    name: message.name.trim(),
    parentId: origin?.id ?? message.originNodeId,
    discovered: false,
    createdAt: now,
    updatedAt: now,
  };
  const cashed = cashNode(deps, roomId, child, message.seed, message.recipe, message.commandId);
  if (!cashed.ok) {
    return deps.sendError(senderUid, cashed.code, cashed.reason, message.nodeId);
  }
  const childDocument = deps.mapStudioService.get(roomId, cashed.documentId);

  // 5. PUSH — the adopted origin (the document the party stands on becomes a
  // node, discovered, named after its map), then the child, then both doors
  // through the same core atlas-create-link uses.
  if (!origin) {
    state.atlasNodes.push({
      id: message.originNodeId,
      kind: "region",
      name: originDocument.name,
      mapDocumentId: originDocumentId,
      discovered: true,
      createdAt: now,
      updatedAt: now,
    });
  }
  state.atlasNodes.push(child);
  const originId = origin?.id ?? message.originNodeId;
  const linkType = message.linkType ?? "door";
  const out = pushLink(state, roomId, deps.mapStudioService, {
    id: message.linkId,
    fromNodeId: originId,
    toNodeId: child.id,
    anchor,
    linkType,
    visibleToPlayers: true,
  });
  const back = pushLink(state, roomId, deps.mapStudioService, {
    id: message.returnLinkId,
    fromNodeId: child.id,
    toNodeId: originId,
    anchor: entranceAnchor(child.arrival, childDocument),
    linkType,
    visibleToPlayers: true,
  });
  if (!out.ok || !back.ok) {
    const reason = !out.ok ? out.reason : !back.ok ? back.reason : "";
    throw new Error(`atlas-kick: a door push failed after pre-flight (${reason})`);
  }

  // 6. TRAVEL — warp on, fog on (recipe provenance), the arrival zone
  // installed, auto-discover. The document exists by construction, so the
  // travel cannot refuse; the kick has mutated regardless, so it broadcasts.
  handleAtlasTravel(
    { mapStudioService: deps.mapStudioService, now: deps.now },
    state,
    senderUid,
    roomId,
    child.id,
    deps.sendError,
  );
  return MUTATED;
}

/**
 * Where the out-door goes: the party's centroid in the origin's DOCUMENT px
 * (tokens live in grid cells; a placed raster's "map" transform maps world px
 * back to document px), or the scene's center when nobody travels — a solo
 * prep is normal, never a refusal.
 */
function partyAnchor(state: RoomState, originDocument: MapDocument): { x: number; y: number } {
  const travelers = state.tokens.filter((token) => isTravelingToken(token, state));
  if (travelers.length === 0) {
    return {
      x: (state.compiledScene?.width ?? originDocument.width) / 2,
      y: (state.compiledScene?.height ?? originDocument.height) / 2,
    };
  }
  const centroid = {
    x: travelers.reduce((sum, token) => sum + token.x, 0) / travelers.length,
    y: travelers.reduce((sum, token) => sum + token.y, 0) / travelers.length,
  };
  const world = gridCellToWorldPoint(state.gridSize, centroid);
  const mapTransform = state.sceneObjects.find((object) => object.type === "map")?.transform;
  return mapTransform ? inverseTransformScenePoint(mapTransform, world) : world;
}

/**
 * Where the return door goes: the arrival rect's boundary cell on the side
 * nearest the document's edge (the way in), in DOCUMENT px by the token
 * convention — never the zone's CENTER, where the party stands and the tokens
 * layer would cover the sprite. Ties break west, east, north, south. A node
 * without an arrival gets the document's center.
 */
export function entranceAnchor(
  arrival: PlayerStagingZone | undefined,
  document: MapDocument,
): { x: number; y: number } {
  if (!arrival) {
    return { x: document.width / 2, y: document.height / 2 };
  }
  const { size, offsetX, offsetY } = document.grid;
  const cols = Math.floor((document.width - offsetX) / size);
  const rows = Math.floor((document.height - offsetY) / size);
  const left = arrival.x - (arrival.width - 1) / 2;
  const right = arrival.x + (arrival.width - 1) / 2;
  const top = arrival.y - (arrival.height - 1) / 2;
  const bottom = arrival.y + (arrival.height - 1) / 2;
  const sides = [
    { gap: left, cell: { x: left, y: arrival.y } },
    { gap: cols - 1 - right, cell: { x: right, y: arrival.y } },
    { gap: top, cell: { x: arrival.x, y: top } },
    { gap: rows - 1 - bottom, cell: { x: arrival.x, y: bottom } },
  ];
  const nearest = sides.reduce((best, side) => (side.gap < best.gap ? side : best));
  return {
    x: (nearest.cell.x + 0.5) * size + offsetX,
    y: (nearest.cell.y + 0.5) * size + offsetY,
  };
}
