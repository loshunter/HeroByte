// ============================================================================
// HP BAR COMPONENT
// ============================================================================
// Health bar with drag-to-adjust and editable max HP

import React from "react";

// Dressed as the underlined number it always was, over the global chunky
// button rule (inline, so button:hover's gradient cannot win either).
const VALUE_BUTTON_STYLE: React.CSSProperties = {
  background: "none",
  border: "none",
  boxShadow: "none",
  padding: 0,
  color: "inherit",
  font: "inherit",
  textTransform: "none",
  cursor: "pointer",
  textDecoration: "underline",
};

/**
 * One HP number. Its viewer's to edit, it is a real button: a keyboard reaches
 * it, and on a touch screen herobyte.css gives it a 44px box of its own
 * (`.hp-bar__value`) — boxes side by side, so current and max, about 30px
 * apart, cannot steal each other's taps. Anyone else's is plain text.
 */
function HpValue({
  label,
  value,
  editable,
  onEdit,
  title,
}: {
  label: string;
  value: string | number;
  editable: boolean;
  onEdit: () => void;
  title?: string;
}): JSX.Element {
  if (!editable) {
    return <span style={{ cursor: "default", textDecoration: "none" }}>{value}</span>;
  }
  return (
    <button
      type="button"
      className="hp-bar__value"
      aria-label={`Set ${label}: ${value}`}
      title={title}
      onClick={onEdit}
      style={VALUE_BUTTON_STYLE}
    >
      {value}
    </button>
  );
}

interface HPBarProps {
  hp: number;
  maxHp: number;
  tempHp?: number;
  isMe: boolean;
  isEditingHp: boolean;
  hpInput: string;
  isEditingMaxHp: boolean;
  maxHpInput: string;
  isEditingTempHp?: boolean;
  tempHpInput?: string;
  playerUid: string;
  onHpChange: (hp: number) => void;
  onHpInputChange: (value: string) => void;
  onHpEdit: (uid: string, hp: number) => void;
  onHpSubmit: (value: string) => void;
  onMaxHpInputChange: (value: string) => void;
  onMaxHpEdit: (uid: string, maxHp: number) => void;
  onMaxHpSubmit: (value: string) => void;
  onTempHpInputChange?: (value: string) => void;
  onTempHpEdit?: () => void;
  onTempHpSubmit?: (value: string) => void;
}

export const HPBar: React.FC<HPBarProps> = ({
  hp,
  maxHp,
  tempHp,
  isMe,
  isEditingHp,
  hpInput,
  isEditingMaxHp,
  maxHpInput,
  isEditingTempHp = false,
  tempHpInput = "0",
  playerUid,
  onHpChange,
  onHpInputChange,
  onHpEdit,
  onHpSubmit,
  onMaxHpInputChange,
  onMaxHpEdit,
  onMaxHpSubmit,
  onTempHpInputChange,
  onTempHpEdit,
  onTempHpSubmit,
}) => {
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMe) return;

    e.preventDefault();
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const x = moveEvent.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const newHp = Math.round(percentage * maxHp);
      onHpChange(newHp);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    handleMouseMove(e.nativeEvent);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isMe) return;

    // Prevent scrolling while dragging the HP bar
    // We don't call preventDefault() here because it marks the event as passive
    // and Chrome complains. Instead we use touch-action: none in styles.
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();

    const handleTouchMove = (moveEvent: TouchEvent) => {
      const touch = moveEvent.touches[0];
      const x = touch.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const newHp = Math.round(percentage * maxHp);
      onHpChange(newHp);
    };

    const handleTouchEnd = () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };

    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);

    // Initial move for the start touch
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newHp = Math.round(percentage * maxHp);
    onHpChange(newHp);
  };

  const hpPercent = (hp / maxHp) * 100;
  const hpState = hpPercent > 66 ? "high" : hpPercent > 33 ? "medium" : "low";

  const displayHp = tempHp && tempHp > 0 ? `${hp} (+${tempHp})` : hp;

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "4px" }}>
      <div className="jrpg-text-small" style={{ color: "var(--jrpg-gold)", textAlign: "center" }}>
        HP:{" "}
        {isEditingHp ? (
          <input
            type="number"
            aria-label="Current HP"
            value={hpInput}
            onChange={(e) => onHpInputChange(e.target.value)}
            onBlur={() => onHpSubmit(hpInput)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onHpSubmit(hpInput);
              }
            }}
            autoFocus
            style={{
              width: "40px",
              fontSize: "8px",
              background: "var(--jrpg-navy)",
              color: "var(--jrpg-cyan)",
              border: "1px solid var(--jrpg-border-gold)",
              padding: "2px",
              textAlign: "center",
            }}
          />
        ) : (
          <HpValue
            label="current HP"
            value={displayHp}
            editable={isMe}
            onEdit={() => onHpEdit(playerUid, hp)}
          />
        )}
        {" / "}
        {isEditingMaxHp ? (
          <input
            type="number"
            aria-label="Max HP"
            value={maxHpInput}
            onChange={(e) => onMaxHpInputChange(e.target.value)}
            onBlur={() => onMaxHpSubmit(maxHpInput)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onMaxHpSubmit(maxHpInput);
              }
            }}
            autoFocus
            style={{
              width: "40px",
              fontSize: "8px",
              background: "var(--jrpg-navy)",
              color: "var(--jrpg-cyan)",
              border: "1px solid var(--jrpg-border-gold)",
              padding: "2px",
              textAlign: "center",
            }}
          />
        ) : (
          <HpValue
            label="max HP"
            value={maxHp}
            editable={isMe}
            onEdit={() => onMaxHpEdit(playerUid, maxHp)}
          />
        )}
      </div>
      {isMe && onTempHpEdit && onTempHpSubmit && onTempHpInputChange && (
        <div className="jrpg-text-small" style={{ color: "var(--jrpg-cyan)", textAlign: "center" }}>
          Temp HP:{" "}
          {isEditingTempHp ? (
            <input
              type="number"
              aria-label="Temp HP"
              value={tempHpInput}
              onChange={(e) => onTempHpInputChange(e.target.value)}
              onBlur={() => onTempHpSubmit(tempHpInput)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onTempHpSubmit(tempHpInput);
                }
              }}
              autoFocus
              style={{
                width: "40px",
                fontSize: "8px",
                background: "var(--jrpg-navy)",
                color: "var(--jrpg-cyan)",
                border: "1px solid var(--jrpg-border-gold)",
                padding: "2px",
                textAlign: "center",
              }}
            />
          ) : (
            <HpValue
              label="temp HP"
              value={tempHp ?? 0}
              editable
              onEdit={onTempHpEdit}
              title="Temporary HP absorbed before regular HP"
            />
          )}
        </div>
      )}
      <div
        className="jrpg-hp-bar"
        style={{
          cursor: isMe ? "ew-resize" : "default",
          touchAction: "none", // Critical for preventing scroll while dragging
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div
          className="jrpg-hp-bar-fill"
          data-hp-percent={hpState}
          style={{ width: `${hpPercent}%` }}
        ></div>
      </div>
    </div>
  );
};
