// ============================================================================
// ROLL BUTTON - Big SNES-style ROLL! button
// ============================================================================

import React from "react";

interface RollButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export const RollButton: React.FC<RollButtonProps> = ({ onClick, disabled = false }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="roll-button"
      style={{
        width: "100%",
        maxWidth: "400px",
        height: "64px",
        background: disabled
          ? "linear-gradient(180deg, #666 0%, #444 100%)"
          : "linear-gradient(180deg, var(--hero-blue) 0%, #3366CC 100%)",
        border: "4px solid",
        borderColor: disabled
          ? "#444 #222 #222 #444"
          : "var(--hero-gold-light) var(--hero-navy-dark) var(--hero-navy-dark) var(--hero-gold-light)",
        borderRadius: "8px",
        color: disabled ? "#888" : "var(--hero-gold-light)",
        fontSize: "24px",
        fontWeight: "bold",
        fontFamily: "var(--font-pixel)",
        textTransform: "uppercase",
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: disabled
          ? "0 2px 0 #222"
          : "0 6px 0 var(--hero-navy-dark), 0 0 12px rgba(68,125,247,0.5)",
        transition: "all 150ms ease",
        position: "relative",
        textShadow: disabled
          ? "none"
          : "2px 2px 0 var(--hero-navy-dark), 0 0 8px rgba(240,226,195,0.5)",
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow =
            "0 8px 0 var(--hero-navy-dark), 0 0 16px rgba(68,125,247,0.7)";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow =
            "0 6px 0 var(--hero-navy-dark), 0 0 12px rgba(68,125,247,0.5)";
        }
      }}
      onMouseDown={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = "translateY(2px)";
          e.currentTarget.style.boxShadow = "0 4px 0 var(--hero-navy-dark)";
        }
      }}
      onMouseUp={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow =
            "0 8px 0 var(--hero-navy-dark), 0 0 16px rgba(68,125,247,0.7)";
        }
      }}
    >
      ⚂ ROLL! ⚂
    </button>
  );
};
