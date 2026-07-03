import type { ReactNode } from "react";
import type { MapElement, MapLayer } from "@herobyte/shared";
import { JRPGButton } from "../../../components/ui/JRPGPanel";
import {
  MAP_STUDIO_TILE_ASSETS,
  mapStudioTileCategoryLabel,
  type MapStudioTileAsset,
} from "../starterTiles";
import type { TileCategory } from "./MapStudioWorkspace.types";
import { paletteStyle } from "./mapStudioWorkspaceStyles";

interface MapStudioPaletteProps {
  /** Extra panels stacked under the palette in the same right rail. */
  children?: ReactNode;
  category: TileCategory;
  selectedAssetId: string;
  roomFillAssetId: string;
  roomWallAssetId: string;
  visibleAssets: MapStudioTileAsset[];
  floorAssets: MapStudioTileAsset[];
  wallAssets: MapStudioTileAsset[];
  selectedElement?: MapElement;
  selectedLayer?: MapLayer;
  saving: boolean;
  onCategorySelect: (category: TileCategory, fallbackAssetId: string) => void;
  onAssetSelect: (asset: MapStudioTileAsset) => void;
  onRoomFillAssetIdChange: (assetId: string) => void;
  onRoomWallAssetIdChange: (assetId: string) => void;
  onDeleteSelected: () => void;
}

export function MapStudioPalette({
  children,
  category,
  selectedAssetId,
  roomFillAssetId,
  roomWallAssetId,
  visibleAssets,
  floorAssets,
  wallAssets,
  selectedElement,
  selectedLayer,
  saving,
  onCategorySelect,
  onAssetSelect,
  onRoomFillAssetIdChange,
  onRoomWallAssetIdChange,
  onDeleteSelected,
}: MapStudioPaletteProps) {
  return (
    <aside style={paletteStyle} aria-label="Map Studio palette">
      <div className="jrpg-text-small" style={{ color: "var(--jrpg-gold)", marginBottom: 8 }}>
        Tile Palette
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {(["terrain", "structures", "objects"] as TileCategory[]).map((item) => (
          <JRPGButton
            key={item}
            variant={category === item ? "primary" : "default"}
            style={{ fontSize: 8, padding: "5px 7px" }}
            onClick={() =>
              onCategorySelect(
                item,
                MAP_STUDIO_TILE_ASSETS.find((asset) => asset.category === item)?.id ??
                  selectedAssetId,
              )
            }
          >
            {mapStudioTileCategoryLabel(item)}
          </JRPGButton>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {visibleAssets.map((asset) => (
          <button
            key={asset.id}
            aria-label={`Choose ${asset.name}`}
            onClick={() => onAssetSelect(asset)}
            style={{
              minHeight: 74,
              background: selectedAssetId === asset.id ? "#243f75" : "#151925",
              color: "#f0e2c3",
              border: `2px solid ${selectedAssetId === asset.id ? "#7fd6ff" : "#8a7445"}`,
              display: "grid",
              gap: 4,
              placeItems: "center",
              padding: 8,
              textTransform: "none",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: Math.min(58, 28 * asset.columns),
                height: Math.min(58, 28 * asset.rows),
                background: asset.fill,
                border: `2px solid ${asset.stroke}`,
                display: "block",
                boxShadow: `inset 0 0 0 3px ${asset.accent ?? "rgba(0,0,0,0.25)"}`,
              }}
            />
            <span style={{ fontSize: 8, lineHeight: 1.2 }}>{asset.name}</span>
          </button>
        ))}
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.18)", marginTop: 12, paddingTop: 10 }}>
        <div className="jrpg-text-small" style={{ marginBottom: 6 }}>
          Room Brush
        </div>
        <label className="jrpg-text-small" style={{ display: "grid", gap: 4 }}>
          Fill
          <select
            aria-label="Room fill tile"
            value={roomFillAssetId}
            onChange={(event) => onRoomFillAssetIdChange(event.target.value)}
          >
            {floorAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>
        </label>
        <label className="jrpg-text-small" style={{ display: "grid", gap: 4, marginTop: 8 }}>
          Wall
          <select
            aria-label="Room wall tile"
            value={roomWallAssetId}
            onChange={(event) => onRoomWallAssetIdChange(event.target.value)}
          >
            <option value="">None</option>
            {wallAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.18)", marginTop: 12, paddingTop: 10 }}>
        <div className="jrpg-text-small" style={{ marginBottom: 6 }}>
          Selected
        </div>
        {selectedElement && selectedLayer ? (
          <div className="jrpg-text-small" style={{ display: "grid", gap: 6 }}>
            <span>
              {selectedElement.type.toUpperCase()} · {selectedLayer.name}
            </span>
            <span>
              X {Math.round(selectedElement.transform.x)} · Y{" "}
              {Math.round(selectedElement.transform.y)}
            </span>
            <JRPGButton
              variant="danger"
              disabled={saving || selectedElement.locked || selectedLayer.locked}
              onClick={onDeleteSelected}
            >
              DELETE
            </JRPGButton>
          </div>
        ) : (
          <span className="jrpg-text-small">None</span>
        )}
      </div>
      {children}
    </aside>
  );
}
