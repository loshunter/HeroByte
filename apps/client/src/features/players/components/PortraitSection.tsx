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
    cursor: isEditable ? "pointer" : "default",
    transform: micLevel > 0.1 ? `scale(${1 + micLevel * 0.15})` : "scale(1)",
    transition: "transform 0.1s ease-out, box-shadow 0.2s ease",
    boxShadow: animatedBoxShadow,
    aspectRatio: "1 / 1",
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
      <div
        className="jrpg-portrait-frame"
        style={frameStyles}
        onClick={handleClick}
        role={isEditable ? "button" : undefined}
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
              fontSize: "0.65rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              textAlign: "center",
              padding: "8px",
              textShadow: "0 1px 3px rgba(0,0,0,0.5)",
              pointerEvents: "none",
            }}
          >
            <span style={{ fontSize: "0.6rem", fontWeight: "bold", lineHeight: "1.2" }}>
              {isEditable ? "Click to change portrait" : "No portrait"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
