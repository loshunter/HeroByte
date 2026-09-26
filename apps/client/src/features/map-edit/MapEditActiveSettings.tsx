// Active-tool dials extracted unchanged before U3b's palette rearrangement.
import { JRPGButton } from "../../components/ui/JRPGPanel";
import { getMapStudioTileAsset } from "../map-studio/starterTiles";
import { MapEditAssetPicker } from "./MapEditAssetPicker";
import { MapEditBrushDeck } from "./MapEditBrushDeck";
import { TerrainBrushSizeControl } from "./TerrainBrushSizeControl";
import { MapEditSwatchGrid } from "./MapEditSwatchGrid";
import { WALL_FAMILIES } from "./mapEditFamilies";
import type { MapEditToolbarProps, MapEditWallFamily } from "./mapEditTypes";
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

export function MapEditActiveSettings({
  activeSubTool,
  floorFamily,
  onSelectFloorFamily,
  roomWallFamily,
  onSelectRoomWallFamily,
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
  terrainBrushSize,
  onSelectTerrainBrushSize,
}: MapEditToolbarProps) {
  const placing =
    activeSubTool === "place" || activeSubTool === "scatter" || activeSubTool === "row";
  const paintsFloor =
    activeSubTool === "room" || activeSubTool === "terrain" || activeSubTool === "hallway";
  const selectedAssetName = getMapStudioTileAsset(selectedAssetId).name;
  return (
    <>
      {(activeSubTool === "terrain" || activeSubTool === "erase") && (
        <TerrainBrushSizeControl size={terrainBrushSize} onChange={onSelectTerrainBrushSize} />
      )}
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
          Click to place a torch pool. The Lighting layer&apos;s opacity (🗂 Layers) is the ambient
          light: 1 = day, lower = night — pools glow once it drops.
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
          {/* Rotation reaches ONLY a free stamp: scatter and row roll
        their angles from their own seeds, so this pair showed
        under Scatter always — and under Row whenever stamp mode
        was left sticky-on from Place — turning nothing. */}
          {activeSubTool === "place" && stampMode && (
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
    </>
  );
}
