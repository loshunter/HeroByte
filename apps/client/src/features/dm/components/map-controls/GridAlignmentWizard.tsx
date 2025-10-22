// ============================================================================
// GRID ALIGNMENT WIZARD COMPONENT
// ============================================================================
// Extracted from DMMenu.tsx as part of Phase 4: Map Controls refactoring.
// Provides a wizard UI for aligning the map grid to the background image by
// capturing two opposite corners of a map square and automatically calculating
// alignment transformations.

import { JRPGPanel, JRPGButton } from "../../../../components/ui/JRPGPanel";
import { CollapsibleSection } from "../../../../components/ui/CollapsibleSection";
import type { AlignmentPoint, AlignmentSuggestion } from "../../../../types/alignment";

/**
 * Props for the GridAlignmentWizard component.
 *
 * @property alignmentModeActive - Whether alignment mode is currently active
 * @property alignmentPoints - Array of captured alignment points (max 2)
 * @property alignmentSuggestion - Calculated alignment transformation suggestion
 * @property alignmentSuggestion.scale - Suggested scale factor
 * @property alignmentSuggestion.rotation - Suggested rotation in degrees
 * @property alignmentSuggestion.transform - Suggested transform (x, y offsets)
 * @property alignmentSuggestion.error - Residual error in pixels
 * @property alignmentError - Error message if alignment calculation fails
 * @property gridLocked - Whether the grid is locked (collapses the section)
 * @property mapLocked - Whether the map is locked (disables Apply button)
 * @property onAlignmentStart - Callback to start alignment mode
 * @property onAlignmentReset - Callback to reset captured points
 * @property onAlignmentCancel - Callback to cancel alignment mode
 * @property onAlignmentApply - Callback to apply the suggested alignment
 */
interface GridAlignmentWizardProps {
  alignmentModeActive: boolean;
  alignmentPoints: AlignmentPoint[];
  alignmentSuggestion: AlignmentSuggestion | null;
  alignmentError?: string | null;
  gridLocked?: boolean;
  mapLocked?: boolean;
  onAlignmentStart: () => void;
  onAlignmentReset: () => void;
  onAlignmentCancel: () => void;
  onAlignmentApply: () => void;
}

/**
 * GridAlignmentWizard - A wizard UI for aligning the map grid to the background image
 *
 * This component provides a step-by-step interface for DMs to capture two opposite
 * corners of a map square and automatically calculate alignment transformations
 * (scale, rotation, offset) to match the table grid.
 *
 * Features:
 * - Captures two alignment points (opposite corners)
 * - Calculates scale, rotation, and offset transformations
 * - Displays real-time alignment suggestions
 * - Shows residual error calculations
 * - Provides apply/reset/cancel controls
 *
 * The component is fully controlled - all state is managed by the parent.
 * Collapses when the grid is locked via the gridLocked prop.
 *
 * @param props - The component props
 * @returns The rendered GridAlignmentWizard component
 */
export function GridAlignmentWizard({
  alignmentModeActive,
  alignmentPoints,
  alignmentSuggestion,
  alignmentError,
  gridLocked,
  mapLocked,
  onAlignmentStart,
  onAlignmentReset,
  onAlignmentCancel,
  onAlignmentApply,
}: GridAlignmentWizardProps) {
  return (
    <CollapsibleSection isCollapsed={gridLocked ?? false}>
      <JRPGPanel variant="simple" title="Grid Alignment Wizard">
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <span className="jrpg-text-small" style={{ lineHeight: 1.4 }}>
            {alignmentModeActive
              ? "Alignment mode active — zoom in and click two opposite corners of a single map square."
              : "Capture two opposite corners of a map square to auto-match the map to the table grid."}
          </span>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <JRPGButton
              variant={alignmentModeActive ? "primary" : "default"}
              onClick={onAlignmentStart}
              style={{ fontSize: "10px" }}
              disabled={alignmentModeActive}
            >
              Start Alignment
            </JRPGButton>
            <JRPGButton
              variant="default"
              onClick={onAlignmentReset}
              style={{ fontSize: "10px" }}
              disabled={alignmentPoints.length === 0}
            >
              Reset Points
            </JRPGButton>
            {alignmentModeActive && (
              <JRPGButton variant="danger" onClick={onAlignmentCancel} style={{ fontSize: "10px" }}>
                Cancel
              </JRPGButton>
            )}
          </div>

          <span className="jrpg-text-small" style={{ opacity: 0.8 }}>
            Captured Points: {Math.min(alignmentPoints.length, 2)} / 2
          </span>

          {alignmentSuggestion && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "6px",
                fontSize: "10px",
                background: "rgba(0, 0, 0, 0.2)",
                padding: "8px",
                borderRadius: "4px",
              }}
            >
              <span>Scale</span>
              <span>{alignmentSuggestion.scale.toFixed(4)}×</span>
              <span>Rotation</span>
              <span>{alignmentSuggestion.rotation.toFixed(2)}°</span>
              <span>Offset X</span>
              <span>{alignmentSuggestion.transform.x.toFixed(1)}</span>
              <span>Offset Y</span>
              <span>{alignmentSuggestion.transform.y.toFixed(1)}</span>
              <span>Residual</span>
              <span>{alignmentSuggestion.error.toFixed(2)} px</span>
            </div>
          )}

          {alignmentError && (
            <span style={{ color: "#f87171", fontSize: "10px" }}>{alignmentError}</span>
          )}

          <JRPGButton
            variant="success"
            onClick={onAlignmentApply}
            style={{ fontSize: "10px" }}
            disabled={!alignmentSuggestion || !!alignmentError || mapLocked}
          >
            Apply Alignment
          </JRPGButton>
          {mapLocked && (
            <span style={{ color: "#facc15", fontSize: "10px" }}>
              Unlock the map before applying alignment.
            </span>
          )}
        </div>
      </JRPGPanel>
    </CollapsibleSection>
  );
}
