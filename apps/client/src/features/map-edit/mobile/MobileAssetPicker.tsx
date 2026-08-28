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
// MY STUFF IS DELIBERATELY ABSENT. The desktop picker's sixth tab uploads an
// image through the controller and arms it; that needs the upload pipeline,
// its quota errors and a file input, none of which are in this bag. Leaving it
// out is a scope line, not an oversight: a DM on a phone can place every
// bundled asset and must reach a desktop for their own art. When that changes,
// it wants ImageField (the surface every other upload on the phone already
// goes through) rather than a port of the popover.

import React, { useMemo, useState } from "react";
import {
  MAP_STUDIO_TILE_ASSETS,
  mapStudioTileCategoryLabel,
  type MapStudioTileAsset,
} from "../../map-studio/starterTiles";
import { MobileSwatchRow } from "./MobileSwatchRow";

/** The bundled categories, in the desktop picker's own order. "my-stuff" is
 * not one of them here — see the note above. */
const CATEGORIES = ["objects", "structures", "terrain", "decals", "inlays"] as const;

type Category = (typeof CATEGORIES)[number];

interface MobileAssetPickerProps {
  label: string;
  selected: string;
  onSelect: (assetId: string) => void;
}

export function MobileAssetPicker({
  label,
  selected,
  onSelect,
}: MobileAssetPickerProps): JSX.Element {
  const byCategory = useMemo(() => {
    const map = new Map<Category, MapStudioTileAsset[]>();
    for (const category of CATEGORIES) {
      map.set(
        category,
        MAP_STUDIO_TILE_ASSETS.filter((asset) => asset.category === category),
      );
    }
    return map;
  }, []);
  const [picked, setPicked] = useState<Category | null>(null);

  const categoryOfSelected = CATEGORIES.find((category) =>
    (byCategory.get(category) ?? []).some((asset) => asset.id === selected),
  );
  const open = picked ?? categoryOfSelected ?? "objects";
  // A category the catalog has emptied must not render as a heading over
  // nothing; fall back to objects, which is never empty.
  const assets = byCategory.get(open) ?? [];
  const shown = assets.length > 0 ? assets : (byCategory.get("objects") ?? []);

  return (
    <div className="mobile-tool-sheet__section">
      <span className="mobile-tool-sheet__label">{label}</span>
      <div className="mobile-tool-sheet__shelves">
        {CATEGORIES.filter((category) => (byCategory.get(category) ?? []).length > 0).map(
          (category) => (
            <button
              key={category}
              type="button"
              aria-pressed={category === open}
              className={`mobile-chip${category === open ? " mobile-chip--active" : ""}`}
              onClick={() => setPicked(category)}
            >
              {mapStudioTileCategoryLabel(category)}
            </button>
          ),
        )}
      </div>
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
