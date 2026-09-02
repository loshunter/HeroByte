// ============================================================================
// ATLAS LINK PLACER — "put a door on THIS map, leading there"
// ============================================================================
// Links anchor in the FROM node's document px, so placement always starts
// from the CURRENT node: the map the DM can actually see and click. Arming
// hands everything but the anchor to useAtlasLinkAim; the canvas click
// completes it (one-shot; ESC or a second finger cancels).

import { useState } from "react";
import type { AtlasNodeSnapshot, MapLink, MapLinkSnapshot } from "@herobyte/shared";
import { JRPGButton } from "../../components/ui/JRPGPanel";
import type { PendingLink } from "./useAtlasLinkAim";

const LINK_TYPES: MapLink["linkType"][] = ["door", "stair", "signpost"];

export interface AtlasLinkPlacerProps {
  currentNode: AtlasNodeSnapshot;
  nodes: AtlasNodeSnapshot[];
  /** Every link the DM has (server-filtered for a DM = all of them). */
  links: MapLinkSnapshot[];
  linkAimActive: boolean;
  onArmLinkAim: (pending: PendingLink) => void;
  onDeleteLink: (linkId: string) => void;
}

export function AtlasLinkPlacer({
  currentNode,
  nodes,
  links,
  linkAimActive,
  onArmLinkAim,
  onDeleteLink,
}: AtlasLinkPlacerProps) {
  const [toNodeId, setToNodeId] = useState("");
  const [linkType, setLinkType] = useState<MapLink["linkType"]>("door");
  const [visibleToPlayers, setVisibleToPlayers] = useState(true);

  const targets = nodes.filter((node) => node.id !== currentNode.id);
  if (targets.length === 0) return null;

  if (linkAimActive) {
    return (
      <p style={{ fontSize: "10px", margin: "0 0 10px", color: "#7ce0d3" }}>
        ⚓ Aiming — click the spot on the map where the link sits. ESC cancels.
      </p>
    );
  }

  // The sprites ON this map, each removable — without this a misplaced sprite
  // was permanent short of deleting the whole node (the arc's final review).
  const onThisMap = links.filter((link) => link.fromNodeId === currentNode.id);
  const nameOf = (nodeId: string | undefined) =>
    nodes.find((node) => node.id === nodeId)?.name ?? "somewhere hidden";

  return (
    <div
      style={{
        display: "flex",
        gap: "6px",
        marginBottom: "10px",
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      {onThisMap.length > 0 && (
        <ul
          aria-label={`Links on ${currentNode.name}`}
          style={{ margin: 0, padding: 0, width: "100%" }}
        >
          {onThisMap.map((link) => (
            <li key={link.id} style={{ listStyle: "none", fontSize: "10px", marginBottom: "2px" }}>
              ⚓ {link.linkType} → {nameOf(link.toNodeId)}
              {link.visibleToPlayers === false ? " (hidden)" : ""}{" "}
              <JRPGButton
                variant="danger"
                aria-label={`Remove ${link.linkType} to ${nameOf(link.toNodeId)}`}
                onClick={() => onDeleteLink(link.id)}
                style={{ fontSize: "9px", padding: "1px 5px" }}
              >
                ✕
              </JRPGButton>
            </li>
          ))}
        </ul>
      )}
      <span style={{ fontSize: "10px" }}>⚓ Link from {currentNode.name} to</span>
      <select
        aria-label={`Link target from ${currentNode.name}`}
        value={toNodeId}
        onChange={(event) => setToNodeId(event.target.value)}
        style={{ fontSize: "10px", maxWidth: "150px" }}
      >
        <option value="">Pick a node…</option>
        {targets.map((node) => (
          <option key={node.id} value={node.id}>
            {node.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Link type"
        value={linkType}
        onChange={(event) => setLinkType(event.target.value as MapLink["linkType"])}
        style={{ fontSize: "10px" }}
      >
        {LINK_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      <label style={{ fontSize: "10px", display: "flex", alignItems: "center", gap: "3px" }}>
        <input
          type="checkbox"
          checked={visibleToPlayers}
          onChange={(event) => setVisibleToPlayers(event.target.checked)}
        />
        players see it
      </label>
      <JRPGButton
        variant="primary"
        disabled={!toNodeId}
        onClick={() => {
          if (!toNodeId) return;
          onArmLinkAim({ fromNodeId: currentNode.id, toNodeId, linkType, visibleToPlayers });
        }}
        style={{ fontSize: "10px" }}
      >
        ⚓ AIM ON MAP
      </JRPGButton>
    </div>
  );
}
