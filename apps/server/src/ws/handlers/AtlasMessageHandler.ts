// ============================================================================
// ATLAS MESSAGE HANDLER — the campaign graph's CRUD
// ============================================================================
// Mirrors MapStudioMessageHandler's shape: a prefix-narrowed family handler in
// the route() chain with ONE family DM gate. Two rules from the arc plan every
// case obeys:
//
//   REPLAY-IDEMPOTENT (§4.5): the ack layer retries a missed ack with the same
//   commandId, so create-with-existing-id, delete-absent, and
//   link-already-same must ack success (a no-op), never error.
//
//   GATE FIRST, CONSTANT REASON (§4.6): the generic nack echoes error.message
//   to the sender, so the DM check is the first statement and uses one
//   constant string — a pre-gate lookup would turn the nack channel into a
//   node-status oracle for players. Domain failures (which only a DM can
//   reach) reply on the dedicated `atlas-error` channel instead of throwing.

import {
  ATLAS_LIMITS,
  type AtlasNode,
  type ClientMessage,
  type ServerMessage,
} from "@herobyte/shared";
import type { MapStudioService } from "../../domains/mapStudio/service.js";
import type { RoomState } from "../../domains/room/model.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";
import { handleAtlasGenerateNode } from "./atlasGenerate.js";

type SendMessage = (targetUid: string, message: ServerMessage) => void;
type BroadcastToDMs = (roomId: string, message: ServerMessage) => void;
type GetRoomState = (roomId: string) => RoomState;

export const ATLAS_DM_REQUIRED = "Atlas actions require DM permission";

const NO_OP: RouteHandlerResult = { broadcast: false, save: false };
const MUTATED: RouteHandlerResult = { broadcast: true, save: true };

export function isAtlasMessage(
  message: ClientMessage,
): message is Extract<ClientMessage, { t: `atlas-${string}` }> {
  return message.t.startsWith("atlas-");
}

export class AtlasMessageHandler {
  constructor(
    private readonly getRoomState: GetRoomState,
    private readonly sendMessage: SendMessage,
    private readonly mapStudioService: MapStudioService,
    private readonly broadcastToDMs: BroadcastToDMs = () => {},
    private readonly now: () => number = Date.now,
  ) {}

  handle(
    message: ClientMessage,
    senderUid: string,
    roomId: string,
    isDM: boolean,
  ): RouteHandlerResult | null {
    if (!isAtlasMessage(message)) {
      return null;
    }
    if (!isDM) {
      throw new Error(ATLAS_DM_REQUIRED);
    }

    const state = this.getRoomState(roomId);
    switch (message.t) {
      case "atlas-create-node":
        return this.createNode(state, senderUid, message.node);
      case "atlas-update-node":
        return this.updateNode(state, senderUid, message.nodeId, message.patch);
      case "atlas-delete-node":
        return this.deleteNode(state, message.nodeId);
      case "atlas-link-map":
        return this.linkMap(state, senderUid, roomId, message.nodeId, message.documentId);
      case "atlas-create-link":
        return this.createLink(state, senderUid, roomId, message.link);
      case "atlas-delete-link":
        return this.deleteLink(state, message.linkId);
      case "atlas-generate-node":
        // Extracted for the 350-LOC cap; validate-then-persist lives there.
        return handleAtlasGenerateNode(
          {
            mapStudioService: this.mapStudioService,
            broadcastToDMs: this.broadcastToDMs,
            sendError: (uid, code, reason, nodeId) => this.error(uid, code, reason, nodeId),
            now: this.now,
          },
          state,
          senderUid,
          roomId,
          message,
        );
      default:
        // Future atlas-* types (generate, travel) land in their own slices;
        // an unrouted one must FAIL LOUDLY rather than ack success.
        throw new Error(`Unhandled atlas message: ${(message as ClientMessage).t}`);
    }
  }

  private error(
    uid: string,
    code: "rejected" | "not-found" | "at-cap",
    reason: string,
    nodeId?: string,
  ): RouteHandlerResult {
    this.sendMessage(uid, { t: "atlas-error", code, reason, nodeId });
    return NO_OP;
  }

  private createNode(
    state: RoomState,
    uid: string,
    node: { id: string; kind: AtlasNode["kind"]; name: string; parentId?: string },
  ): RouteHandlerResult {
    if (state.atlasNodes.some((existing) => existing.id === node.id)) {
      return NO_OP; // replay of a create that landed
    }
    if (state.atlasNodes.length >= ATLAS_LIMITS.nodes) {
      return this.error(uid, "at-cap", `The atlas holds at most ${ATLAS_LIMITS.nodes} nodes.`);
    }
    if (node.parentId && !state.atlasNodes.some((existing) => existing.id === node.parentId)) {
      return this.error(uid, "not-found", "The parent node no longer exists.", node.parentId);
    }
    const timestamp = this.now();
    state.atlasNodes.push({
      id: node.id,
      kind: node.kind,
      name: node.name,
      parentId: node.parentId,
      discovered: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return MUTATED;
  }

  private updateNode(
    state: RoomState,
    uid: string,
    nodeId: string,
    patch: { name?: string; discovered?: boolean; parentId?: string | null },
  ): RouteHandlerResult {
    const node = state.atlasNodes.find((existing) => existing.id === nodeId);
    if (!node) {
      return this.error(uid, "not-found", "That atlas node no longer exists.", nodeId);
    }
    let changed = false;
    if (patch.name !== undefined && patch.name !== node.name) {
      node.name = patch.name;
      changed = true;
    }
    if (patch.discovered !== undefined && patch.discovered !== node.discovered) {
      node.discovered = patch.discovered;
      changed = true;
    }
    if (patch.parentId !== undefined) {
      const nextParent = patch.parentId ?? undefined;
      if (nextParent !== node.parentId) {
        if (nextParent !== undefined && this.reparentRejected(state, nodeId, nextParent)) {
          return this.error(
            uid,
            "rejected",
            "That parent would detach the node from the tree (missing, itself, or a descendant).",
            nodeId,
          );
        }
        node.parentId = nextParent;
        changed = true;
      }
    }
    if (!changed) {
      return NO_OP; // empty or already-applied patch — a replay, or a no-op
    }
    node.updatedAt = this.now();
    return MUTATED;
  }

  /** True when `parentId` is missing, the node itself, or one of its descendants. */
  private reparentRejected(state: RoomState, nodeId: string, parentId: string): boolean {
    if (parentId === nodeId) return true;
    const byId = new Map(state.atlasNodes.map((node) => [node.id, node]));
    if (!byId.has(parentId)) return true;
    // Walk UP from the proposed parent; hitting nodeId means the parent is a
    // descendant and the reparent would mint a cycle. The visited set bounds
    // the walk even over a (theoretically) already-corrupt tree.
    const visited = new Set<string>();
    let cursor: string | undefined = parentId;
    while (cursor !== undefined && !visited.has(cursor)) {
      if (cursor === nodeId) return true;
      visited.add(cursor);
      cursor = byId.get(cursor)?.parentId;
    }
    return false;
  }

  private deleteNode(state: RoomState, nodeId: string): RouteHandlerResult {
    const node = state.atlasNodes.find((existing) => existing.id === nodeId);
    if (!node) {
      return NO_OP; // replay of a delete that landed
    }
    // Children re-parent to the deleted node's parent (root when it had none);
    // the DOCUMENT — and therefore its suspended scene — is untouched.
    for (const child of state.atlasNodes) {
      if (child.parentId === nodeId) {
        child.parentId = node.parentId;
        child.updatedAt = this.now();
      }
    }
    state.atlasNodes = state.atlasNodes.filter((existing) => existing.id !== nodeId);
    state.atlasLinks = state.atlasLinks.filter(
      (link) => link.fromNodeId !== nodeId && link.toNodeId !== nodeId,
    );
    return MUTATED;
  }

  private linkMap(
    state: RoomState,
    uid: string,
    roomId: string,
    nodeId: string,
    documentId: string,
  ): RouteHandlerResult {
    const node = state.atlasNodes.find((existing) => existing.id === nodeId);
    if (!node) {
      return this.error(uid, "not-found", "That atlas node no longer exists.", nodeId);
    }
    if (node.mapDocumentId === documentId) {
      return NO_OP; // replay of a link that landed
    }
    if (node.mapDocumentId) {
      return this.error(uid, "rejected", "That node already has a map.", nodeId);
    }
    const claimant = state.atlasNodes.find((existing) => existing.mapDocumentId === documentId);
    if (claimant) {
      return this.error(
        uid,
        "rejected",
        `That map already belongs to "${claimant.name}" — nodes and maps pair 1:1.`,
        nodeId,
      );
    }
    if (!this.hasDocument(roomId, documentId)) {
      return this.error(uid, "not-found", "That map document no longer exists.", nodeId);
    }
    node.mapDocumentId = documentId;
    node.updatedAt = this.now();
    return MUTATED;
  }

  private createLink(
    state: RoomState,
    uid: string,
    roomId: string,
    link: RoomState["atlasLinks"][number],
  ): RouteHandlerResult {
    if (state.atlasLinks.some((existing) => existing.id === link.id)) {
      return NO_OP; // replay of a create that landed
    }
    if (state.atlasLinks.length >= ATLAS_LIMITS.links) {
      return this.error(uid, "at-cap", `The atlas holds at most ${ATLAS_LIMITS.links} links.`);
    }
    const fromNode = state.atlasNodes.find((existing) => existing.id === link.fromNodeId);
    if (!fromNode || !state.atlasNodes.some((existing) => existing.id === link.toNodeId)) {
      return this.error(uid, "not-found", "A link endpoint no longer exists.");
    }
    // The sprite renders ON the from-node's map, so a promise can't host one.
    if (!fromNode.mapDocumentId) {
      return this.error(uid, "rejected", "The origin node has no map to place a link on.");
    }
    let anchor = { x: link.anchor.x, y: link.anchor.y };
    try {
      const document = this.mapStudioService.get(roomId, fromNode.mapDocumentId);
      anchor = {
        x: Math.min(Math.max(anchor.x, 0), document.width),
        y: Math.min(Math.max(anchor.y, 0), document.height),
      };
    } catch {
      return this.error(uid, "not-found", "The origin node's map document no longer exists.");
    }
    state.atlasLinks.push({ ...link, anchor });
    return MUTATED;
  }

  private deleteLink(state: RoomState, linkId: string): RouteHandlerResult {
    const before = state.atlasLinks.length;
    state.atlasLinks = state.atlasLinks.filter((existing) => existing.id !== linkId);
    return state.atlasLinks.length === before ? NO_OP : MUTATED;
  }

  private hasDocument(roomId: string, documentId: string): boolean {
    try {
      this.mapStudioService.get(roomId, documentId);
      return true;
    } catch {
      return false;
    }
  }
}
