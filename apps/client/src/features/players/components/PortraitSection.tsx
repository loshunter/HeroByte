// ============================================================================
// PORTRAIT SECTION COMPONENT
// ============================================================================
// Player portrait with class icon and mic level animation

import React from "react";

interface PortraitSectionProps {
  portrait?: string;
  micLevel?: number;
}

export const PortraitSection: React.FC<PortraitSectionProps> = ({
  portrait,
  micLevel = 0,
}) => {
  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center", width: "100%" }}>
      {/* Pixel class icon */}
      <div
        style={{
          width: "24px",
          height: "24px",
          background: "linear-gradient(135deg, var(--hero-blue) 0%, var(--hero-gold) 100%)",
          border: "2px solid var(--hero-gold-light)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "14px",
          boxShadow: "0 0 6px rgba(68, 125, 247, 0.4)",
        }}
      >
        ⚔️
      </div>
      <div
        className="player-portrait"
        style={{
          transform: micLevel > 0.1
            ? `scale(${1 + micLevel * 0.2})`
            : "scale(1)",
          transition: "transform 0.1s ease-out",
          flex: 1,
        }}
      >
        {portrait && (
          <img
            key={portrait.substring(0, 100)}
            src={portrait}
            alt="portrait"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              pointerEvents: "none",
              userSelect: "none",
              display: "block",
            }}
            draggable={false}
          />
        )}
      </div>
    </div>
  );
};
