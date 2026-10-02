// Material shelves and cross-shelf search share the desktop catalog and local pins/recents.
// The armed preview remains visible when browsing hides its swatch. Keep the heavy
// procedural thumbnail baker in the lazy desktop chunk; the phone labels its color swatch.

import React, { useMemo, useState } from "react";
import { CollectionPreview, CollectionSearch } from "../../../components/ui/CollectionBrowser";
import type { TileMaterial } from "../../map-studio/starterTiles";
import {
  buildBrushDeckGroups,
  filterBrushEntries,
  loadBrushPins,
  loadBrushRecents,
  pushBrushRecent,
  toggleBrushPin,
} from "../brushDeck";
import { PAINT_FAMILIES } from "../mapEditFamilies";
import type { MapEditFloorFamily } from "../mapEditTypes";
import { MobileSwatchRow } from "./MobileSwatchRow";

interface MobileFloorPickerProps {
  label: string;
  selected: MapEditFloorFamily;
  onSelect: (family: MapEditFloorFamily) => void;
}

/** The two memory shelves sit before the material ones and are keyed apart from
 * TileMaterial so a shelf id can never collide with a material id. */
type ShelfId = TileMaterial | "pinned" | "recent";

export function MobileFloorPicker({
  label,
  selected,
  onSelect,
}: MobileFloorPickerProps): JSX.Element | null {
  const groups = useMemo(() => buildBrushDeckGroups(), []);
  const byFamily = useMemo(() => new Map(PAINT_FAMILIES.map((entry) => [entry.family, entry])), []);
  const [pickedShelf, setPickedShelf] = useState<ShelfId | null>(null);
  const [query, setQuery] = useState("");
  // Seeded from storage on mount and updated locally afterwards: the deck is
  // the only writer, and re-reading on every render would re-parse JSON for
  // nothing.
  const [pins, setPins] = useState<string[]>(loadBrushPins);
  const [recents, setRecents] = useState<string[]>(loadBrushRecents);

  if (groups.length === 0) return null;

  const resolve = (families: readonly string[]) =>
    families.map((family) => byFamily.get(family)).filter((entry) => entry !== undefined);

  const pinnedEntries = resolve(pins);
  const recentEntries = resolve(recents);

  const shelfOfSelected = groups.find((group) =>
    group.entries.some((entry) => entry.family === selected),
  )?.material;
  // A memory shelf that has gone empty must not stay open — it would render as
  // a heading over nothing and look like the picker had broken.
  const wanted = pickedShelf ?? shelfOfSelected ?? groups[0]!.material;
  const openShelf: ShelfId =
    (wanted === "pinned" && pinnedEntries.length === 0) ||
    (wanted === "recent" && recentEntries.length === 0)
      ? (shelfOfSelected ?? groups[0]!.material)
      : wanted;

  const entries =
    openShelf === "pinned"
      ? pinnedEntries
      : openShelf === "recent"
        ? recentEntries
        : (groups.find((group) => group.material === openShelf)?.entries ?? []);

  const shelves: { id: ShelfId; label: string }[] = [
    ...(pinnedEntries.length > 0 ? [{ id: "pinned" as const, label: "★" }] : []),
    ...(recentEntries.length > 0 ? [{ id: "recent" as const, label: "Recent" }] : []),
    ...groups.map((group) => ({ id: group.material as ShelfId, label: group.label })),
  ];

  const pick = (family: MapEditFloorFamily) => {
    onSelect(family);
    setRecents(pushBrushRecent(family));
  };

  const armedIsPinned = pins.includes(selected);
  const armedName = byFamily.get(selected)?.name ?? selected;
  const armed = byFamily.get(selected);
  const shown = query.trim() ? filterBrushEntries(PAINT_FAMILIES, query) : entries;

  return (
    <div className="mobile-tool-sheet__section">
      <span className="mobile-tool-sheet__label">{label}</span>
      {armed && (
        <CollectionPreview
          label="Selected material"
          name={armed.name}
          fill={armed.fill}
          detail="Color swatch · See the footprint on the map"
        />
      )}
      <CollectionSearch
        label="Search brushes"
        value={query}
        onChange={setQuery}
        placeholder="Search all materials"
      />
      {query.trim() && <p className="collection-note">Search results across all materials</p>}
      <div className="mobile-tool-sheet__shelves">
        {shelves.map((shelf) => (
          <button
            key={shelf.id}
            type="button"
            aria-pressed={!query.trim() && shelf.id === openShelf}
            className={`mobile-chip${shelf.id === openShelf ? " mobile-chip--active" : ""}`}
            onClick={() => {
              setPickedShelf(shelf.id);
              setQuery("");
            }}
          >
            {shelf.label}
          </button>
        ))}
      </div>
      <MobileSwatchRow
        ariaLabel={`${label} brushes`}
        options={shown.map((entry) => ({
          id: entry.family,
          label: entry.name,
          fill: entry.fill,
          stroke: entry.stroke,
        }))}
        selected={selected}
        onSelect={pick}
      />
      {shown.length === 0 && <p className="collection-note">No brush matches “{query.trim()}”.</p>}
      {/* Names the family rather than saying "Pin": the armed swatch can be off
          the open shelf entirely (★ and Recent both show families from other
          materials), so "Pin Stone Floor" is the only wording that says what
          the button will actually remember. */}
      <button
        type="button"
        aria-pressed={armedIsPinned}
        className={`mobile-tool-sheet__button mobile-tool-sheet__button--wide${
          armedIsPinned ? " mobile-tool-sheet__button--active" : ""
        }`}
        onClick={() => setPins(toggleBrushPin(selected))}
      >
        {armedIsPinned ? `★ Unpin ${armedName}` : `☆ Pin ${armedName}`}
      </button>
    </div>
  );
}
