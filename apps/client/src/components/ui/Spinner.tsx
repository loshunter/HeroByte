// ============================================================================
// SPINNER COMPONENT
// ============================================================================
// A simple loading spinner with JRPG styling

import React from "react";

export interface SpinnerProps {
  size?: number; // Size in pixels, default 20
  color?: string; // Color, defaults to JRPG gold
  style?: React.CSSProperties;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 20,
  color = "var(--jrpg-gold)",
  style,
}) => {
  return (
    <>
      <style>
        {`
          @keyframes spinner-rotate {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
      <div
        style={{
          display: "inline-block",
          width: `${size}px`,
          height: `${size}px`,
          border: `2px solid ${color}`,
          borderTopColor: "transparent",
          borderRadius: "50%",
          animation: "spinner-rotate 0.8s linear infinite",
          ...style,
        }}
        role="status"
        aria-label="Loading"
      />
    </>
  );
};
