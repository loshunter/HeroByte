// ============================================================================
// ATLAS ACTIONS — thin senders for the campaign-graph messages
// ============================================================================
// Atlas ops are snapshot-confirmed room mutations (create-npc's shape), NOT
// map-studio controller commands: no baseRevision, no queue. Ids are
// client-minted (the map-studio-create convention); the server acks a
// replayed create as a no-op, so the retry layer is safe with these.

import { useMemo } from "react";
import type { AtlasNodeKind, ClientMessage } from "@herobyte/shared";
import { generateUUID } from "../../utils/uuid";

export interface AtlasActions {
  createNode: (kind: AtlasNodeKind, name: string, parentId?: string) => void;
  renameNode: (nodeId: string, name: string) => void;
  setDiscovered: (nodeId: string, discovered: boolean) => void;
  deleteNode: (nodeId: string) => void;
  linkMap: (nodeId: string, documentId: string) => void;
}

export function useAtlasActions(sendAtlasMessage: (message: ClientMessage) => void): AtlasActions {
  return useMemo(
    () => ({
      createNode: (kind, name, parentId) =>
        sendAtlasMessage({
          t: "atlas-create-node",
          node: { id: generateUUID(), kind, name, parentId },
        }),
      renameNode: (nodeId, name) =>
        sendAtlasMessage({ t: "atlas-update-node", nodeId, patch: { name } }),
      setDiscovered: (nodeId, discovered) =>
        sendAtlasMessage({ t: "atlas-update-node", nodeId, patch: { discovered } }),
      deleteNode: (nodeId) => sendAtlasMessage({ t: "atlas-delete-node", nodeId }),
      linkMap: (nodeId, documentId) =>
        sendAtlasMessage({ t: "atlas-link-map", nodeId, documentId }),
    }),
    [sendAtlasMessage],
  );
}
