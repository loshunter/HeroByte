// ============================================================================
// MOVEMENT SPEED FIELD (keyboard-movement arc, slice 3)
// ============================================================================
// A character's feet per turn — the movement budget's ceiling. One component,
// the same three homes as VisionRadiusField (the player card's settings menu,
// the NPC card's, the mobile entities list), and DM-only by the same
// construction: every call site supplies `onChange` only for a DM, and the
// server refuses the message from anyone else. A budget a player could raise
// is not a budget.
//
// Commits on blur or Enter, clamped to the shared bounds; an empty field
// reads as the shared default so the DM sees what an unset character gets.

import { useEffect, useState } from "react";
import {
  DEFAULT_MOVEMENT_SPEED_FEET,
  MOVEMENT_SPEED_MAX_FEET,
  MOVEMENT_SPEED_MIN_FEET,
} from "@herobyte/shared";

interface MovementSpeedFieldProps {
  /** Feet per turn; undefined means the shared default applies. */
  value?: number;
  onChange: (speedFeet: number) => void;
  /** 44px inputs for the mobile rows. */
  compact?: boolean;
}

export function clampSpeed(raw: string): number | null {
  const parsed = Number(raw);
  if (raw.trim() === "" || !Number.isFinite(parsed)) return null;
  return Math.min(MOVEMENT_SPEED_MAX_FEET, Math.max(MOVEMENT_SPEED_MIN_FEET, parsed));
}

export function MovementSpeedField({
  value,
  onChange,
  compact = false,
}: MovementSpeedFieldProps): JSX.Element {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  useEffect(() => {
    setText(value === undefined ? "" : String(value));
  }, [value]);

  const commit = () => {
    const speed = clampSpeed(text);
    if (speed === null) {
      setText(value === undefined ? "" : String(value));
      return;
    }
    setText(String(speed));
    if (speed !== value) onChange(speed);
  };

  return (
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
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
        style={{ width: compact ? "100%" : "110px", minHeight: compact ? "44px" : undefined }}
      />
    </label>
  );
}
