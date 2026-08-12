// A labelled row of touch-sized choices — the phone's answer to the desktop
// MapEditSwatchGrid, which cannot be reused here for two reasons: its buttons
// are `fontSize: "8px", padding: "6px 2px"` (roughly 20px tall, half the touch
// floor), and importing it would drag the desktop map-edit chunk into the entry
// bundle that every PLAYER downloads.
//
// Every option is a `.mobile-tool-sheet__button` and the container is the
// sheet's own `.mobile-tool-sheet__grid`. That is deliberate rather than lazy:
// the 44px min-height and the 4-to-3 column drop under 420px both come from
// rules those classes already carry, so the touch floor here cannot be lost by
// editing this file, and a future change to the floor reaches these panels for
// free. No new button class is introduced by this slice.

import React from "react";

export interface MobileSwatchOption<T extends string | number> {
  id: T;
  label: string;
  /** Painted chip for a terrain family; omitted for plain choices like widths. */
  fill?: string;
  stroke?: string;
}

interface MobileSwatchRowProps<T extends string | number> {
  /** Omitted when a parent section already carries the heading. */
  label?: string;
  options: readonly MobileSwatchOption<T>[];
  selected: T;
  onSelect: (id: T) => void;
}

export function MobileSwatchRow<T extends string | number>({
  label,
  options,
  selected,
  onSelect,
}: MobileSwatchRowProps<T>): JSX.Element {
  return (
    <div className="mobile-tool-sheet__section">
      {label && <span className="mobile-tool-sheet__label">{label}</span>}
      <div className="mobile-tool-sheet__grid">
        {options.map((option) => (
          <button
            key={String(option.id)}
            type="button"
            // Selected state reaches a screen reader, not just a stylesheet.
            // The house convention already exists in the components these
            // replace — MapEditBrushDeck and the player dock both do this.
            aria-pressed={option.id === selected}
            className={`mobile-tool-sheet__button${
              option.id === selected ? " mobile-tool-sheet__button--active" : ""
            }`}
            onClick={() => onSelect(option.id)}
          >
            {option.fill && (
              <span
                className="mobile-swatch-chip"
                aria-hidden="true"
                style={{ background: option.fill, borderColor: option.stroke }}
              />
            )}
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
