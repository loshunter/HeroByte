// ============================================================================
// MOVEMENT SPEED FIELD (keyboard-movement arc, slice 3; the reset in F2)
// ============================================================================
// A character's feet per turn — the movement budget's ceiling. DM-only by
// construction, the vision-radius rule: every call site supplies `onChange`
// only for a DM, and the server refuses the message from anyone else. A
// budget a player could raise is not a budget.
//
// Commits on blur or Enter, clamped to the shared bounds; an emptied field
// returns the character to the shared default (the placeholder says which).
// Two homes: the player settings menu (the desktop card and the phone's EDIT
// sheet) for PCs, and the DM menu's NPC editor (both layouts) for monsters.
//
// With `budget`, the field also carries the DM's one lever over the SPEND: a
// readout of what the character has used this turn and a Reset that zeroes
// it outside a turn boundary (a mis-press, a re-adjudication, a spell). The
// budget is advisory — the owner's call — so the reset, like the readout, is
// the DM's business, never a refusal.

import { useEffect, useState } from "react";
import {
  DEFAULT_MOVEMENT_SPEED_FEET,
  MOVEMENT_SPEED_MAX_FEET,
  MOVEMENT_SPEED_MIN_FEET,
} from "@herobyte/shared";
import { JRPGButton } from "../../../components/ui/JRPGPanel";

/** The DM's reset control: what is spent, and the road to zero it. */
export interface MovementBudgetControl {
  /** Feet used this turn (the server's number). */
  used: number;
  onReset: () => void;
}

interface MovementSpeedFieldProps {
  /** Feet per turn; undefined means the shared default applies. */
  value?: number;
  /** A number, or null to return the character to the shared default. */
  onChange: (speedFeet: number | null) => void;
  /** The spend and its reset — DM-only, supplied only when the actor is one. */
  budget?: MovementBudgetControl;
  /** 44px inputs and buttons for the mobile rows. */
  compact?: boolean;
}

/** The plate's own overspend red (TokenNameplate's BAR_COLORS.low). */
export const OVERSPENT_COLOR = "#d63c53";

export function clampSpeed(raw: string): number | null {
  const parsed = Number(raw);
  if (raw.trim() === "" || !Number.isFinite(parsed)) return null;
  return Math.min(MOVEMENT_SPEED_MAX_FEET, Math.max(MOVEMENT_SPEED_MIN_FEET, parsed));
}

export function MovementSpeedField({
  value,
  onChange,
  budget,
  compact = false,
}: MovementSpeedFieldProps): JSX.Element {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  useEffect(() => {
    setText(value === undefined ? "" : String(value));
  }, [value]);

  const commit = (input: HTMLInputElement) => {
    const speed = clampSpeed(text);
    // A number input reports "" for anything it REJECTED (a stray keypad
    // character) as well as for a real clear; only the latter means "back to
    // the default" — the former snaps back to the value on file.
    if (speed === null) {
      if (text.trim() === "" && value !== undefined && !input.validity.badInput) onChange(null);
      else setText(value === undefined ? "" : String(value));
      return;
    }
    setText(String(speed));
    if (speed !== value) onChange(speed);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label
        className="jrpg-text-small"
        style={{ display: "flex", flexDirection: "column", gap: "6px", color: "var(--jrpg-gold)" }}
      >
        Speed (ft per turn)
        <input
          className="jrpg-input"
          type="number"
          inputMode="numeric"
          min={MOVEMENT_SPEED_MIN_FEET}
          max={MOVEMENT_SPEED_MAX_FEET}
          step={5}
          value={text}
          placeholder={`Default — ${DEFAULT_MOVEMENT_SPEED_FEET} ft`}
          aria-label="Movement speed in feet per turn"
          onChange={(event) => setText(event.target.value)}
          onBlur={(event) => commit(event.currentTarget)}
          onKeyDown={(event) => {
            if (event.key === "Enter") (event.target as HTMLInputElement).blur();
          }}
          style={{ width: compact ? "100%" : "110px", minHeight: compact ? "44px" : undefined }}
        />
      </label>
      {budget && (
        // Outside the label: a button inside one would also activate the input.
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {/* 11px: a number the DM acts on, not a label — and the same face in
              both homes (the NPC editor's body font would otherwise shrink it).
              Red past the speed, as the plate goes red: the one advisory
              signal the budget has, on the surface where the DM acts. */}
          <span
            className="jrpg-text-small"
            style={{
              color:
                budget.used > (value ?? DEFAULT_MOVEMENT_SPEED_FEET)
                  ? OVERSPENT_COLOR
                  : "var(--jrpg-gold)",
              whiteSpace: "nowrap",
              fontSize: "11px",
            }}
          >
            Used {budget.used} ft
          </span>
          <JRPGButton
            aria-label="Reset movement budget"
            disabled={budget.used === 0}
            onClick={budget.onReset}
            style={{ minHeight: compact ? "44px" : undefined }}
          >
            Reset
          </JRPGButton>
        </div>
      )}
    </div>
  );
}
