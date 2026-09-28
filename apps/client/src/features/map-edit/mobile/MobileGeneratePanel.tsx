// Phone Generate uses its own request outcome; other map edits remain Working.
import React, { useEffect, useRef } from "react";
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
  generateFeedback,
  saving,
}: MapEditToolbarProps): JSX.Element {
  const outcome = useRef<HTMLDivElement>(null);
  const status = generateFeedback?.status;
  useEffect(() => {
    if (status && status !== "idle") {
      // Keep the current result and recovery controls visible below a long palette.
      outcome.current?.scrollIntoView?.({ block: "nearest", behavior: "instant" });
    }
  }, [status, generateHint]);
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

      <div ref={outcome}>
        <button
          type="button"
          className="mobile-tool-sheet__button mobile-tool-sheet__button--wide"
          data-testid="mobile-generate-fire"
          onClick={onGenerate}
          disabled={!canGenerate}
        >
          {generateFeedback?.status === "pending"
            ? "⏳ Generating…"
            : saving
              ? "⏳ Working…"
              : "🎲 Generate in this area"}
        </button>

        {generateHint && (
          <p className="mobile-tool-sheet__note" role="status" data-testid="mobile-generate-hint">
            {generateHint}
          </p>
        )}

        {generateFeedback?.recovery && (
          <div className="mobile-tool-sheet__section">
            <button
              type="button"
              className="mobile-tool-sheet__button mobile-tool-sheet__button--wide"
              onClick={generateFeedback.recovery.refresh}
              disabled={generateFeedback.recovery.refreshing}
            >
              {generateFeedback.recovery.refreshing ? "Refreshing…" : "Refresh map"}
            </button>
            <button
              type="button"
              className="mobile-tool-sheet__button mobile-tool-sheet__button--wide"
              onClick={generateFeedback.recovery.acknowledge}
              disabled={!generateFeedback.recovery.canAcknowledge}
            >
              I&apos;ve checked the map
            </button>
          </div>
        )}
      </div>

      <p className="mobile-tool-sheet__note">
        No secret doors yet — generated ones are readable by players. Place those by hand with the
        Door tool.
      </p>
    </div>
  );
}
