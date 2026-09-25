// Contextual decoration for the last room/hallway, alongside its placement
// settings. The hook owns target identity, readiness and pending-state copy;
// the canvas shows the named bounds and the same draft footprints we commit.

import React from "react";
import type { MapEditToolbarProps, PopulateCategory, PopulateDensity } from "../mapEditTypes";
import { MobileSwatchRow } from "./MobileSwatchRow";
import { decorateLabel } from "../populateTarget";

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
  populateTarget,
  populateHint,
  canPopulate,
  populateCategory,
  onSelectPopulateCategory,
  populateDensity,
  onSelectPopulateDensity,
  onPopulate,
}: MapEditToolbarProps): JSX.Element {
  return (
    <div className="mobile-tool-sheet__section" data-testid="mobile-populate">
      <span className="mobile-tool-sheet__label">✨ Decorate the last placed area</span>
      <p className="mobile-tool-sheet__note" data-testid="mobile-populate-status">
        {populateHint}
      </p>

      {/* The dials appear only once a region is armed: their presence is itself
          a signal that there is something to fill. */}
      {populateTarget && (
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
        ✨ {decorateLabel(populateTarget)}
      </button>
    </div>
  );
}
