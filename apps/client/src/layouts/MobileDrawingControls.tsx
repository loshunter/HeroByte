import type { MainLayoutProps } from "./props/MainLayoutProps";

interface MobileDrawingControlsProps {
  drawTool: MainLayoutProps["drawingToolbarProps"]["drawTool"];
  drawColor: string;
  drawWidth: number;
  canUndo?: boolean;
  canRedo?: boolean;
  onToolChange: MainLayoutProps["drawingToolbarProps"]["onToolChange"];
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClose: () => void;
}

export function MobileDrawingControls({
  drawTool,
  drawColor,
  drawWidth,
  canUndo = false,
  canRedo = false,
  onToolChange,
  onColorChange,
  onWidthChange,
  onUndo,
  onRedo,
  onClose,
}: MobileDrawingControlsProps): JSX.Element {
  return (
    <div className="mobile-drawing-sheet" role="toolbar" aria-label="Drawing tools">
      <div className="mobile-drawing-sheet__tools">
        {(["freehand", "line", "rect", "circle", "eraser"] as const).map((tool) => (
          <button
            key={tool}
            type="button"
            className={`mobile-chip${drawTool === tool ? " mobile-chip--active" : ""}`}
            onClick={() => onToolChange(tool)}
          >
            {tool === "freehand" ? "Free" : tool}
          </button>
        ))}
      </div>
      <label className="mobile-drawing-sheet__control">
        <span>Size {drawWidth}px</span>
        <input
          type="range"
          min="1"
          max="50"
          value={drawWidth}
          onChange={(event) => onWidthChange(Number(event.target.value))}
        />
      </label>
      <input
        aria-label="Drawing color"
        className="mobile-drawing-sheet__color"
        type="color"
        value={drawColor}
        onChange={(event) => onColorChange(event.target.value)}
      />
      {onUndo && (
        <button type="button" className="mobile-chip" onClick={onUndo} disabled={!canUndo}>
          Undo
        </button>
      )}
      {onRedo && (
        <button type="button" className="mobile-chip" onClick={onRedo} disabled={!canRedo}>
          Redo
        </button>
      )}
      <button type="button" className="mobile-chip" onClick={onClose}>
        Done
      </button>
    </div>
  );
}
