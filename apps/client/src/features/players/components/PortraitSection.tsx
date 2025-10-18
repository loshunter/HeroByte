// ============================================================================
// PORTRAIT SECTION COMPONENT
// ============================================================================
// Player portrait with class icon and mic level animation

import React from "react";

interface PortraitSectionProps {
  portrait?: string;
  micLevel?: number;
  isEditable?: boolean;
  onRequestChange?: () => void;
  statusIcon?: { emoji: string; label: string } | null;
  tokenColor?: string;
}

export const PortraitSection: React.FC<PortraitSectionProps> = ({
  portrait,
  micLevel = 0,
  isEditable = false,
  onRequestChange,
  statusIcon,
  tokenColor = "#5AFFAD",
}) => {
  const handleClick = () => {
    if (isEditable && onRequestChange) {
      onRequestChange();
    }
  };

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
      <div
        className="jrpg-icon"
        style={{
          position: "relative",
          width: "26px",
          height: "26px",
          background: "linear-gradient(135deg, var(--jrpg-dice-blue) 0%, var(--jrpg-gold) 100%)",
          border: "2px solid var(--jrpg-border-gold)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "14px",
          boxShadow: "0 0 6px var(--jrpg-border-gold)",
        }}
        title="Status effects"
      >
        {statusIcon ? statusIcon.emoji : "⚔️"}
        {statusIcon && (
          <span
            className="jrpg-text-small"
            style={{
              position: "absolute",
              top: "120%",
              left: "50%",
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
              background: "rgba(8, 12, 24, 0.9)",
              padding: "2px 4px",
              borderRadius: "4px",
              fontSize: "0.55rem",
              color: "var(--jrpg-white)",
              pointerEvents: "none",
            }}
          >
            {statusIcon.label}
          </span>
        )}
      </div>
      <button
        type="button"
        className="jrpg-portrait-frame"
        style={frameStyles}
        onClick={handleClick}
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
                Click to upload or paste an image link.
              </span>
            ) : null}
          </div>
        )}
      </button>
    </div>
  );
};
