import type { DrawTool } from "@herobyte/shared";

export interface DrawingSettingsProps {
  drawTool: DrawTool;
  drawColor: string;
  drawWidth: number;
  drawOpacity: number;
  drawFilled: boolean;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
  onOpacityChange: (opacity: number) => void;
  onFilledChange: (filled: boolean) => void;
}

const PRESET_COLORS = [
  ["#ffffff", "White"],
  ["#000000", "Black"],
  ["#ff0000", "Red"],
  ["#0000ff", "Blue"],
  ["#888888", "Grey"],
  ["#F0E2C3", "Gold"],
  ["#447DF7", "Hero blue"],
  ["#66cc66", "Green"],
  ["#ffff00", "Yellow"],
  ["#ff00ff", "Magenta"],
  ["#00ffff", "Cyan"],
  ["#ff8800", "Orange"],
];

export function DrawingSettings({
  drawTool,
  drawColor,
  drawWidth,
  drawOpacity,
  drawFilled,
  onColorChange,
  onWidthChange,
  onOpacityChange,
  onFilledChange,
  mobile = false,
}: DrawingSettingsProps & { mobile?: boolean }) {
  const erasing = drawTool === "eraser";
  return (
    <div className="drawing-settings">
      {!erasing && (
        <div className="drawing-settings__color">
          {!mobile && (
            <div className="drawing-settings__presets">
              {PRESET_COLORS.map(([color, name]) => (
                <button
                  key={color}
                  type="button"
                  title={color}
                  aria-label={`${name} drawing color`}
                  aria-pressed={drawColor === color}
                  onClick={() => onColorChange(color)}
                  style={{
                    background: color,
                    border:
                      drawColor === color
                        ? "3px solid var(--jrpg-gold)"
                        : "2px solid var(--jrpg-border-outer)",
                    boxShadow:
                      drawColor === color
                        ? "0 0 8px var(--jrpg-gold)"
                        : "inset 0 0 0 1px var(--jrpg-border-shadow)",
                  }}
                />
              ))}
            </div>
          )}
          <label className="drawing-settings__color-label">
            <span>Color:</span>
            <input
              aria-label="Drawing color"
              type="color"
              value={drawColor}
              onChange={(event) => onColorChange(event.target.value)}
            />
          </label>
        </div>
      )}
      <label className="drawing-settings__range">
        <span>
          {erasing ? "Eraser" : "Stroke"} width (px): {drawWidth}
        </span>
        <input
          type="range"
          min="1"
          max="50"
          value={drawWidth}
          aria-label={`${erasing ? "Eraser" : "Stroke"} width (px)`}
          onChange={(event) => onWidthChange(Number(event.target.value))}
        />
      </label>
      {!erasing && (
        <label className="drawing-settings__range">
          <span>Opacity (%): {Math.round(drawOpacity * 100)}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={drawOpacity * 100}
            aria-label="Opacity (%)"
            onChange={(event) => onOpacityChange(Number(event.target.value) / 100)}
          />
        </label>
      )}
      {(drawTool === "rect" || drawTool === "circle") && (
        <label className="drawing-settings__fill">
          <input
            type="checkbox"
            checked={drawFilled}
            onChange={(event) => onFilledChange(event.target.checked)}
          />
          <span>Filled</span>
        </label>
      )}
    </div>
  );
}
