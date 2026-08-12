// GENERATE on a phone: aim a region on the canvas, set the dials here, fire.
//
// Split from MobileMapEditToolPanels from the start rather than after it
// crosses the cap. This is the tallest panel and the only one with real
// conditional logic, and the repo's rule is to extract before adding.
//
// The worry that Generate's "dials" would be miserable on a phone turned out
// to be unfounded, and it is worth recording why rather than re-litigating it:
// the desktop panel has NO numeric input. Theme is two chips, density is three,
// and the seed is a read-only value with a reroll button — all of which are
// already touch-shaped. What actually needed work was the REFUSAL.
//
// canGenerate is false for four distinct reasons (no region yet, under 20 cells
// a side, over 16384 cells, or a command in flight) and until this slice the
// button just sat dead for all of them. The one place the reason was ever
// spoken was a toast inside onGenerate — unreachable, because the same
// condition that produces the reason is what disables the button. So the hint
// is rendered here, next to the control it explains.

import React from "react";
import type { MapEditToolbarProps, PopulateDensity } from "../mapEditTypes";
import { MobileSwatchRow } from "./MobileSwatchRow";

const THEMES: { id: "stone" | "wood"; label: string }[] = [
  { id: "stone", label: "🪨 Stone" },
  { id: "wood", label: "🪵 Wood" },
];

const DENSITIES: { id: PopulateDensity; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Med" },
  { id: "high", label: "High" },
];

export function MobileGeneratePanel({
  generateParams,
  onGenerateParamsChange,
  onRerollSeed,
  onGenerate,
  canGenerate,
  generateRegion,
  generateHint,
  busy,
}: MapEditToolbarProps): JSX.Element {
  return (
    <div className="mobile-tool-sheet__section" data-testid="mobile-generate-panel">
      <span className="mobile-tool-sheet__label">
        {generateRegion
          ? `Region: ${generateRegion.cols} × ${generateRegion.rows} cells`
          : "Drag a region on the map"}
      </span>

      <MobileSwatchRow
        label="Theme"
        options={THEMES}
        selected={generateParams.theme}
        onSelect={(theme) => onGenerateParamsChange({ ...generateParams, theme })}
      />
      <MobileSwatchRow
        label="Density"
        options={DENSITIES}
        selected={generateParams.density}
        onSelect={(density) => onGenerateParamsChange({ ...generateParams, density })}
      />

      <div className="mobile-tool-sheet__section">
        <span className="mobile-tool-sheet__label">Seed</span>
        <div className="mobile-tool-sheet__seed">
          {/* Shown rather than hidden because the same seed and dials rebuild
              the same dungeon, forever — that contract is the feature. */}
          <span data-testid="mobile-generate-seed">{generateParams.seed}</span>
          <button
            type="button"
            className="mobile-tool-sheet__button"
            onClick={onRerollSeed}
            aria-label="Roll a new seed"
          >
            ⟳
          </button>
        </div>
      </div>

      <button
        type="button"
        className="mobile-tool-sheet__button mobile-tool-sheet__button--wide"
        onClick={onGenerate}
        disabled={!canGenerate}
      >
        {busy ? "⏳ Generating…" : "🎲 Generate"}
      </button>

      {generateHint && (
        <p className="mobile-tool-sheet__note" role="status" data-testid="mobile-generate-hint">
          {generateHint}
        </p>
      )}

      <p className="mobile-tool-sheet__note">
        No secret doors yet — generated ones are readable by players. Place those by hand with the
        Door tool.
      </p>
    </div>
  );
}
