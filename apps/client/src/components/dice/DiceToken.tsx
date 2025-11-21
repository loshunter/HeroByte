// ============================================================================
// DICE TOKEN COMPONENT
// ============================================================================

import React from "react";
import type { Token } from "./types";
import { DIE_COLORS, DIE_SYMBOLS } from "./types";

interface DiceTokenProps {
  token: Token;
  onRemove: () => void;
  onUpdateQty?: (qty: number) => void;
  onUpdateMod?: (value: number) => void;
  isAnimating?: boolean;
}

export const DiceToken: React.FC<DiceTokenProps> = ({
  token,
  onRemove,
  onUpdateQty,
  onUpdateMod,
  isAnimating = false,
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState("");

  const handleClick = () => {
    if (isEditing) {
      return;
    }
    if (token.kind === "die" && onUpdateQty) {
      setIsEditing(true);
      setEditValue(String(token.qty));
    } else if (token.kind === "mod" && onUpdateMod) {
      setIsEditing(true);
      setEditValue(String(token.value));
    }
  };

  const handleSubmit = () => {
    const num = parseInt(editValue, 10);
    if (!isNaN(num)) {
      if (token.kind === "die" && onUpdateQty) {
        onUpdateQty(Math.max(1, Math.min(99, num)));
      } else if (token.kind === "mod" && onUpdateMod) {
        onUpdateMod(Math.max(-99, Math.min(99, num)));
      }
    }
    setIsEditing(false);
  };

  if (token.kind === "die") {
    const color = DIE_COLORS[token.die];
    const symbol = DIE_SYMBOLS[token.die];

    return (
      <div
        className={`dice-token ${isAnimating ? "animating" : ""}`}
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "48px",
          height: "48px",
          background: `linear-gradient(135deg, ${color} 0%, ${color}DD 100%)`,
          border: "3px solid var(--hero-gold-light)",
          boxShadow: "0 0 8px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.3)",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={handleClick}
      >
        {/* Die symbol */}
        <div
          style={{
            fontSize: "24px",
            color: "#000",
            filter: "drop-shadow(0 1px 0 rgba(255,255,255,0.5))",
          }}
        >
          {symbol}
        </div>

        {/* Quantity badge */}
        {token.qty > 1 && !isEditing && (
          <div
            style={{
              position: "absolute",
              bottom: "-6px",
              right: "-6px",
              background: "var(--hero-gold)",
              border: "2px solid var(--hero-navy-dark)",
              borderRadius: "8px",
              padding: "2px 6px",
              fontSize: "10px",
              fontWeight: "bold",
              color: "var(--hero-navy-dark)",
              boxShadow: "0 2px 4px rgba(0,0,0,0.6)",
            }}
          >
            ×{token.qty}
          </div>
        )}

        {/* Edit mode */}
        {isEditing && (
          <div
            style={{
              position: "absolute",
              top: "-30px",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: "4px",
              background: "var(--hero-navy)",
              border: "2px solid var(--hero-gold)",
              padding: "4px",
              borderRadius: "4px",
              zIndex: 100,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
                if (e.key === "Escape") setIsEditing(false);
              }}
              autoFocus
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "40px",
                padding: "2px 4px",
                fontSize: "12px",
                background: "#000",
                color: "var(--hero-gold)",
                border: "1px solid var(--hero-gold)",
                textAlign: "center",
              }}
              min="1"
              max="99"
            />
          </div>
        )}

        {/* Remove button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{
            position: "absolute",
            top: "-8px",
            right: "-8px",
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            background: "var(--hero-danger)",
            border: "2px solid var(--hero-navy-dark)",
            color: "white",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
            lineHeight: 1,
          }}
          title="Remove"
        >
          ×
        </button>
      </div>
    );
  } else {
    // Modifier token
    return (
      <div
        className={`dice-token mod ${isAnimating ? "animating" : ""}`}
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: "60px",
          height: "40px",
          padding: "0 14px",
          background: "linear-gradient(135deg, #6EA9FF 0%, #9CC4FF 100%)",
          border: "3px solid var(--hero-gold)",
          borderRadius: "20px",
          boxShadow: "0 6px 0 var(--hero-navy-dark), 0 0 12px rgba(156, 196, 255, 0.8)",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={handleClick}
      >
        {/* Modifier value */}
        {!isEditing && (
          <div
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "var(--hero-gold)",
              textShadow: "0 0 6px rgba(255,215,137,0.8)",
            }}
          >
            {token.value >= 0 ? `+${token.value}` : token.value}
          </div>
        )}

        {/* Edit mode */}
        {isEditing && (
          <input
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
              if (e.key === "Escape") setIsEditing(false);
            }}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "50px",
              padding: "2px 4px",
              fontSize: "14px",
              background: "transparent",
              color: "var(--hero-navy-dark)",
              border: "none",
              textAlign: "center",
              fontWeight: "bold",
            }}
            min="-99"
            max="99"
          />
        )}

        {/* Remove button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{
            position: "absolute",
            top: "-8px",
            right: "-8px",
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            background: "var(--hero-danger)",
            border: "2px solid var(--hero-navy-dark)",
            color: "white",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
            lineHeight: 1,
          }}
          title="Remove"
        >
          ×
        </button>
      </div>
    );
  }
};
