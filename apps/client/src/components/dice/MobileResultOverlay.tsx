// ============================================================================
// MOBILE RESULT OVERLAY - centered, tap-to-dismiss roll result card
// ============================================================================
// Touch-friendly replacement for ResultPanel on small screens. Deliberately
// avoids DraggableWindow: its fixed positioning collapses to zero height
// inside transformed ancestors and its desktop coordinates land off-screen
// on narrow viewports.

import React, { useRef } from "react";
import type { RollResult } from "./types";
import { RollResultContent } from "./RollResultContent";

interface MobileResultOverlayProps {
  result: RollResult | null;
  onClose: () => void;
  zIndex?: number;
}

export const MobileResultOverlay: React.FC<MobileResultOverlayProps> = ({
  result,
  onClose,
  zIndex = 2100,
}) => {
  // A click retargets to the backdrop when a press starts on the card and is
  // released outside it (e.g. drag-selecting the breakdown text), so only
  // dismiss when the press also started on the backdrop.
  const pressStartedOnBackdrop = useRef(false);

  if (!result) return null;

  const handleBackdropPointerDown = (e: React.PointerEvent) => {
    pressStartedOnBackdrop.current = e.target === e.currentTarget;
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && pressStartedOnBackdrop.current) {
      onClose();
    }
    pressStartedOnBackdrop.current = false;
  };

  return (
    <div
      data-testid="mobile-roll-result"
      onPointerDown={handleBackdropPointerDown}
      onClick={handleBackdropClick}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background:
            "repeating-conic-gradient(rgba(255,255,255,0.02) 0% 25%, transparent 0% 50%) 50% / 2px 2px, linear-gradient(180deg, #2a2845 0%, #1a1835 50%, #0f0e2a 100%)",
          border: "4px solid var(--hero-gold)",
          borderRadius: "12px",
          boxShadow: "0 0 0 2px var(--hero-navy-dark), 0 8px 24px rgba(0,0,0,0.8)",
        }}
      >
        {/* Title bar (mirrors DraggableWindow's mobile styling) */}
        <div
          className="jrpg-text-command"
          style={{
            background: "var(--jrpg-gold)",
            padding: "12px 16px",
            color: "var(--jrpg-navy)",
            fontSize: "14px",
            fontWeight: "bold",
            textAlign: "center",
            position: "relative",
            boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.3)",
            userSelect: "none",
          }}
        >
          ⚂ ROLL RESULT ⚂
          <button
            onClick={onClose}
            aria-label="Close roll result"
            className="jrpg-button jrpg-button-danger"
            style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "32px",
              height: "32px",
              padding: 0,
              fontSize: "18px",
              lineHeight: "1",
            }}
          >
            ×
          </button>
        </div>

        {/* Scrollable result body - sole scroller; contain so swipe-down at the
            top can't chain into browser pull-to-refresh and drop the session */}
        <div style={{ overflowY: "auto", overscrollBehavior: "contain" }}>
          <RollResultContent result={result} constrainHeight={false} />
        </div>
      </div>
    </div>
  );
};
