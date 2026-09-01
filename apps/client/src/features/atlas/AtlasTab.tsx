// ============================================================================
// ATLAS TAB — the campaign as a navigable tree (DM Menu)
// ============================================================================
// Rides the lazy DM chunk (mounted from DMMenu). Data arrives through the
// snapshot the container already receives — zero new prop-bag keys (the A2
// audit) — and actions go out through one sendMessage-shaped prop.
//
// No `features/atlas` barrel, ever (plan §4.15): the player-facing world map
// (A6) lives beside this file, and a barrel re-exporting both would drag the
// DM tab's graph into the entry bundle.

import { useEffect, useState } from "react";
import type { AtlasNodeKind, AtlasNodeSnapshot, ClientMessage } from "@herobyte/shared";
import { JRPGButton } from "../../components/ui/JRPGPanel";
import type { MapStudioController } from "../map-studio";
import { atlasTreeRows } from "./atlasTree";
import { AtlasNodeRow } from "./AtlasNodeRow";
import { useAtlasActions } from "./useAtlasActions";

const NODE_KINDS: AtlasNodeKind[] = [
  "world",
  "region",
  "settlement",
  "building",
  "dungeon",
  "wilderness",
];

export interface AtlasTabProps {
  atlasNodes: AtlasNodeSnapshot[];
  currentAtlasNodeId?: string;
  onAtlasMessage: (message: ClientMessage) => void;
  mapStudio?: MapStudioController;
}

export function AtlasTab({
  atlasNodes,
  currentAtlasNodeId,
  onAtlasMessage,
  mapStudio,
}: AtlasTabProps) {
  const actions = useAtlasActions(onAtlasMessage);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<AtlasNodeKind>("dungeon");

  // The document list is fetched only by whoever asks (the controller's
  // refresh is caller-driven and Map Setup's mount is its only other caller) —
  // without this, LINK EXISTING MAP offers nothing until the DM has visited
  // the Map Setup tab once.
  const refresh = mapStudio?.refresh;
  useEffect(() => {
    refresh?.();
  }, [refresh]);

  const rows = atlasTreeRows(atlasNodes);

  return (
    <div>
      <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
        <input
          aria-label="New node name"
          placeholder="New node name"
          value={newName}
          maxLength={64}
          onChange={(event) => setNewName(event.target.value)}
          style={{ fontSize: "11px", width: "150px" }}
        />
        <select
          aria-label="New node kind"
          value={newKind}
          onChange={(event) => setNewKind(event.target.value as AtlasNodeKind)}
          style={{ fontSize: "10px" }}
        >
          {NODE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
        <JRPGButton
          variant="primary"
          onClick={() => {
            if (!newName.trim()) return;
            actions.createNode(newKind, newName.trim());
            setNewName("");
          }}
          style={{ fontSize: "10px" }}
        >
          + CREATE NODE
        </JRPGButton>
      </div>

      {rows.length === 0 ? (
        <p style={{ fontSize: "11px", opacity: 0.8 }}>
          Nothing lies within… yet. Create a node, or link one of your maps — the campaign becomes a
          tree the party can travel.
        </p>
      ) : (
        <ul aria-label="Campaign atlas" style={{ margin: 0, padding: 0 }}>
          {rows.map(({ node, depth }) => (
            <AtlasNodeRow
              key={node.id}
              node={node}
              depth={depth}
              isCurrent={node.id === currentAtlasNodeId}
              documents={mapStudio?.documents ?? []}
              actions={actions}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
