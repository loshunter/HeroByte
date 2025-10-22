// ============================================================================
// DRAWING CONTROLS
// ============================================================================
// Extracted from DMMenu.tsx as part of Phase 3: Simple Map Controls.
// Provides interface for managing map drawings (currently just clear all).

import { JRPGButton } from "../../../../components/ui/JRPGPanel";

export interface DrawingControlsProps {
  onClearDrawings: () => void;
}

export function DrawingControls({ onClearDrawings }: DrawingControlsProps) {
  const handleClearDrawings = () => {
    if (window.confirm("Clear all drawings from the map?")) {
      onClearDrawings();
    }
  };

  return (
    <JRPGButton onClick={handleClearDrawings} variant="danger" style={{ fontSize: "10px" }}>
      Clear All Drawings
    </JRPGButton>
  );
}
