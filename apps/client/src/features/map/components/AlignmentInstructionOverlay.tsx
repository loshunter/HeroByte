/**
 * AlignmentInstructionOverlay Component
 *
 * Displays instructional text overlay during map alignment mode.
 * Shows step-by-step instructions for the alignment process.
 *
 * Features:
 * - Positioned in top-right corner
 * - Dark background with gold border (JRPG theme)
 * - Non-interactive (pointer-events: none)
 * - Only visible when alignment mode is active
 *
 * Extracted from: MapBoard.tsx:509-528
 */

export interface AlignmentInstructionOverlayProps {
  /** Whether alignment mode is active */
  alignmentMode: boolean;
  /** Instruction text to display */
  alignmentInstruction: string | null;
}

/**
 * AlignmentInstructionOverlay renders instruction text during alignment.
 *
 * Only renders when alignment mode is active and instruction text exists.
 * Provides visual feedback about the current step in the alignment process.
 */
export function AlignmentInstructionOverlay({
  alignmentMode,
  alignmentInstruction,
}: AlignmentInstructionOverlayProps) {
  // Don't render if alignment mode is off or no instruction exists
  if (!alignmentMode || !alignmentInstruction) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        top: "12px",
        right: "12px",
        background: "rgba(12, 18, 38, 0.9)",
        border: "1px solid var(--jrpg-border-gold)",
        borderRadius: "6px",
        padding: "8px 12px",
        fontSize: "10px",
        lineHeight: 1.4,
        zIndex: 10,
        pointerEvents: "none",
      }}
    >
      <strong style={{ color: "var(--jrpg-gold)" }}>Alignment Mode</strong>
      <div style={{ marginTop: "4px" }}>{alignmentInstruction}</div>
    </div>
  );
}
