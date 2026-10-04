// ============================================================================
// ATLAS NODE ROW — one node of the DM's campaign tree
// ============================================================================
// A PLAIN indented list on purpose (recorded decision, plan A2): a bare
// role="tree" promises the full APG keyboard contract this repo doesn't
// implement yet, and a tree role without it is WORSE for screen readers than
// an honest list of real buttons with accessible names.

import { useLocalEscape } from "../interaction/useEscapeOwner";
import { useState } from "react";
import type { AtlasNodeSnapshot, MapDocumentSummary } from "@herobyte/shared";
import { JRPGButton } from "../../components/ui/JRPGPanel";
import { displayName } from "../map-studio/tableMapIdentity";
import { AtlasGeneratePanel } from "./AtlasGeneratePanel";
import type { AtlasActions } from "./useAtlasActions";

const KIND_ICONS: Record<string, string> = {
  world: "🌍",
  region: "🗺️",
  settlement: "🏘️",
  building: "🏠",
  dungeon: "🏰",
  wilderness: "🌲",
};

interface AtlasNodeRowProps {
  node: AtlasNodeSnapshot;
  depth: number;
  isCurrent: boolean;
  documents: MapDocumentSummary[];
  /** The Travel here confirm, which knows what becomes of the table's scene. */
  travelPrompt: (name: string) => string;
  actions: AtlasActions;
}

export function AtlasNodeRow({
  node,
  depth,
  isCurrent,
  documents,
  travelPrompt,
  actions,
}: AtlasNodeRowProps) {
  const localEscape = useLocalEscape();
  const [editingName, setEditingName] = useState<string | null>(null);
  const [linkDocId, setLinkDocId] = useState("");
  const [generateOpen, setGenerateOpen] = useState(false);

  const status = isCurrent ? "▶" : node.mapDocumentId ? "▣" : "⬒";
  const statusLabel = isCurrent ? "you are here" : node.mapDocumentId ? "mapped" : "promise";

  return (
    <li
      style={{
        paddingLeft: `${depth * 16}px`,
        marginBottom: "6px",
        listStyle: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
        <span title={statusLabel} aria-label={`${statusLabel}: ${node.name}`}>
          {status} {KIND_ICONS[node.kind] ?? "❔"}
        </span>
        {editingName === null ? (
          <span style={{ fontSize: "11px" }}>{node.name}</span>
        ) : (
          <input
            aria-label={`Rename ${node.name}`}
            value={editingName}
            maxLength={64}
            onChange={(event) => setEditingName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && editingName.trim()) {
                actions.renameNode(node.id, editingName.trim());
                setEditingName(null);
              }
              if (event.key === "Escape") localEscape(event, () => setEditingName(null));
            }}
            style={{ fontSize: "11px", width: "140px" }}
          />
        )}
        <JRPGButton
          onClick={() => setEditingName((current) => (current === null ? node.name : null))}
          style={{ fontSize: "9px", padding: "2px 6px" }}
        >
          ✏️ Rename
        </JRPGButton>
        <JRPGButton
          onClick={() => actions.setDiscovered(node.id, !node.discovered)}
          style={{ fontSize: "9px", padding: "2px 6px" }}
        >
          {node.discovered ? "👁 Discovered" : "🚫 Hidden"}
        </JRPGButton>
        <JRPGButton
          variant="danger"
          onClick={() => {
            // Links and children follow the server's deleteNode; the map document
            // (and any scene saved on it) is untouched.
            const map = node.mapDocumentId
              ? " Its map stays in the Map library, with any scene saved on it."
              : "";
            const prompt =
              `Delete location "${node.name}"?${map} Any door links to or from it are removed, ` +
              "and any locations inside it move up a level.";
            if (window.confirm(prompt)) {
              actions.deleteNode(node.id);
            }
          }}
          style={{ fontSize: "9px", padding: "2px 6px" }}
        >
          ✕ Delete
        </JRPGButton>
        {node.mapDocumentId && !isCurrent && (
          <JRPGButton
            variant="primary"
            onClick={() => {
              if (window.confirm(travelPrompt(node.name))) {
                actions.travel(node.id);
              }
            }}
            style={{ fontSize: "9px", padding: "2px 6px" }}
          >
            🚩 Travel here
          </JRPGButton>
        )}
      </div>
      {!node.mapDocumentId && (
        <div style={{ display: "flex", gap: "6px", marginTop: "4px", alignItems: "center" }}>
          <select
            aria-label={`Map for ${node.name}`}
            value={linkDocId}
            onChange={(event) => setLinkDocId(event.target.value)}
            style={{ fontSize: "10px", maxWidth: "180px" }}
          >
            <option value="">Pick a map…</option>
            {documents.map((document) => (
              <option key={document.id} value={document.id}>
                {displayName(document.id, documents) ?? document.name}
              </option>
            ))}
          </select>
          <JRPGButton
            onClick={() => linkDocId && actions.linkMap(node.id, linkDocId)}
            style={{ fontSize: "9px", padding: "2px 6px" }}
          >
            🔗 Link existing map
          </JRPGButton>
          <JRPGButton
            onClick={() => setGenerateOpen((open) => !open)}
            style={{ fontSize: "9px", padding: "2px 6px" }}
          >
            🎲 Generate map for location…
          </JRPGButton>
        </div>
      )}
      {!node.mapDocumentId && generateOpen && (
        <AtlasGeneratePanel nodeId={node.id} nodeName={node.name} actions={actions} />
      )}
    </li>
  );
}
