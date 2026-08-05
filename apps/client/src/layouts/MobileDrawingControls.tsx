import { AREA_TEMPLATE_TOOLS, type DrawTool } from "@herobyte/shared";
import type { MainLayoutProps } from "./props/MainLayoutProps";

const DRAWING_TOOLS: readonly DrawTool[] = [
  "freehand",
  "line",
  "rect",
  "circle",
  "eraser",
  ...AREA_TEMPLATE_TOOLS,
];

/** Short enough to fit a 96px chip at 375px wide. */
const MOBILE_TOOL_LABELS: Record<DrawTool, string> = {
  freehand: "Free",
  line: "line",
  rect: "rect",
  circle: "circle",
  eraser: "eraser",
  // Named for what they ARE, not for their shape: "line" already appears in
  // this row as the freehand line tool, and two chips reading LINE at 375px is
  // a coin toss. The 5e names disambiguate and are shorter than the geometry.
  "template-circle": "AoE Burst",
  "template-cone": "AoE Cone",
  "template-square": "AoE Cube",
  "template-line": "AoE Bolt",
};

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
      {/* Templates ride the same chip row as the plain tools (S6). This is
          their mobile home: the dock is a hardcoded 5-column grid, and a
          template tool is a DRAWING tool, so it needs no new sheet, no new
          prop and no new gesture — the touch path already arms drawing. Size
          comes from the drag, so there is no numeric field to squeeze in. */}
      <div className="mobile-drawing-sheet__tools">
        {DRAWING_TOOLS.map((tool) => (
          <button
            key={tool}
            type="button"
            className={`mobile-chip${drawTool === tool ? " mobile-chip--active" : ""}`}
            onClick={() => onToolChange(tool)}
          >
            {MOBILE_TOOL_LABELS[tool]}
          </button>
        ))}
      </div>
      {/* Colour before size: it fills the grid cell left over by the five tool
          chips, so the full-width size slider starts on a clean row. */}
      <input
        aria-label="Drawing color"
        className="mobile-drawing-sheet__color"
        type="color"
        value={drawColor}
        onChange={(event) => onColorChange(event.target.value)}
      />
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
