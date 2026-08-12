// The floor/paint family picker, shelved.
//
// This is the one panel that does NOT simply shrink its desktop counterpart,
// and the reason is arithmetic. There are 38 `terrain:` families in the bundled
// catalog. A flat grid of them at the 44px touch floor is ~13 rows, roughly
// 570px — taller than the entire sheet cap in landscape (~240px), so the DM
// would scroll a wall of chips to reach a floor. The desktop MapEditBrushDeck
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

import React, { useMemo, useState } from "react";
import type { TileMaterial } from "../../map-studio/starterTiles";
import { buildBrushDeckGroups } from "../brushDeck";
import type { MapEditFloorFamily } from "../mapEditTypes";
import { MobileSwatchRow } from "./MobileSwatchRow";

interface MobileFloorPickerProps {
  label: string;
  selected: MapEditFloorFamily;
  onSelect: (family: MapEditFloorFamily) => void;
}

export function MobileFloorPicker({
  label,
  selected,
  onSelect,
}: MobileFloorPickerProps): JSX.Element | null {
  const groups = useMemo(() => buildBrushDeckGroups(), []);
  const [pickedShelf, setPickedShelf] = useState<TileMaterial | null>(null);

  if (groups.length === 0) return null;

  const shelfOfSelected = groups.find((group) =>
    group.entries.some((entry) => entry.family === selected),
  )?.material;
  const openShelf = pickedShelf ?? shelfOfSelected ?? groups[0]!.material;
  const entries = groups.find((group) => group.material === openShelf)?.entries ?? [];

  return (
    <div className="mobile-tool-sheet__section">
      <span className="mobile-tool-sheet__label">{label}</span>
      <div className="mobile-tool-sheet__shelves">
        {groups.map((group) => (
          <button
            key={group.material}
            type="button"
            className={`mobile-chip${group.material === openShelf ? " mobile-chip--active" : ""}`}
            onClick={() => setPickedShelf(group.material)}
          >
            {group.label}
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
        onSelect={onSelect}
      />
    </div>
  );
}
