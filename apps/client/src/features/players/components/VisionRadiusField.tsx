// ============================================================================
// VISION RADIUS FIELD (S7)
// ============================================================================
// How far a token can see, in feet. One component, three homes: the player
// card's settings menu, the NPC card's settings menu, and the mobile entities
// list — so the control reads and behaves identically wherever a DM finds it,
// and the mobile surface ships in the same slice rather than as a retrofit.
//
// DM-only by construction: every call site supplies `onChange` only for a DM
// (see EntitiesPanel), and the server refuses a non-DM change regardless. A
// radius can only ever NARROW what the walls already allow, so a player able
// to clear their own would just undo the darkness the DM authored.

import { useEffect, useState } from "react";
import { VISION_RADIUS_MAX_FEET, VISION_RADIUS_MIN_FEET } from "@herobyte/shared";

interface VisionRadiusFieldProps {
  /** Current value in feet; undefined means unlimited. */
  value?: number;
  /** null clears the limit back to unlimited. */
  onChange: (radiusFeet: number | null) => void;
  /** Rendered as thumb-sized controls on the mobile surface. */
  compact?: boolean;
  /** Heading above the presets. */
  label?: string;
  /** Tooltip sentence subject: "<subject> sees 60 feet". */
  subject?: string;
  /** Accessible name for the custom input. Distinct per surface, so two of
   *  these on one screen stay tellable apart by a locator. */
  inputAriaLabel?: string;
}

/** Darkvision as the rulebooks hand it out, plus the two ends of the scale. */
const PRESETS: { label: string; value: number | null }[] = [
  { label: "Unlimited", value: null },
  { label: "30 ft", value: 30 },
  { label: "60 ft", value: 60 },
  { label: "120 ft", value: 120 },
  { label: "Blind", value: 0 },
];

export function VisionRadiusField({
  value,
  onChange,
  compact = false,
  label = "Sight Radius",
  subject = "This token",
  inputAriaLabel = "Sight radius in feet",
}: VisionRadiusFieldProps) {
  // Local draft so a half-typed number ("6" on the way to "60") does not
  // broadcast a radius nobody asked for. Re-synced whenever the authoritative
  // value changes underneath — another DM can be editing the same token.
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  useEffect(() => {
    setDraft(value === undefined ? "" : String(value));
  }, [value]);

  // Every send costs a room-wide snapshot re-filter and a state-file write —
  // TokenService.setVisionRadius reports success whenever the token EXISTS, not
  // when the value moved — so a blur that changed nothing must stay silent.
  // Tapping into the box and back out again is not an edit.
  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      if (value !== undefined) onChange(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setDraft(value === undefined ? "" : String(value));
      return;
    }
    const clamped = Math.min(VISION_RADIUS_MAX_FEET, Math.max(VISION_RADIUS_MIN_FEET, parsed));
    if (clamped === value) {
      // Snap the draft to the canonical spelling ("060" -> "60") without a send.
      setDraft(String(clamped));
      return;
    }
    onChange(clamped);
  };

  const buttonStyle = compact
    ? { fontSize: "0.7rem", padding: "6px 8px", minHeight: "44px", flex: "1 1 auto" }
    : { fontSize: "0.6rem", padding: "4px 2px" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
      <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
        {label}
      </span>
      <div
        style={
          compact
            ? { display: "flex", flexWrap: "wrap", gap: "6px" }
            : { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px" }
        }
      >
        {PRESETS.map((preset) => {
          const active =
            preset.value === null
              ? value === undefined
              : value !== undefined && value === preset.value;
          return (
            <button
              key={preset.label}
              className={active ? "btn btn-primary" : "btn btn-secondary"}
              style={buttonStyle}
              onClick={() => onChange(preset.value)}
              aria-pressed={active}
              title={
                preset.value === null
                  ? "Sight is stopped only by walls"
                  : preset.value === 0
                    ? `${subject} sees nothing`
                    : `${subject} sees ${preset.value} feet`
              }
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span className="jrpg-text-small">Custom</span>
        <input
          aria-label={inputAriaLabel}
          type="number"
          inputMode="numeric"
          min={VISION_RADIUS_MIN_FEET}
          max={VISION_RADIUS_MAX_FEET}
          step={5}
          placeholder="Unlimited"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit((event.target as HTMLInputElement).value);
          }}
          style={{ width: compact ? "100%" : "70px", minHeight: compact ? "44px" : undefined }}
        />
        <span className="jrpg-text-small">ft</span>
      </label>
    </div>
  );
}
