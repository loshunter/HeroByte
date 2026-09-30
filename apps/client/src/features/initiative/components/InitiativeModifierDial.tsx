// ============================================================================
// INITIATIVE MODIFIER DIAL
// ============================================================================
// The initiative dialog's modifier: drag left/right on the number, or press
// − / +. Split from InitiativeModal (U8), which sat against the 350-line guard.
//
// The buttons are the dial's keyboard and touch road. A drag alone could not
// be reached from a keyboard, and on a phone the browser took a horizontal
// finger drag as a scroll — `touchAction: none` hands it to the dial instead.

import React, { useCallback } from "react";

export const INITIATIVE_MODIFIER_MIN = -20;
export const INITIATIVE_MODIFIER_MAX = 20;

const clampModifier = (value: number) =>
  Math.max(INITIATIVE_MODIFIER_MIN, Math.min(INITIATIVE_MODIFIER_MAX, value));

interface InitiativeModifierDialProps {
  modifier: number;
  onChange: (modifier: number) => void;
  /** While this dialog's own save is in flight the modifier is fixed. */
  disabled: boolean;
}

const stepButtonStyle: React.CSSProperties = {
  minWidth: "44px",
  background: "#111",
  border: "2px solid var(--jrpg-border-gold)",
  color: "var(--jrpg-white)",
  fontSize: "20px",
  fontWeight: "bold",
  cursor: "pointer",
};

export function InitiativeModifierDial({
  modifier,
  onChange,
  disabled,
}: InitiativeModifierDialProps) {
  const handleModifierDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      const element = e.currentTarget;
      const startX = e.clientX;
      const startModifier = modifier;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const change = Math.floor(deltaX / 10); // 10px = 1 point
        onChange(clampModifier(startModifier + change));
      };

      const handlePointerUp = () => {
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
        element.releasePointerCapture(e.pointerId);
      };

      element.setPointerCapture(e.pointerId);
      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
    },
    [modifier, onChange, disabled],
  );

  return (
    <div>
      <label className="jrpg-text-small" style={{ display: "block", marginBottom: "8px" }}>
        Initiative Modifier
      </label>
      <div style={{ display: "flex", gap: "8px", alignItems: "stretch" }}>
        <button
          type="button"
          aria-label="Lower the modifier"
          disabled={disabled || modifier <= INITIATIVE_MODIFIER_MIN}
          onClick={() => onChange(clampModifier(modifier - 1))}
          style={stepButtonStyle}
        >
          −
        </button>
        <div
          data-testid="initiative-modifier-dial"
          onPointerDown={handleModifierDrag}
          style={{
            flex: 1,
            padding: "12px",
            background: "#111",
            border: "2px solid var(--jrpg-border-gold)",
            textAlign: "center",
            fontSize: "24px",
            fontWeight: "bold",
            cursor: "ew-resize",
            userSelect: "none",
            touchAction: "none",
            color: modifier >= 0 ? "var(--jrpg-green)" : "var(--jrpg-red)",
          }}
        >
          {modifier >= 0 ? "+" : ""}
          {modifier}
        </div>
        <button
          type="button"
          aria-label="Raise the modifier"
          disabled={disabled || modifier >= INITIATIVE_MODIFIER_MAX}
          onClick={() => onChange(clampModifier(modifier + 1))}
          style={stepButtonStyle}
        >
          +
        </button>
      </div>
      <div
        className="jrpg-text-small"
        style={{ marginTop: "4px", textAlign: "center", opacity: 0.7 }}
      >
        Drag the number left/right, or use the buttons
      </div>
    </div>
  );
}
