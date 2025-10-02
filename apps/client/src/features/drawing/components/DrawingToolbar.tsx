// ============================================================================
// DRAWING TOOLBAR COMPONENT
// ============================================================================
// Fixed toolbar on the left side when draw mode is active
// Provides controls for drawing tool selection, colors, brush size, opacity, etc.

import type { ClientMessage } from "@shared";

export interface DrawingToolbarProps {
  drawTool: "freehand" | "line" | "rect" | "circle" | "eraser";
  drawColor: string;
  drawWidth: number;
  drawOpacity: number;
  drawFilled: boolean;
  onToolChange: (tool: "freehand" | "line" | "rect" | "circle" | "eraser") => void;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
  onOpacityChange: (opacity: number) => void;
  onFilledChange: (filled: boolean) => void;
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
  onToolChange,
  onColorChange,
  onWidthChange,
  onOpacityChange,
  onFilledChange,
  onClearAll,
}: DrawingToolbarProps) {
  return (
    <div
      className="drawing-toolbar"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        left: "8px",
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        minWidth: "200px",
        maxWidth: "250px"
      }}
    >
      <h4 className="title-pixel" style={{ margin: 0, color: "var(--hero-gold)", fontSize: "0.9rem" }}>
        Drawing Tools
      </h4>

      {/* Tool Selection */}
      <div>
        <label style={{ fontSize: "0.75rem", display: "block", marginBottom: "4px" }}>Tool:</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
          <button
            onClick={() => onToolChange("freehand")}
            className={drawTool === "freehand" ? "tool-button active" : "tool-button"}
            title="Freehand Draw"
          >
            ✏️ Draw
          </button>
          <button
            onClick={() => onToolChange("line")}
            className={drawTool === "line" ? "tool-button active" : "tool-button"}
            title="Line Tool"
          >
            📏 Line
          </button>
          <button
            onClick={() => onToolChange("rect")}
            className={drawTool === "rect" ? "tool-button active" : "tool-button"}
            title="Rectangle Tool"
          >
            ▭ Rect
          </button>
          <button
            onClick={() => onToolChange("circle")}
            className={drawTool === "circle" ? "tool-button active" : "tool-button"}
            title="Circle Tool"
          >
            ⬤ Circle
          </button>
          <button
            onClick={() => onToolChange("eraser")}
            className={drawTool === "eraser" ? "tool-button active" : "tool-button"}
            style={{ gridColumn: "1 / -1" }}
            title="Eraser"
          >
            🧹 Eraser
          </button>
        </div>
      </div>

      {/* Color Palette - Limited Retro Colors */}
      {drawTool !== "eraser" && (
        <div>
          <label style={{ fontSize: "0.75rem", display: "block", marginBottom: "4px" }}>Color:</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px", marginBottom: "6px" }}>
            {PRESET_COLORS.map(color => (
              <button
                key={color}
                onClick={() => onColorChange(color)}
                style={{
                  width: "100%",
                  height: "28px",
                  background: color,
                  border: drawColor === color ? "3px solid var(--hero-gold)" : "2px solid var(--hero-gold-light)",
                  cursor: "pointer",
                  padding: 0,
                  boxShadow: drawColor === color ? "0 0 8px var(--hero-gold)" : "none"
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
              cursor: "pointer"
            }}
          />
        </div>
      )}

      {/* Brush Size */}
      <div>
        <label style={{ fontSize: "0.75rem", display: "block", marginBottom: "4px" }}>
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
          <label style={{ fontSize: "0.75rem", display: "block", marginBottom: "4px" }}>
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
          <label htmlFor="drawFilled" style={{ fontSize: "0.75rem" }}>Filled</label>
        </div>
      )}

      {/* Clear All Button */}
      <button
        onClick={onClearAll}
        className="btn btn-danger"
        style={{
          fontSize: "0.75rem",
          marginTop: "8px"
        }}
      >
        🗑️ Clear All
      </button>
    </div>
  );
}
