// The floor/paint family picker, shelved.
//
// This is the one panel that does NOT simply shrink its desktop counterpart,
// and the reason is arithmetic. PAINT_FAMILIES is 19 — the catalog holds 38
// `terrain:` assets, but only those with a VILLAGE_TERRAIN palette entry are
// paintable, and that intersection is 19. A flat grid of them at the 44px touch
// floor is 7 rows, roughly 385px — still taller than the entire sheet cap in
// landscape (~240px), so the DM would scroll a wall of chips to reach a floor.
// (An earlier version of this comment said 38 and ~570px, counting the catalog
// rather than the palette-backed subset the picker actually renders. The
// conclusion held; the number did not.) The desktop MapEditBrushDeck
// solves the same problem with a hover preview card, a search box and
// right-click-to-pin; a finger has none of those.
//
// So: material shelves first, then only that shelf's families. Two taps to any
// floor, and the shelves come from buildBrushDeckGroups() — the same pure data
// the desktop deck uses, already in the entry chunk via useMapEditState, so
// this costs no new bytes and a new family appears on both surfaces from one
// catalog edit.
//
// The open shelf FOLLOWS the armed family until the DM picks a shelf. Opening
// on "Ground" while a Stone floor is armed would hide the selection and read as
// having lost it.
//
// M6 added the two shelves that make this a deck rather than a browser. ★ and
// Recent read and write the SAME localStorage keys the desktop deck uses
// (brushDeck.ts), so within one browser the desktop and mobile layouts share
// one memory rather than two that quietly disagree. localStorage is
// per-browser, so pins do NOT follow a DM from a desk PC to a tablet — the
// user guide once claimed they did, and it was wrong.
// Pinning is a right-click on the desktop, which a finger cannot
// make, so the touch affordance is a single button under the swatches that
// pins whatever is armed — one control instead of a per-tile one, because a
// 19-tile grid with a star on every chip is how the 44px floor gets lost.

import React, { useMemo, useState } from "react";
import type { TileMaterial } from "../../map-studio/starterTiles";
import {
  buildBrushDeckGroups,
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

  return (
    <div className="mobile-tool-sheet__section">
      <span className="mobile-tool-sheet__label">{label}</span>
      <div className="mobile-tool-sheet__shelves">
        {shelves.map((shelf) => (
          <button
            key={shelf.id}
            type="button"
            aria-pressed={shelf.id === openShelf}
            className={`mobile-chip${shelf.id === openShelf ? " mobile-chip--active" : ""}`}
            onClick={() => setPickedShelf(shelf.id)}
          >
            {shelf.label}
          </button>
        ))}
      </div>
      <MobileSwatchRow
        options={entries.map((entry) => ({
          id: entry.family,
          label: entry.name,
          fill: entry.fill,
          stroke: entry.stroke,
        }))}
        selected={selected}
        onSelect={pick}
      />
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
