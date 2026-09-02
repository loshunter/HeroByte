// ============================================================================
// WORLD MAP PANEL — the discovered campaign in every player's pocket
// ============================================================================
// Read-only: the tree renders EXACTLY what the projection sent (discovered
// nodes only, by the server's whitelist — no client re-filter), with "you are
// here" from currentAtlasNodeId. Two presentations, the PlayerPropsPanel
// idiom: "window" is the desktop shape (floating 🗺 launcher + a
// DraggableWindow, launcher state local so the layouts thread ZERO new
// props); "content" is bare, for the mobile atlas screen.

import { useState } from "react";
import type { RoomSnapshot } from "@herobyte/shared";
import { JRPGPanel, JRPGButton } from "../../components/ui/JRPGPanel";
import { DraggableWindow } from "../../components/dice/DraggableWindow";
import { atlasTreeRows } from "./atlasTree";

const KIND_GLYPH: Record<string, string> = {
  world: "🌍",
  region: "🗺️",
  settlement: "🏘️",
  building: "🏛️",
  dungeon: "🏰",
  wilderness: "🌲",
};

export interface WorldMapPanelProps {
  snapshot: RoomSnapshot | null;
  presentation?: "window" | "content";
}

export function WorldMapPanel({ snapshot, presentation = "window" }: WorldMapPanelProps) {
  const [open, setOpen] = useState(false);
  // The snapshot omits atlas keys entirely until something is discovered.
  const nodes = snapshot?.atlasNodes ?? [];
  const currentId = snapshot?.currentAtlasNodeId;
  const rows = atlasTreeRows(nodes);

  const content = (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "12px" }}>
      {rows.length === 0 ? (
        <JRPGPanel variant="simple" style={{ color: "var(--jrpg-white)", fontSize: "12px" }}>
          <span style={{ fontFamily: "var(--font-body)", lineHeight: 1.5 }}>
            The map is blank… for now. As your party discovers places, they appear here.
          </span>
        </JRPGPanel>
      ) : (
        <ul aria-label="Discovered world" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {rows.map(({ node, depth }) => {
            const isHere = node.id === currentId;
            return (
              <li
                key={node.id}
                aria-label={isHere ? `you are here: ${node.name}` : node.name}
                style={{
                  marginLeft: `${depth * 14}px`,
                  padding: "3px 0",
                  fontSize: "12px",
                  color: isHere ? "var(--jrpg-gold, #ffd75e)" : "var(--jrpg-white)",
                }}
              >
                <span aria-hidden="true">{KIND_GLYPH[node.kind] ?? "•"} </span>
                {node.name}
                {isHere && <span> ◀ you are here</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  if (presentation === "content") {
    return content;
  }

  return (
    <>
      {/* Left of the props launcher, so a table with both shows both. */}
      <div style={{ position: "fixed", bottom: "32px", right: "150px", zIndex: 150 }}>
        <JRPGButton
          onClick={() => setOpen((prev) => !prev)}
          variant={open ? "primary" : "default"}
          style={{ fontSize: "10px", padding: "10px 16px" }}
        >
          🗺 WORLD
        </JRPGButton>
      </div>

      {open && (
        <DraggableWindow
          title="World Map"
          onClose={() => setOpen(false)}
          initialX={typeof window !== "undefined" ? window.innerWidth - 420 : 100}
          initialY={140}
          width={360}
          minWidth={300}
          maxWidth={460}
          storageKey="world-map"
          zIndex={1002}
        >
          {content}
        </DraggableWindow>
      )}
    </>
  );
}
