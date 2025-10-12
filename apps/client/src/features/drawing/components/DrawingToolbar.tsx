// ============================================================================
// DRAWING TOOLBAR COMPONENT
// ============================================================================
// Draggable toolbar when draw mode is active
// Provides controls for drawing tool selection, colors, brush size, opacity, etc.

import { DraggableWindow } from "../../../components/dice/DraggableWindow";
import { JRPGPanel, JRPGButton } from "../../../components/ui/JRPGPanel";

export interface DrawingToolbarProps {
  drawTool: "freehand" | "line" | "rect" | "circle" | "eraser";
  drawColor: string;
  drawWidth: number;
  drawOpacity: number;
  drawFilled: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onToolChange: (tool: "freehand" | "line" | "rect" | "circle" | "eraser") => void;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
  onOpacityChange: (opacity: number) => void;
  onFilledChange: (filled: boolean) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClearAll: () => void;
}

const PRESET_COLORS = [
  "#ffffff", // White
  "#000000", // Black
  "#ff0000", // Enemy Red
  "#0000ff", // Ally Blue
  "#888888", // Wall Grey
  "#F0E2C3", // Hero Gold
  "#447DF7", // Hero Blue
  "#66cc66", // Success Green
  "#ffff00", // Yellow
  "#ff00ff", // Magenta
  "#00ffff", // Cyan
  "#ff8800", // Orange
];

export function DrawingToolbar({
  drawTool,
  drawColor,
  drawWidth,
  drawOpacity,
  drawFilled,
  canUndo = false,
  canRedo = false,
  onToolChange,
  onColorChange,
  onWidthChange,
  onOpacityChange,
  onFilledChange,
  onUndo,
  onRedo,
  onClearAll,
}: DrawingToolbarProps) {
  return (
    <DraggableWindow
      title="🎨 DRAWING TOOLS"
      initialX={8}
      initialY={100}
      width={250}
      minWidth={220}
      maxWidth={280}
      storageKey="drawing-toolbar"
      zIndex={200}
    >
      <JRPGPanel variant="bevel" style={{ padding: "8px" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {/* Tool Selection */}
          <div>
            <label
              className="jrpg-text-small"
              style={{ display: "block", marginBottom: "4px", color: "var(--jrpg-gold)" }}
            >
              Tool:
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
              <JRPGButton
                onClick={() => onToolChange("freehand")}
                variant={drawTool === "freehand" ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "6px 4px" }}
              >
                ✏️ Draw
              </JRPGButton>
              <JRPGButton
                onClick={() => onToolChange("line")}
                variant={drawTool === "line" ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "6px 4px" }}
              >
                📏 Line
              </JRPGButton>
              <JRPGButton
                onClick={() => onToolChange("rect")}
                variant={drawTool === "rect" ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "6px 4px" }}
              >
                ▭ Rect
              </JRPGButton>
              <JRPGButton
                onClick={() => onToolChange("circle")}
                variant={drawTool === "circle" ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "6px 4px" }}
              >
                ⬤ Circle
              </JRPGButton>
              <JRPGButton
                onClick={() => onToolChange("eraser")}
                variant={drawTool === "eraser" ? "primary" : "default"}
                style={{ gridColumn: "1 / -1", fontSize: "8px", padding: "6px 4px" }}
              >
                🧹 Eraser
              </JRPGButton>
            </div>
          </div>

          {/* Color Palette - Limited Retro Colors */}
          {drawTool !== "eraser" && (
            <div>
              <label
                className="jrpg-text-small"
                style={{ display: "block", marginBottom: "4px", color: "var(--jrpg-gold)" }}
              >
                Color:
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "4px",
                  marginBottom: "6px",
                }}
              >
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => onColorChange(color)}
                    style={{
                      width: "100%",
                      height: "28px",
                      background: color,
                      border:
                        drawColor === color
                          ? "3px solid var(--jrpg-gold)"
                          : "2px solid var(--jrpg-border-outer)",
                      cursor: "pointer",
                      padding: 0,
                      boxShadow:
                        drawColor === color
                          ? "0 0 8px var(--jrpg-gold)"
                          : "inset 0 0 0 1px var(--jrpg-border-shadow)",
                    }}
                    title={color}
                  />
                ))}
              </div>
              <input
                type="color"
                value={drawColor}
                onChange={(e) => onColorChange(e.target.value)}
                style={{
                  width: "100%",
                  height: "32px",
                  cursor: "pointer",
                  border: "2px solid var(--jrpg-border-outer)",
                }}
              />
            </div>
          )}

          {/* Brush Size */}
          <div>
            <label
              className="jrpg-text-small"
              style={{ display: "block", marginBottom: "4px", color: "var(--jrpg-gold)" }}
            >
              Brush Size: {drawWidth}px
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={drawWidth}
              onChange={(e) => onWidthChange(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          {/* Opacity */}
          {drawTool !== "eraser" && (
            <div>
              <label
                className="jrpg-text-small"
                style={{ display: "block", marginBottom: "4px", color: "var(--jrpg-gold)" }}
              >
                Opacity: {Math.round(drawOpacity * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={drawOpacity * 100}
                onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
                style={{ width: "100%" }}
              />
            </div>
          )}

          {/* Fill Toggle for Shapes */}
          {(drawTool === "rect" || drawTool === "circle") && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                id="drawFilled"
                type="checkbox"
                checked={drawFilled}
                onChange={(e) => onFilledChange(e.target.checked)}
              />
              <label
                htmlFor="drawFilled"
                className="jrpg-text-small"
                style={{ color: "var(--jrpg-white)" }}
              >
                Filled
              </label>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
            {/* Undo Button */}
            {onUndo && (
              <JRPGButton
                onClick={onUndo}
                variant="default"
                disabled={!canUndo}
                style={{ fontSize: "8px", padding: "6px" }}
              >
                ↶ Undo
              </JRPGButton>
            )}

            {/* Redo Button */}
            {onRedo && (
              <JRPGButton
                onClick={onRedo}
                variant="default"
                disabled={!canRedo}
                style={{ fontSize: "8px", padding: "6px" }}
              >
                ↷ Redo
              </JRPGButton>
            )}

            {/* Clear All Button */}
            <JRPGButton
              onClick={onClearAll}
              variant="danger"
              style={{ fontSize: "8px", padding: "6px" }}
            >
              🗑️ Clear All
            </JRPGButton>
          </div>
        </div>
      </JRPGPanel>
    </DraggableWindow>
  );
}
