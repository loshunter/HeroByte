// ============================================================================
// ROLL OPTIONS — advantage/disadvantage and who sees the result
// ============================================================================
// One component for both surfaces. The mobile dock is a hardcoded 5-column
// grid (herobyte.css), so a new control cannot become a sixth dock button;
// putting these inside the roller itself is how they reach a phone at all —
// the same reasoning that made chat a tab in the roll log rather than a
// button of its own.

import React from "react";
import type { DiceRollMode, DiceVisibility } from "@herobyte/shared";
import { JRPGButton } from "../ui/JRPGPanel";

interface RollOptionsProps {
  mode: DiceRollMode;
  onModeChange: (mode: DiceRollMode) => void;
  visibility: DiceVisibility;
  onVisibilityChange: (visibility: DiceVisibility) => void;
  disabled?: boolean;
  /** Touch targets and labels grow on the mobile overlay. */
  compact?: boolean;
}

const MODES: { value: DiceRollMode; label: string; title: string }[] = [
  { value: "normal", label: "NORMAL", title: "Roll once" },
  { value: "advantage", label: "ADV", title: "Roll the first die twice, keep the higher" },
  { value: "disadvantage", label: "DIS", title: "Roll the first die twice, keep the lower" },
];

const VISIBILITIES: { value: DiceVisibility; label: string; title: string }[] = [
  { value: "public", label: "TABLE", title: "Everyone sees this roll" },
  { value: "dm", label: "DM", title: "Only you and the DM see this roll" },
  { value: "self", label: "ME", title: "Only you see this roll — the DM included" },
];

export const RollOptions: React.FC<RollOptionsProps> = ({
  mode,
  onModeChange,
  visibility,
  onVisibilityChange,
  disabled = false,
  compact = false,
}) => {
  const buttonStyle = compact
    ? { flex: 1, padding: "10px 6px", fontSize: "10px" }
    : { padding: "6px 10px", fontSize: "8px" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div
        role="group"
        aria-label="Roll mode"
        style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}
      >
        {MODES.map((option) => (
          <JRPGButton
            key={option.value}
            onClick={() => onModeChange(option.value)}
            variant={mode === option.value ? "primary" : "default"}
            disabled={disabled}
            title={option.title}
            aria-pressed={mode === option.value}
            style={buttonStyle}
          >
            {option.label}
          </JRPGButton>
        ))}
      </div>

      <div
        role="group"
        aria-label="Who sees this roll"
        style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}
      >
        {VISIBILITIES.map((option) => (
          <JRPGButton
            key={option.value}
            onClick={() => onVisibilityChange(option.value)}
            variant={visibility === option.value ? "primary" : "default"}
            disabled={disabled}
            title={option.title}
            aria-pressed={visibility === option.value}
            style={buttonStyle}
          >
            {option.label}
          </JRPGButton>
        ))}
      </div>
    </div>
  );
};
