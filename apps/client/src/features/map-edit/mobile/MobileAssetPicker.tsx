// What Place and Scatter drop, chosen with a finger.
//
// Same shape as MobileFloorPicker and for the same arithmetic: the bundled
// catalog is far more than a sheet can show flat, so it is category chips
// first, then only that category's assets. The desktop MapEditAssetPicker
// solves it with a popover of tabs plus an upload button; this cannot import
// that component — MobileMapEditToolPanels is reachable from the ENTRY chunk,
// and a static import would drag the desktop map-edit chunk into every
// player's first load. The catalog data it reads is already in the entry
// chunk, so the shelves cost no new bytes.
//
// The open category FOLLOWS the armed asset until the DM picks one, exactly as
// the floor picker follows the armed family — opening on "Objects" while a
// structure is armed would read as having lost the selection.
//
// MY STUFF IS HERE NOW, and through ImageField rather than a port of the
// desktop popover — which is exactly what the scope note that used to sit here
// said it would want. ImageField is the one upload surface on this phone (its
// explicit accept list is also what makes iOS transcode a HEIC camera-roll
// photo instead of handing the server a file it rejects), and it is already in
// the entry chunk via the player card, so this costs no new upload machinery.
//
// The seam it leaves: ImageField commits a URL, never the File. So the hash is
// read back out of that URL (uploadHashFromUrl) and the footprint is measured
// from the URL — without which every uploaded image would place at 1x1, which
// is what getMapStudioTileAsset synthesizes for an id it has no record for.
// Arming on success is the point: a DM uploads in order to place.

import React, { useMemo, useState } from "react";
import {
  MAP_STUDIO_TILE_ASSETS,
  mapStudioTileCategoryLabel,
  type MapStudioTileAsset,
} from "../../map-studio/starterTiles";
import { paletteAssetFromMyStuff } from "../../map-studio/uploads/paletteAssets";
import { useMyStuffAssets } from "../../map-studio/uploads/useMyStuffAssets";
import type { UploadedAssetInfo } from "../../map-studio/uploads/assetUpload";
import { ImageField } from "../../../components/ui/ImageField";
import { MobileSwatchRow } from "./MobileSwatchRow";

/** The desktop picker's own order, my-stuff last exactly as it is there. */
const CATEGORIES = ["objects", "structures", "terrain", "decals", "inlays", "my-stuff"] as const;

type Category = (typeof CATEGORIES)[number];

interface MobileAssetPickerProps {
  label: string;
  selected: string;
  onSelect: (assetId: string) => void;
  /** The bag's uploader, for parity with the desktop shelf's batch path. */
  uploadAsset: (file: File) => Promise<UploadedAssetInfo>;
}

export function MobileAssetPicker({
  label,
  selected,
  onSelect,
  uploadAsset,
}: MobileAssetPickerProps): JSX.Element {
  const myStuff = useMyStuffAssets(uploadAsset);
  const [urlBuffer, setUrlBuffer] = useState("");

  const byCategory = useMemo(() => {
    const map = new Map<Category, MapStudioTileAsset[]>();
    for (const category of CATEGORIES) {
      map.set(
        category,
        category === "my-stuff"
          ? myStuff.assets.map(paletteAssetFromMyStuff)
          : MAP_STUDIO_TILE_ASSETS.filter((asset) => asset.category === category),
      );
    }
    return map;
  }, [myStuff.assets]);
  const [picked, setPicked] = useState<Category | null>(null);

  const categoryOfSelected = CATEGORIES.find((category) =>
    (byCategory.get(category) ?? []).some((asset) => asset.id === selected),
  );
  const open = picked ?? categoryOfSelected ?? "objects";
  const assets = byCategory.get(open) ?? [];
  const isMyStuff = open === "my-stuff";
  // A BUNDLED category the catalog has emptied must not render as a heading
  // over nothing; fall back to objects, which is never empty. My Stuff is
  // exempt — empty is its normal starting state and the upload field below is
  // the whole point of standing there.
  const shown = assets.length > 0 || isMyStuff ? assets : (byCategory.get("objects") ?? []);

  return (
    <div className="mobile-tool-sheet__section">
      <span className="mobile-tool-sheet__label">{label}</span>
      <div className="mobile-tool-sheet__shelves">
        {CATEGORIES.filter(
          // Empty bundled shelves stay hidden; My Stuff is always offered,
          // because hiding it until it has something would make the only way
          // to put something in it unreachable.
          (category) => category === "my-stuff" || (byCategory.get(category) ?? []).length > 0,
        ).map((category) => (
          <button
            key={category}
            type="button"
            aria-pressed={category === open}
            className={`mobile-chip${category === open ? " mobile-chip--active" : ""}`}
            onClick={() => setPicked(category)}
          >
            {mapStudioTileCategoryLabel(category)}
          </button>
        ))}
      </div>
      {isMyStuff && (
        <>
          <ImageField
            label="Upload art"
            value={urlBuffer}
            onChange={setUrlBuffer}
            onCommit={(url) => {
              if (!url) return;
              void myStuff.shelveUploadedUrl(url).then((assetId) => {
                // Arm what was just uploaded: a DM uploads in order to place.
                if (assetId) {
                  setUrlBuffer("");
                  onSelect(assetId);
                }
              });
            }}
            placeholder="Paste image URL"
            applyRequiresValue
          />
          {myStuff.error && (
            <p className="mobile-tool-sheet__note" role="alert">
              {myStuff.error}
            </p>
          )}
          {assets.length === 0 && !myStuff.error && (
            <p className="mobile-tool-sheet__note">Upload an image to place it on the map.</p>
          )}
        </>
      )}
      <MobileSwatchRow
        options={shown.map((asset) => ({
          id: asset.id,
          label: asset.name,
          fill: asset.fill,
          stroke: asset.stroke,
        }))}
        selected={selected}
        onSelect={onSelect}
      />
    </div>
  );
}
