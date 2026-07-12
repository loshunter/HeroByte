// ============================================================================
// MAP-EDIT TOOLBAR (palette)
// ============================================================================
// Floating JRPG palette for live on-table map authoring (DM-only, lazy-loaded).
// Before a live map exists it shows START LIVE MAP; once bound it shows the
// authoring sub-tools + undo/redo. Same DraggableWindow shell as DrawingToolbar.

import { DraggableWindow } from "../../components/dice/DraggableWindow";
import { JRPGPanel, JRPGButton } from "../../components/ui/JRPGPanel";
import type { MapEditSubTool, MapEditToolbarProps } from "./mapEditTypes";

const SUB_TOOLS: { id: MapEditSubTool; label: string }[] = [
  { id: "wall", label: "🧱 Wall" },
  { id: "door", label: "🚪 Door" },
];

const labelStyle = {
  display: "block",
  marginBottom: "4px",
  color: "var(--jrpg-gold)",
} as const;

export function MapEditToolbar({
  isLive,
  busy,
  activeSubTool,
  onSelectSubTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onStartLiveMap,
  onClose,
  hasRasterBackground,
  error,
  wallsOverlayPinned,
  onToggleWallsOverlay,
}: MapEditToolbarProps) {
  return (
    <DraggableWindow
      title="🏗️ MAP TOOLS"
      onClose={onClose}
      initialX={8}
      initialY={100}
      width={230}
      minWidth={200}
      maxWidth={260}
      storageKey="map-edit-toolbar"
      zIndex={200}
    >
      <JRPGPanel variant="bevel" style={{ padding: "8px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {!isLive ? (
            <>
              <p className="jrpg-text-small" style={{ margin: 0, color: "var(--jrpg-white)" }}>
                Author the map on the live table. Rooms, walls, and doors appear for every player
                instantly.
              </p>
              <JRPGButton
                onClick={onStartLiveMap}
                variant="primary"
                disabled={busy}
                style={{ fontSize: "9px", padding: "8px" }}
              >
                {busy ? "STARTING…" : "▶ START LIVE MAP"}
              </JRPGButton>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span
                  className="jrpg-text-small"
                  style={{ color: "var(--jrpg-gold)", fontWeight: "bold" }}
                >
                  ● LIVE
                </span>
                {busy && (
                  <span className="jrpg-text-small" style={{ color: "var(--jrpg-white)" }}>
                    saving…
                  </span>
                )}
              </div>

              <div>
                <label className="jrpg-text-small" style={labelStyle}>
                  Tool:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                  {SUB_TOOLS.map((tool) => (
                    <JRPGButton
                      key={tool.id}
                      onClick={() => onSelectSubTool(tool.id)}
                      variant={activeSubTool === tool.id ? "primary" : "default"}
                      style={{ fontSize: "8px", padding: "6px 4px" }}
                    >
                      {tool.label}
                    </JRPGButton>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                <JRPGButton
                  onClick={onUndo}
                  variant="default"
                  disabled={!canUndo}
                  style={{ fontSize: "8px", padding: "6px" }}
                >
                  ↶ Undo
                </JRPGButton>
                <JRPGButton
                  onClick={onRedo}
                  variant="default"
                  disabled={!canRedo}
                  style={{ fontSize: "8px", padding: "6px" }}
                >
                  ↷ Redo
                </JRPGButton>
              </div>

              <JRPGButton
                onClick={onToggleWallsOverlay}
                variant={wallsOverlayPinned ? "primary" : "default"}
                title="Keep the walls overlay visible after leaving map-edit (always shown while editing)"
                style={{ fontSize: "8px", padding: "6px" }}
              >
                {wallsOverlayPinned ? "📐 Walls: pinned" : "📐 Pin walls overlay"}
              </JRPGButton>

              {hasRasterBackground && (
                <p
                  className="jrpg-text-small"
                  style={{ margin: 0, color: "var(--jrpg-white)", opacity: 0.8 }}
                >
                  ⚠ This room has a raster background — live terrain may draw over it. Clear it
                  from the DM menu for a clean live map.
                </p>
              )}
            </>
          )}

          {error && (
            <p
              className="jrpg-text-small"
              style={{ margin: 0, color: "var(--jrpg-danger, #ff6b6b)" }}
            >
              {error}
            </p>
          )}
        </div>
      </JRPGPanel>
    </DraggableWindow>
  );
}
