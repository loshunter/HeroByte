import { useMemo, useState, type ReactNode } from "react";
import { CollectionPreview, CollectionSearch } from "../../components/ui/CollectionBrowser";
import {
  getMapStudioTileAsset,
  MAP_STUDIO_TILE_ASSETS,
  mapStudioTileCategoryLabel,
  type MapStudioTileAsset,
} from "../map-studio/starterTiles";
import { paletteAssetFromMyStuff } from "../map-studio/uploads/paletteAssets";
import { useMyStuffAssets } from "../map-studio/uploads/useMyStuffAssets";
import type { UploadedAssetInfo } from "../map-studio/uploads/assetUpload";

const CATEGORIES = ["objects", "structures", "terrain", "decals", "inlays", "my-stuff"] as const;
type Category = MapStudioTileAsset["category"];

/** Object browsing only; filters never change the armed id. */
export function useObjectCollection(
  selected: string,
  uploadAsset: (file: File) => Promise<UploadedAssetInfo>,
) {
  const myStuff = useMyStuffAssets(uploadAsset);
  const [picked, setPicked] = useState<Category | null>(null);
  const [query, setQuery] = useState("");
  const uploads = useMemo(() => myStuff.assets.map(paletteAssetFromMyStuff), [myStuff.assets]);
  const selectedAsset =
    uploads.find((asset) => asset.id === selected) ?? getMapStudioTileAsset(selected);
  const category = picked ?? (selectedAsset.id === "unknown" ? "objects" : selectedAsset.category);
  const shelf =
    category === "my-stuff"
      ? uploads
      : MAP_STUDIO_TILE_ASSETS.filter((asset) => asset.category === category);
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const assets = shelf.filter((asset) =>
    words.every((word) => asset.name.toLocaleLowerCase().includes(word)),
  );
  return {
    myStuff,
    selectedAsset,
    category,
    setCategory: setPicked,
    query,
    setQuery,
    assets,
    shelf,
  };
}

export function ObjectCollectionBrowser({
  collection,
  onSelect,
  children,
}: {
  collection: ReturnType<typeof useObjectCollection>;
  onSelect: (id: string) => void;
  children?: ReactNode;
}) {
  const { selectedAsset, category, setCategory, query, setQuery, assets, shelf } = collection;
  return (
    <div className="collection-browser">
      <CollectionPreview
        label="Selected object"
        name={selectedAsset.name}
        imageUrl={selectedAsset.imageUrl}
        fill={selectedAsset.fill}
        detail={`${selectedAsset.columns} × ${selectedAsset.rows} cells${selectedAsset.imageUrl ? "" : " · Color swatch"}`}
      />
      <div className="collection-categories" role="group" aria-label="Asset categories">
        {CATEGORIES.filter(
          (cat) =>
            cat === "my-stuff" || MAP_STUDIO_TILE_ASSETS.some((asset) => asset.category === cat),
        ).map((cat) => (
          <button
            type="button"
            key={cat}
            aria-pressed={category === cat}
            onClick={() => setCategory(cat)}
          >
            {cat === "my-stuff" ? "My uploads" : mapStudioTileCategoryLabel(cat)}
          </button>
        ))}
      </div>
      <CollectionSearch
        label="Search objects"
        value={query}
        onChange={setQuery}
        placeholder="Search this category"
      />
      {children}
      {category === "my-stuff" && (
        <p className="collection-note">
          Saved in this browser. Placed art is shared with the table.
        </p>
      )}
      {assets.length === 0 ? (
        <p className="collection-note">
          {query.trim()
            ? "No objects match. Try another search or category."
            : category === "my-stuff" && shelf.length === 0
              ? "Upload an image to place it on the map."
              : "No assets here."}
        </p>
      ) : (
        <div className="collection-grid" role="group" aria-label="Objects">
          {assets.map((asset) => (
            <button
              className="collection-tile"
              type="button"
              key={asset.id}
              title={asset.name}
              aria-pressed={asset.id === selectedAsset.id}
              onClick={() => onSelect(asset.id)}
            >
              {asset.imageUrl ? (
                <img className="collection-tile__art" src={asset.imageUrl} alt="" loading="lazy" />
              ) : (
                <span
                  className="collection-tile__art"
                  aria-hidden="true"
                  style={{ background: asset.fill, borderColor: asset.stroke }}
                />
              )}
              <span className="collection-tile__name">{asset.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
