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
  // No confirm here on purpose: `onClearDrawings` is the drawing manager's
  // `handleClearDrawings`, which now owns the guard so that BOTH entry points
  // (this button and the drawing toolbar's "Clear All") behave identically.
  // Confirming here too would prompt the DM twice.
  return (
    <JRPGButton onClick={onClearDrawings} variant="danger" style={{ fontSize: "10px" }}>
      Clear All Drawings
    </JRPGButton>
  );
}
