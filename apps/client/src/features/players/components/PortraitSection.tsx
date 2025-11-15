// ============================================================================
// PORTRAIT SECTION COMPONENT
// ============================================================================
// Player portrait with class icon and mic level animation

import React from "react";
import { STATUS_OPTIONS } from "../constants/statusOptions";

interface PortraitSectionProps {
  portrait?: string;
  micLevel?: number;
  isEditable?: boolean;
  onRequestChange?: () => void;
  statusEffects: string[];
  tokenColor?: string;
  onFocusToken?: () => void;
  initiative?: number;
  onInitiativeClick?: () => void;
}

export const PortraitSection: React.FC<PortraitSectionProps> = ({
  portrait,
  micLevel = 0,
  isEditable = false,
  onRequestChange,
  statusEffects,
  tokenColor = "#5AFFAD",
  onFocusToken,
  initiative,
  onInitiativeClick,
}) => {
  const handlePortraitClick = () => {
    // Click portrait to change image (when editable)
    if (isEditable && onRequestChange) {
      onRequestChange();
    }
  };

  const handleStatusIconClick = (e: React.MouseEvent) => {
    // Click status icon to focus on token
    e.stopPropagation(); // Prevent portrait click
    if (onFocusToken) {
      onFocusToken();
    }
  };

  // Get emojis for active status effects (up to 3)
  const displayEffects = statusEffects.slice(0, 3).map((effectValue) => {
    const option = STATUS_OPTIONS.find((opt) => opt.value === effectValue);
    return option
      ? { emoji: option.emoji, label: option.label }
      : { emoji: "", label: effectValue };
  });

  const hasMoreEffects = statusEffects.length > 3;

  const animatedBoxShadow =
    micLevel > 0.1 ? "0 0 12px rgba(90, 255, 173, 0.35)" : "0 0 6px rgba(8, 12, 24, 0.6)";

  const frameStyles: React.CSSProperties = {
    position: "relative",
    flex: 1,
    width: "100%",
    border: "2px solid var(--jrpg-border-gold)",
    borderRadius: "8px",
    overflow: "hidden",
    background: "var(--jrpg-navy)",
    transform: micLevel > 0.1 ? `scale(${1 + micLevel * 0.15})` : "scale(1)",
    transition: "transform 0.1s ease-out, box-shadow 0.2s ease",
    boxShadow: animatedBoxShadow,
    aspectRatio: "1 / 1",
    padding: 0,
    cursor: isEditable ? "pointer" : "default",
    outline: "none",
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        alignItems: "center",
        width: "100%",
      }}
    >
      {/* Icon column: Camera snap + Initiative button */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          className="jrpg-icon"
          onClick={handleStatusIconClick}
          style={{
            position: "relative",
            width: "26px",
            height: "26px",
            background: "linear-gradient(135deg, var(--jrpg-dice-blue) 0%, var(--jrpg-gold) 100%)",
            border: "2px solid var(--jrpg-border-gold)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: statusEffects.length === 0 ? "14px" : "10px",
            boxShadow: "0 0 6px var(--jrpg-border-gold)",
            cursor: onFocusToken ? "pointer" : "default",
            padding: 0,
            lineHeight: 1,
          }}
          title={
            statusEffects.length > 0
              ? displayEffects.map((e) => e.label).join(", ") +
                (hasMoreEffects ? `, +${statusEffects.length - 3} more` : "")
              : onFocusToken
                ? "Focus on token"
                : "No status effects"
          }
          disabled={!onFocusToken}
          aria-label={onFocusToken ? "Focus camera on token" : "Status effects"}
        >
          {statusEffects.length === 0 ? (
            "⚔️"
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "1px",
              }}
            >
              {displayEffects.map((effect, i) => (
                <span key={i} style={{ lineHeight: 0.8 }}>
                  {effect.emoji}
                </span>
              ))}
              {hasMoreEffects && (
                <span style={{ fontSize: "8px", lineHeight: 1 }}>+{statusEffects.length - 3}</span>
              )}
            </div>
          )}
        </button>

        {/* Initiative button */}
        {onInitiativeClick && (
          <button
            type="button"
            className="jrpg-icon jrpg-text-small"
            onClick={(e) => {
              e.stopPropagation();
              onInitiativeClick();
            }}
            style={{
              position: "relative",
              width: "40px",
              height: "22px",
              background:
                initiative !== undefined
                  ? "linear-gradient(135deg, var(--jrpg-gold) 0%, var(--jrpg-dice-blue) 100%)"
                  : "var(--jrpg-navy)",
              border: "2px solid var(--jrpg-border-gold)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              fontWeight: "bold",
              boxShadow:
                initiative !== undefined
                  ? "0 0 8px var(--jrpg-gold)"
                  : "0 0 4px var(--jrpg-border-gold)",
              cursor: "pointer",
              padding: 0,
              color: "var(--jrpg-white)",
            }}
            title={initiative !== undefined ? `Initiative: ${initiative}` : "Set Initiative"}
            aria-label="Set Initiative"
          >
            {initiative !== undefined ? initiative : "Init"}
          </button>
        )}
      </div>

      <button
        type="button"
        className="jrpg-portrait-frame"
        style={frameStyles}
        onClick={handlePortraitClick}
        aria-label={isEditable ? "Change portrait" : "Player portrait"}
        disabled={!isEditable}
        tabIndex={isEditable ? 0 : -1}
      >
        {portrait ? (
          <img
            key={portrait.substring(0, 100)}
            src={portrait}
            alt="Player portrait"
            className="jrpg-portrait-image"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              userSelect: "none",
              pointerEvents: "none",
            }}
            draggable={false}
            onError={(e) => {
              console.error("[PortraitSection] Failed to load portrait image:", portrait);
              console.error("[PortraitSection] Error event:", e);
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div
            data-testid="portrait-placeholder"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              backgroundColor: tokenColor,
              color: "#fff",
              textAlign: "center",
              padding: "8px",
              textShadow: "0 1px 3px rgba(0, 0, 0, 0.45)",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {isEditable ? "+ Add Portrait" : "Portrait Pending"}
            </span>
            {isEditable ? (
              <span
                style={{
                  fontSize: "0.65rem",
                  opacity: 0.85,
                  lineHeight: 1.3,
                  letterSpacing: "0.04em",
                }}
              >
                Click to enter an image URL.
              </span>
            ) : null}
          </div>
        )}
      </button>
    </div>
  );
};
