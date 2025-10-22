// ============================================================================
// GRID CONTROL
// ============================================================================
// Extracted from DMMenu.tsx as part of Phase 3: Simple Map Controls.
// Provides interface for configuring grid size, square size (feet), and lock state.

import { JRPGPanel, JRPGButton } from "../../../../components/ui/JRPGPanel";
import { CollapsibleSection } from "../../../../components/ui/CollapsibleSection";

export interface GridControlProps {
  gridSize: number;
  gridSquareSize?: number; // Feet per square
  gridLocked: boolean;
  onGridSizeChange: (size: number) => void;
  onGridSquareSizeChange?: (size: number) => void;
  onGridLockToggle: () => void;
}

export function GridControl({
  gridSize,
  gridSquareSize = 5,
  gridLocked,
  onGridSizeChange,
  onGridSquareSizeChange,
  onGridLockToggle,
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
      </div>
    </JRPGPanel>
  );
}
