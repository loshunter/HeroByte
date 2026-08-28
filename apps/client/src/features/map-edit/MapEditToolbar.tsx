// ============================================================================
// MAP-EDIT TOOLBAR (palette)
// ============================================================================
// Floating JRPG palette for live on-table map authoring (DM-only, lazy-loaded).
// Before a live map exists it shows START LIVE MAP; once bound it shows the
// authoring sub-tools + undo/redo. Same DraggableWindow shell as DrawingToolbar.

import { DraggableWindow } from "../../components/dice/DraggableWindow";
import { JRPGPanel, JRPGButton } from "../../components/ui/JRPGPanel";
import { getMapStudioTileAsset } from "../map-studio/starterTiles";
import { MapEditAssetPicker } from "./MapEditAssetPicker";
import { MapEditBrushDeck } from "./MapEditBrushDeck";
import { MapEditSwatchGrid } from "./MapEditSwatchGrid";
import { MapEditToolPanels } from "./MapEditToolPanels";
import { WALL_FAMILIES } from "./mapEditFamilies";
import type { MapEditSubTool, MapEditToolbarProps, MapEditWallFamily } from "./mapEditTypes";

const SUB_TOOLS: { id: MapEditSubTool; label: string }[] = [
  { id: "room", label: "🏠 Room" },
  { id: "hallway", label: "🚇 Hall" },
  { id: "wall", label: "🧱 Wall" },
  { id: "door", label: "🚪 Door" },
  { id: "light", label: "💡 Light" },
  { id: "terrain", label: "🖌️ Paint" },
  { id: "erase", label: "🧹 Erase" },
  { id: "place", label: "📦 Place" },
  { id: "scatter", label: "🎲 Scatter" },
  { id: "row", label: "📏 Row" },
  { id: "select", label: "👆 Select" },
  { id: "generate", label: "🏰 Gen" },
  { id: "spline", label: "〰️ Spline" },
];

/** The Room tool's wall-ring choices: a material, or no ring at all. Derived
 * from the palette's wall families; "Stone Wall" swatches as "Stone". */
const ROOM_WALL_CHOICES: { id: MapEditWallFamily | "none"; label: string }[] = [
  { id: "none", label: "None" },
  ...WALL_FAMILIES.map((family) => ({
    id: family,
    label: getMapStudioTileAsset(`terrain:${family}`).name.replace(/ Wall$/, ""),
  })),
];

const HALLWAY_WIDTHS = [1, 2, 3, 4];

const labelStyle = {
  display: "block",
  marginBottom: "4px",
  color: "var(--jrpg-gold)",
} as const;

export function MapEditToolbar(props: MapEditToolbarProps) {
  const {
    isLive,
    busy,
    saving,
    activeSubTool,
    onSelectSubTool,
    floorFamily,
    onSelectFloorFamily,
    roomWallFamily,
    onSelectRoomWallFamily,
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
    selectedAssetId,
    onSelectAsset,
    uploadAsset,
    assetPickerOpen,
    onToggleAssetPicker,
    stampMode,
    onToggleStampMode,
    stampRotation,
    onRotateStamp,
    hallwayWidth,
    onSelectHallwayWidth,
  } = props;
  const placing =
    activeSubTool === "place" || activeSubTool === "scatter" || activeSubTool === "row";
  const paintsFloor =
    activeSubTool === "room" || activeSubTool === "terrain" || activeSubTool === "hallway";
  const selectedAssetName = getMapStudioTileAsset(selectedAssetId).name;
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
                {/* Two flags, two words, and the split is the whole point.
                    `busy` is the create/open/bind round trip; `saving` is a map
                    command in flight — and `saving` is the one that silently
                    SKIPS a gesture (useMapEditTool's mouse-up gate). This span
                    read "saving…" off `busy` from M1 to M5, so the only
                    in-flight label in the app was absent during exactly the
                    window it appeared to name. Folding the two into one flag
                    was the tempting fix and is wrong: everything gated on
                    `busy` would flicker-disable on every command. */}
                {busy && (
                  <span className="jrpg-text-small" style={{ color: "var(--jrpg-white)" }}>
                    loading…
                  </span>
                )}
                {saving && (
                  <span className="jrpg-text-small" style={{ color: "var(--jrpg-white)" }}>
                    saving…
                  </span>
                )}
              </div>

              <div>
                <label className="jrpg-text-small" style={labelStyle}>
                  Tool:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px" }}>
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

              {paintsFloor && (
                // The brush deck shows for EVERY tool that consumes the paint
                // family (not just Paint): the swatch state is shared, so a
                // wall/roof family armed by the brush or the eyedropper must
                // stay visible — and deliberately re-selectable — when the DM
                // switches to Room or Hall (a solid wall/roof mass is a legit
                // room fill).
                <MapEditBrushDeck selected={floorFamily} onSelect={onSelectFloorFamily} />
              )}

              {activeSubTool === "light" && (
                <p
                  className="jrpg-text-small"
                  style={{ margin: 0, color: "var(--jrpg-white)", opacity: 0.8 }}
                >
                  Click to place a torch pool. The Lighting layer&apos;s opacity (🗂 Layers) is the
                  ambient light: 1 = day, lower = night — pools glow once it drops.
                </p>
              )}

              {(activeSubTool === "room" || activeSubTool === "hallway") && (
                <MapEditSwatchGrid
                  label={activeSubTool === "room" ? "Wall ring:" : "Side walls:"}
                  options={ROOM_WALL_CHOICES}
                  selected={roomWallFamily}
                  onSelect={onSelectRoomWallFamily}
                />
              )}

              {activeSubTool === "hallway" && (
                <MapEditSwatchGrid
                  label="Width (cells):"
                  options={HALLWAY_WIDTHS.map((w) => ({ id: w, label: String(w) }))}
                  selected={hallwayWidth}
                  onSelect={onSelectHallwayWidth}
                  columns={4}
                />
              )}

              {placing && (
                <div>
                  <label className="jrpg-text-small" style={labelStyle}>
                    Asset:
                  </label>
                  <JRPGButton
                    onClick={onToggleAssetPicker}
                    variant={assetPickerOpen ? "primary" : "default"}
                    style={{ fontSize: "8px", padding: "6px 4px", width: "100%" }}
                  >
                    {assetPickerOpen ? "▾ " : "▸ "}
                    {selectedAssetName}
                  </JRPGButton>
                  {assetPickerOpen && (
                    <div style={{ marginTop: "4px" }}>
                      <MapEditAssetPicker
                        selectedAssetId={selectedAssetId}
                        onSelectAsset={onSelectAsset}
                        uploadAsset={uploadAsset}
                      />
                    </div>
                  )}
                  <p
                    className="jrpg-text-small"
                    style={{ margin: "4px 0 0", color: "var(--jrpg-white)", opacity: 0.7 }}
                  >
                    {activeSubTool === "place"
                      ? "Click to place · Alt = free stamp · R rotates"
                      : activeSubTool === "row"
                        ? "Drag a line — stamps repeat with seeded jitter and skips"
                        : "Click to scatter a seeded cluster"}
                  </p>
                  {/* The controls M7 built for the phone, shown here too. Alt
                      and R are faster and are staying, but they left the armed
                      state INVISIBLE: a DM who stamped on a tablet and rotated
                      the window into this layout had a stamp mode showing
                      nowhere. Both write the same state (usePlacementDials), so
                      this is a readout as much as a control. */}
                  {activeSubTool === "place" && (
                    <JRPGButton
                      onClick={onToggleStampMode}
                      variant={stampMode ? "primary" : "default"}
                      style={{ fontSize: "8px", padding: "6px 4px", width: "100%", marginTop: 4 }}
                    >
                      {stampMode ? "◆ Free stamp" : "▦ Grid tile"}
                    </JRPGButton>
                  )}
                  {(stampMode || activeSubTool === "scatter") && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "4px",
                        marginTop: "4px",
                      }}
                    >
                      <JRPGButton
                        onClick={() => onRotateStamp(-1)}
                        style={{ fontSize: "8px", padding: "6px 4px" }}
                        title="Rotate counter-clockwise (Shift+R)"
                      >
                        ↺ {stampRotation}°
                      </JRPGButton>
                      <JRPGButton
                        onClick={() => onRotateStamp(1)}
                        style={{ fontSize: "8px", padding: "6px 4px" }}
                        title="Rotate clockwise (R)"
                      >
                        ↻
                      </JRPGButton>
                    </div>
                  )}
                </div>
              )}

              <MapEditToolPanels {...props} />

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
