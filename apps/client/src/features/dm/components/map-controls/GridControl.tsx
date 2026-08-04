// ============================================================================
// GRID CONTROL
// ============================================================================
// Extracted from DMMenu.tsx as part of Phase 3: Simple Map Controls.
// Provides interface for configuring grid size, square size (feet), and lock state.

import { DIAGONAL_RULES, DIAGONAL_RULE_LABELS, type DiagonalRule } from "@herobyte/shared";
import { JRPGPanel, JRPGButton } from "../../../../components/ui/JRPGPanel";
import { CollapsibleSection } from "../../../../components/ui/CollapsibleSection";

/** One line each, so a DM picking a rule knows what it costs a diagonal. */
const DIAGONAL_RULE_HINTS: Record<DiagonalRule, string> = {
  "5e": "Every square costs the same. A 2-square diagonal is 10 ft.",
  pathfinder: "Diagonals alternate 5-10. A 2-square diagonal is 15 ft.",
  euclidean: "Straight-line distance, in fractions of a square.",
};

export interface GridControlProps {
  gridSize: number;
  gridSquareSize?: number; // Feet per square
  gridLocked: boolean;
  onGridSizeChange: (size: number) => void;
  onGridSquareSizeChange?: (size: number) => void;
  onGridLockToggle: () => void;
  /** The table's diagonal rule (S6). Absent handler = no control, as elsewhere. */
  diagonalRule?: DiagonalRule;
  onDiagonalRuleChange?: (rule: DiagonalRule) => void;
}

export function GridControl({
  gridSize,
  gridSquareSize = 5,
  gridLocked,
  onGridSizeChange,
  onGridSquareSizeChange,
  onGridLockToggle,
  diagonalRule = "5e",
  onDiagonalRuleChange,
}: GridControlProps) {
  const formatSquareSize = (value: number) =>
    Number.isInteger(value) ? `${value}` : value.toFixed(1);

  return (
    <JRPGPanel
      variant="simple"
      title="Grid Controls"
      style={{
        padding: gridLocked ? "8px" : "12px",
        transition: "padding 150ms ease-in-out",
        border: gridLocked
          ? "2px solid rgba(136, 136, 136, 0.5)"
          : "2px solid var(--jrpg-border-gold)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <JRPGButton
          onClick={onGridLockToggle}
          variant={gridLocked ? "default" : "primary"}
          style={{
            fontSize: "11px",
            fontWeight: "bold",
            padding: "8px",
            background: gridLocked ? "rgba(136, 136, 136, 0.2)" : undefined,
            color: gridLocked ? "#aaa" : undefined,
          }}
        >
          {gridLocked ? "🔒 GRID LOCKED ▲" : "🔓 GRID UNLOCKED ▼"}
        </JRPGButton>

        <CollapsibleSection isCollapsed={gridLocked}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span className="jrpg-text-small">Grid Size</span>
              <span className="jrpg-text-small">{gridSize}px</span>
            </div>
            <input
              type="range"
              min={10}
              max={500}
              step={5}
              value={gridSize}
              onChange={(event) => onGridSizeChange(Number(event.target.value))}
              style={{ width: "100%" }}
            />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "8px",
              }}
            >
              <span className="jrpg-text-small">Square Size</span>
              <span className="jrpg-text-small">{formatSquareSize(gridSquareSize)} ft</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={Math.min(100, Math.max(1, gridSquareSize))}
              onChange={(event) => onGridSquareSizeChange?.(Number(event.target.value))}
              disabled={!onGridSquareSizeChange}
              style={{ width: "100%" }}
            />
            <span
              style={{
                fontSize: "10px",
                opacity: 0.8,
                lineHeight: 1.3,
                display: "block",
              }}
            >
              Measurement tool displays distances as squares and feet using this value.
            </span>
          </div>
        </CollapsibleSection>
        {/* Diagonal rule (S6): OUTSIDE the collapsible on purpose. "Grid
            locked" freezes the grid's SIZES so nobody nudges them mid-session;
            how the table counts a diagonal is a rules decision, not a size,
            and a DM should not have to unlock the grid to change it. */}
        {onDiagonalRuleChange && (
          <div style={{ marginTop: "8px" }}>
            <span className="jrpg-text-small" style={{ display: "block", marginBottom: "4px" }}>
              Diagonals
            </span>
            <div style={{ display: "flex", gap: "4px" }}>
              {DIAGONAL_RULES.map((rule) => (
                <JRPGButton
                  key={rule}
                  onClick={() => onDiagonalRuleChange(rule)}
                  variant={diagonalRule === rule ? "primary" : "default"}
                  style={{ flex: 1, fontSize: "9px", padding: "6px 4px" }}
                >
                  {DIAGONAL_RULE_LABELS[rule]}
                </JRPGButton>
              ))}
            </div>
            <span
              style={{
                fontSize: "10px",
                opacity: 0.8,
                lineHeight: 1.3,
                display: "block",
                marginTop: "4px",
              }}
            >
              {DIAGONAL_RULE_HINTS[diagonalRule]}
            </span>
          </div>
        )}
      </div>
    </JRPGPanel>
  );
}
