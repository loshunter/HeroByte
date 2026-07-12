// ============================================================================
// MAP-EDIT ASSET PICKER
// ============================================================================
// Compact asset popover for the live palette's place/scatter tools: category
// tabs, a swatch grid of starter tiles, and a "My Stuff" tab that uploads images
// through the shared controller (content-addressed — the same pipeline the
// Studio uses). Selecting an asset arms the place/scatter tool with it.

import { useMemo, useRef, useState } from "react";
import { JRPGButton } from "../../components/ui/JRPGPanel";
import {
  MAP_STUDIO_TILE_ASSETS,
  mapStudioTileCategoryLabel,
  type MapStudioTileAsset,
} from "../map-studio/starterTiles";
import { paletteAssetFromMyStuff } from "../map-studio/uploads/paletteAssets";
import { useMyStuffAssets } from "../map-studio/uploads/useMyStuffAssets";
import type { UploadedAssetInfo } from "../map-studio/uploads/assetUpload";

type Category = MapStudioTileAsset["category"];

const CATEGORIES: Category[] = ["objects", "structures", "terrain", "my-stuff"];

interface MapEditAssetPickerProps {
  selectedAssetId: string;
  onSelectAsset: (assetId: string) => void;
  uploadAsset: (file: File) => Promise<UploadedAssetInfo>;
}

export function MapEditAssetPicker({
  selectedAssetId,
  onSelectAsset,
  uploadAsset,
}: MapEditAssetPickerProps) {
  const [category, setCategory] = useState<Category>("objects");
  const fileRef = useRef<HTMLInputElement>(null);
  const myStuff = useMyStuffAssets(uploadAsset);

  const bundled = useMemo(
    () => MAP_STUDIO_TILE_ASSETS.filter((asset) => asset.category === category),
    [category],
  );
  const assets: MapStudioTileAsset[] =
    category === "my-stuff" ? myStuff.assets.map(paletteAssetFromMyStuff) : bundled;

  return (
    <div style={containerStyle}>
      <div style={tabRowStyle} role="tablist" aria-label="Asset categories">
        {CATEGORIES.map((cat) => (
          <JRPGButton
            key={cat}
            onClick={() => setCategory(cat)}
            variant={category === cat ? "primary" : "default"}
            style={tabStyle}
          >
            {mapStudioTileCategoryLabel(cat)}
          </JRPGButton>
        ))}
      </div>

      {category === "my-stuff" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <JRPGButton
            onClick={() => fileRef.current?.click()}
            variant="default"
            disabled={myStuff.busy}
            style={tabStyle}
          >
            {myStuff.busy ? "Uploading…" : "⬆ Upload image"}
          </JRPGButton>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            multiple
            style={{ display: "none" }}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length) void myStuff.uploadFiles(files);
              event.target.value = "";
            }}
          />
          {myStuff.error && (
            <p
              className="jrpg-text-small"
              style={{ margin: 0, color: "var(--jrpg-danger, #ff6b6b)" }}
            >
              {myStuff.error}
            </p>
          )}
        </div>
      )}

      <div style={gridStyle} role="listbox" aria-label="Assets">
        {assets.length === 0 ? (
          <p
            className="jrpg-text-small"
            style={{ margin: 0, color: "var(--jrpg-white)", opacity: 0.7 }}
          >
            {category === "my-stuff" ? "Upload an image to place it." : "No assets here."}
          </p>
        ) : (
          assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              role="option"
              aria-selected={asset.id === selectedAssetId}
              title={asset.name}
              onClick={() => onSelectAsset(asset.id)}
              style={swatchStyle(asset, asset.id === selectedAssetId)}
            >
              {asset.imageUrl ? (
                <img src={asset.imageUrl} alt={asset.name} style={swatchImageStyle} />
              ) : null}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

const containerStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  padding: "6px",
  background: "var(--jrpg-panel-dark, #1a1d29)",
  border: "1px solid var(--jrpg-gold)",
  borderRadius: "4px",
} as const;

const tabRowStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px" } as const;

const tabStyle = { fontSize: "8px", padding: "5px 3px" } as const;

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "4px",
  maxHeight: "140px",
  overflowY: "auto",
} as const;

const swatchImageStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  imageRendering: "pixelated",
} as const;

function swatchStyle(asset: MapStudioTileAsset, selected: boolean) {
  return {
    width: "100%",
    aspectRatio: "1 / 1",
    background: asset.fill,
    border: selected ? "2px solid var(--jrpg-gold)" : `2px solid ${asset.stroke}`,
    borderRadius: "2px",
    cursor: "pointer",
    padding: 0,
    overflow: "hidden",
  } as const;
}
