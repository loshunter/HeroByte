// ============================================================================
// HP BAR COMPONENT
// ============================================================================
// Health bar with drag-to-adjust and editable max HP

import React from "react";

interface HPBarProps {
  hp: number;
  maxHp: number;
  isMe: boolean;
  isEditingMaxHp: boolean;
  maxHpInput: string;
  playerUid: string;
  onHpChange: (hp: number) => void;
  onMaxHpInputChange: (value: string) => void;
  onMaxHpEdit: (uid: string, maxHp: number) => void;
  onMaxHpSubmit: (value: string) => void;
}

export const HPBar: React.FC<HPBarProps> = ({
  hp,
  maxHp,
  isMe,
  isEditingMaxHp,
  maxHpInput,
  playerUid,
  onHpChange,
  onMaxHpInputChange,
  onMaxHpEdit,
  onMaxHpSubmit,
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

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "4px" }}>
      <div style={{ fontSize: "0.6rem", color: "var(--hero-text-dim)", textAlign: "center" }}>
        HP: {hp} / {isEditingMaxHp ? (
          <input
            type="number"
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
              fontSize: "0.6rem",
              background: "#111",
              color: "var(--hero-blue)",
              border: "1px solid var(--hero-gold)",
              padding: "1px 2px",
              textAlign: "center",
            }}
          />
        ) : (
          <span
            onClick={() => {
              if (isMe) {
                onMaxHpEdit(playerUid, maxHp);
              }
            }}
            style={{
              cursor: isMe ? "pointer" : "default",
              textDecoration: isMe ? "underline" : "none",
            }}
          >
            {maxHp}
          </span>
        )}
      </div>
      <div
        className="stat-bar hp"
        style={{
          cursor: isMe ? "ew-resize" : "default",
          position: "relative"
        }}
        onMouseDown={handleMouseDown}
      >
        <div
          className="stat-bar-fill"
          style={{ width: `${(hp / maxHp) * 100}%` }}
        ></div>
      </div>
    </div>
  );
};
