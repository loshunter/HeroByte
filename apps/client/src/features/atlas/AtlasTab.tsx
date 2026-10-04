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
import type {
  AtlasNodeKind,
  AtlasNodeSnapshot,
  ClientMessage,
  MapLinkSnapshot,
} from "@herobyte/shared";
import { JRPGButton } from "../../components/ui/JRPGPanel";
import type { MapStudioController } from "../map-studio";
import { tableSceneFate } from "../map-studio/tableMapIdentity";
import { atlasTreeRows } from "./atlasTree";
import { AtlasLinkPlacer } from "./AtlasLinkPlacer";
import { AtlasNodeRow } from "./AtlasNodeRow";
import { travelPrompt } from "./travelPrompt";
import { useAtlasActions } from "./useAtlasActions";
import type { PendingLink } from "./useAtlasLinkAim";

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
  atlasLinks?: MapLinkSnapshot[];
  currentAtlasNodeId?: string;
  onAtlasMessage: (message: ClientMessage) => void;
  mapStudio?: MapStudioController;
  /** Link placement (A6): armed flag + the arm callback from useAtlasLinkAim. */
  linkAimActive?: boolean;
  onArmLinkAim?: (pending: PendingLink) => void;
  /** The kicked-in door (K2): opens the kick panel — discoverability for a DM who does not know G. */
  onOpenKick?: () => void;
  /** The table now, so Travel here can say what becomes of its scene. */
  liveSceneDocumentId?: string;
  hasCompiledScene?: boolean;
  hasBackground?: boolean;
}

export function AtlasTab({
  atlasNodes,
  atlasLinks = [],
  currentAtlasNodeId,
  onAtlasMessage,
  mapStudio,
  linkAimActive,
  onArmLinkAim,
  onOpenKick,
  liveSceneDocumentId,
  hasCompiledScene = false,
  hasBackground = false,
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
  // Placement starts from the CURRENT node — the map the DM can see and click.
  const currentNode = atlasNodes.find((node) => node.id === currentAtlasNodeId);
  const documents = mapStudio?.documents ?? [];
  const fate = tableSceneFate({
    sceneDocumentId: liveSceneDocumentId,
    missingDocumentId: mapStudio?.missingDocumentId,
    documents,
    listed: mapStudio?.listed,
  });
  const partyAt =
    currentNode?.name ??
    (!atlasNodes.length
      ? "no location yet"
      : hasCompiledScene
        ? "a map that is not a World location"
        : hasBackground
          ? "a background image (not a World location)"
          : "no map on the table yet");

  return (
    <div>
      <p className="jrpg-text-small" style={{ margin: "0 0 4px" }}>
        Campaign locations and their linked maps. Players see only discovered locations; Travel here
        moves the whole table.
      </p>
      <p className="jrpg-text-small" style={{ margin: "0 0 10px" }}>
        Party is at: <strong>{partyAt}</strong>
      </p>
      <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
        <input
          aria-label="New location name"
          placeholder="New location name"
          value={newName}
          maxLength={64}
          onChange={(event) => setNewName(event.target.value)}
          style={{ fontSize: "11px", width: "150px" }}
        />
        <select
          aria-label="New location kind"
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
          + Create location
        </JRPGButton>
        {onOpenKick && (
          <JRPGButton onClick={onOpenKick} title="Kick in a door (G)" style={{ fontSize: "10px" }}>
            🚪 KICK IN A DOOR
          </JRPGButton>
        )}
      </div>

      {onArmLinkAim && currentNode?.mapDocumentId && (
        <AtlasLinkPlacer
          currentNode={currentNode}
          nodes={atlasNodes}
          links={atlasLinks}
          linkAimActive={linkAimActive ?? false}
          onArmLinkAim={onArmLinkAim}
          onDeleteLink={actions.deleteLink}
        />
      )}

      {rows.length === 0 ? (
        <p style={{ fontSize: "11px", opacity: 0.8 }}>
          Nothing lies within… yet. Create a location, then link a saved map to it or generate one —
          the campaign becomes a tree the party can travel.
        </p>
      ) : (
        <ul aria-label="Campaign locations" style={{ margin: 0, padding: 0 }}>
          {rows.map(({ node, depth }) => (
            <AtlasNodeRow
              key={node.id}
              node={node}
              depth={depth}
              isCurrent={node.id === currentAtlasNodeId}
              documents={documents}
              travelPrompt={(name) => travelPrompt(name, fate, hasBackground)}
              actions={actions}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
