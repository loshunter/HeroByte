// ============================================================================
// DICE BAR - D4 through D100 selection buttons
// ============================================================================

import React from "react";
import type { DieType } from "./types";
import { DIE_COLORS, DIE_SYMBOLS } from "./types";

interface DiceBarProps {
  onAddDie: (die: DieType) => void;
  onAddModifier: (value: number) => void;
}

const DICE: DieType[] = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];

export const DiceBar: React.FC<DiceBarProps> = ({ onAddDie, onAddModifier }) => {
  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        padding: "12px",
        background: "linear-gradient(180deg, #2a2845 0%, #1a1835 100%)",
        border: "3px solid var(--hero-gold)",
        borderRadius: "8px",
        boxShadow: "0 4px 8px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.1)",
        flexWrap: "wrap",
        justifyContent: "center",
      }}
    >
      {/* Die buttons */}
      {DICE.map((die) => (
        <button
          key={die}
          onClick={(e) => {
            console.log("[DiceBar] Die button clicked:", die);
            e.preventDefault();
            e.stopPropagation();
            onAddDie(die);
          }}
          className="dice-button"
          type="button"
          style={{
            width: "56px",
            height: "56px",
            background: `linear-gradient(135deg, ${DIE_COLORS[die]} 0%, ${DIE_COLORS[die]}DD 100%)`,
            border: "3px solid var(--hero-gold-light)",
            borderRadius: "4px",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "2px",
            boxShadow: "0 4px 0 var(--hero-navy-dark), 0 0 8px rgba(0,0,0,0.3)",
            transition: "all 150ms ease",
            position: "relative",
            pointerEvents: "auto",
            touchAction: "manipulation",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow =
              "0 6px 0 var(--hero-navy-dark), 0 0 12px rgba(255,255,255,0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow =
              "0 4px 0 var(--hero-navy-dark), 0 0 8px rgba(0,0,0,0.3)";
          }}
          onMouseDown={(e) => {
            console.log("[DiceBar] Die button mousedown:", die);
            e.currentTarget.style.transform = "translateY(2px)";
            e.currentTarget.style.boxShadow = "0 2px 0 var(--hero-navy-dark)";
          }}
          onMouseUp={(e) => {
            console.log("[DiceBar] Die button mouseup:", die);
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow =
              "0 6px 0 var(--hero-navy-dark), 0 0 12px rgba(255,255,255,0.3)";
          }}
          title={`Add ${die}`}
        >
          {/* Die symbol */}
          <div
            style={{
              fontSize: "28px",
              color: "#000",
              filter: "drop-shadow(0 1px 0 rgba(255,255,255,0.5))",
              lineHeight: 1,
            }}
          >
            {DIE_SYMBOLS[die]}
          </div>
          {/* Die label */}
          <div
            style={{
              fontSize: "9px",
              fontWeight: "bold",
              color: "#000",
              textShadow: "0 1px 0 rgba(255,255,255,0.5)",
              textTransform: "uppercase",
            }}
          >
            {die}
          </div>
        </button>
      ))}

      {/* Divider */}
      <div
        style={{
          width: "2px",
          background:
            "linear-gradient(180deg, transparent 0%, var(--hero-gold) 50%, transparent 100%)",
          margin: "0 4px",
        }}
      />

      {/* Modifier buttons */}
      <button
        onClick={(e) => {
          console.log("[DiceBar] +1 modifier button clicked");
          e.preventDefault();
          e.stopPropagation();
          onAddModifier(1);
        }}
        className="mod-button"
        type="button"
        style={{
          width: "56px",
          height: "56px",
          background: "linear-gradient(135deg, var(--hero-gold) 0%, var(--hero-gold-light) 100%)",
          border: "3px solid var(--hero-navy-dark)",
          borderRadius: "4px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 0 var(--hero-navy-dark), 0 0 8px rgba(0,0,0,0.3)",
          transition: "all 150ms ease",
          pointerEvents: "auto",
          touchAction: "manipulation",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow =
            "0 6px 0 var(--hero-navy-dark), 0 0 12px rgba(240,226,195,0.5)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow =
            "0 4px 0 var(--hero-navy-dark), 0 0 8px rgba(0,0,0,0.3)";
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = "translateY(2px)";
          e.currentTarget.style.boxShadow = "0 2px 0 var(--hero-navy-dark)";
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow =
            "0 6px 0 var(--hero-navy-dark), 0 0 12px rgba(240,226,195,0.5)";
        }}
        title="Add +1 modifier"
      >
        <div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--hero-navy-dark)" }}>
          +1
        </div>
      </button>

      <button
        onClick={(e) => {
          console.log("[DiceBar] -1 modifier button clicked");
          e.preventDefault();
          e.stopPropagation();
          onAddModifier(-1);
        }}
        className="mod-button"
        type="button"
        style={{
          width: "56px",
          height: "56px",
          background: "linear-gradient(135deg, #888 0%, #666 100%)",
          border: "3px solid var(--hero-navy-dark)",
          borderRadius: "4px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 0 var(--hero-navy-dark), 0 0 8px rgba(0,0,0,0.3)",
          transition: "all 150ms ease",
          pointerEvents: "auto",
          touchAction: "manipulation",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow =
            "0 6px 0 var(--hero-navy-dark), 0 0 12px rgba(136,136,136,0.5)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow =
            "0 4px 0 var(--hero-navy-dark), 0 0 8px rgba(0,0,0,0.3)";
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = "translateY(2px)";
          e.currentTarget.style.boxShadow = "0 2px 0 var(--hero-navy-dark)";
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow =
            "0 6px 0 var(--hero-navy-dark), 0 0 12px rgba(136,136,136,0.5)";
        }}
        title="Add -1 modifier"
      >
        <div style={{ fontSize: "24px", fontWeight: "bold", color: "#fff" }}>−1</div>
      </button>
    </div>
  );
};
