// POPULATE on a phone: fill the room or hallway you JUST drew with set dressing.
//
// It is a footer rather than a tool tile because it is not a sub-tool — there
// is nothing to arm and nothing to drag. It fires against the last region the
// DM placed. That also means it has nowhere else to live: with no tile and no
// dock slot free, a DM on a phone could not reach Populate at all.
//
// The adjacency rule ("the last one you placed") is the thing the arc doc flags
// as invisible in a sheet-based UI. Two thirds of that turned out to be already
// solved and unnoticed: usePopulate builds previewGhosts from the same builder
// and the same bounds-derived seed the button commits, and MobileLayout already
// forwards them to MapBoard — so a phone DM who drags a room ALREADY sees
// translucent footprints of exactly what will land, and they re-render live
// when the density changes. What was missing was the sentence, not the
// affordance.
//
// The message is three-state, and that is not decoration. canPopulate is
// `regionIsLive && !saving`, so for the ~300ms a placement is in flight a
// two-state message would tell the DM to draw a room they drew a moment ago.

import React from "react";
import type { MapEditToolbarProps, PopulateCategory, PopulateDensity } from "../mapEditTypes";
import { MobileSwatchRow } from "./MobileSwatchRow";

const CATEGORIES: { id: PopulateCategory; label: string }[] = [
  { id: "objects", label: "Objects" },
  { id: "structures", label: "Structs" },
  { id: "terrain", label: "Terrain" },
  { id: "decals", label: "Wear" },
];

const DENSITIES: { id: PopulateDensity; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Med" },
  { id: "high", label: "High" },
];

export function MobilePopulateBlock({
  saving,
  canPopulate,
  populateCategory,
  onSelectPopulateCategory,
  populateDensity,
  onSelectPopulateDensity,
  onPopulate,
}: MapEditToolbarProps): JSX.Element {
  const status = saving
    ? "Saving…"
    : canPopulate
      ? "Fills the room you just drew."
      : "Draw a room or hallway first — Populate fills the last one you placed.";

  return (
    <div className="mobile-tool-sheet__section" data-testid="mobile-populate">
      <span className="mobile-tool-sheet__label">✨ Populate</span>
      <p className="mobile-tool-sheet__note" data-testid="mobile-populate-status">
        {status}
      </p>

      {/* The dials appear only once a region is armed: their presence is itself
          a signal that there is something to fill. */}
      {canPopulate && (
        <>
          <MobileSwatchRow
            label="From"
            options={CATEGORIES}
            selected={populateCategory}
            onSelect={onSelectPopulateCategory}
          />
          <MobileSwatchRow
            label="How much"
            options={DENSITIES}
            selected={populateDensity}
            onSelect={onSelectPopulateDensity}
          />
        </>
      )}

      <button
        type="button"
        className="mobile-tool-sheet__button mobile-tool-sheet__button--wide"
        onClick={onPopulate}
        disabled={!canPopulate}
      >
        ✨ Populate
      </button>
    </div>
  );
}
