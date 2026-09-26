import type { DrawTool } from "@herobyte/shared";
import { CancelGestureButton } from "../features/interaction/CancelGestureButton";
import { DRAWING_TOOLS, DRAWING_TOOL_LABELS } from "../features/drawing/drawingTools";
import {
  DrawingSettings,
  type DrawingSettingsProps,
} from "../features/drawing/components/DrawingSettings";

interface MobileDrawingControlsProps extends DrawingSettingsProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onToolChange: (tool: DrawTool) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClose: () => void;
}

export function MobileDrawingControls(props: MobileDrawingControlsProps): JSX.Element {
  const {
    collapsed,
    onCollapsedChange,
    drawTool,
    canUndo = false,
    canRedo = false,
    onToolChange,
    onUndo,
    onRedo,
    onClose,
  } = props;
  return (
    <div
      className={`mobile-drawing-sheet${collapsed ? " mobile-drawing-sheet--collapsed" : ""}`}
      role="toolbar"
      aria-label="Drawing tools"
    >
      {!collapsed && (
        <>
          <section aria-label="Drawing tool">
            <h3 className="drawing-section-title">Tool</h3>
            <div className="mobile-drawing-sheet__tools">
              {DRAWING_TOOLS.map((tool) => (
                <button
                  key={tool}
                  type="button"
                  aria-pressed={drawTool === tool}
                  className={`mobile-chip${drawTool === tool ? " mobile-chip--active" : ""}`}
                  onClick={() => onToolChange(tool)}
                >
                  {DRAWING_TOOL_LABELS[tool]}
                </button>
              ))}
            </div>
          </section>
          <section aria-label="Drawing settings">
            <h3 className="drawing-section-title">Settings</h3>
            <DrawingSettings {...props} mobile />
          </section>
        </>
      )}
      <section aria-label="Drawing history">
        <h3 className="drawing-section-title">
          {collapsed ? `Drawing: ${DRAWING_TOOL_LABELS[drawTool]}` : "History"}
        </h3>
        <div className="mobile-drawing-sheet__history">
          <button
            type="button"
            className="mobile-chip"
            aria-label={`${collapsed ? "Show" : "Hide"} drawing controls`}
            aria-expanded={!collapsed}
            onClick={() => onCollapsedChange(!collapsed)}
          >
            {collapsed ? "Show controls" : "Hide controls"}
          </button>
          {onUndo && (
            <button
              type="button"
              className="mobile-chip"
              aria-label="Undo drawing"
              onClick={onUndo}
              disabled={!canUndo}
            >
              Undo drawing
            </button>
          )}
          {onRedo && (
            <button
              type="button"
              className="mobile-chip"
              aria-label="Redo drawing"
              onClick={onRedo}
              disabled={!canRedo}
            >
              Redo drawing
            </button>
          )}
          <CancelGestureButton
            idleLabel="Cancel stroke"
            className="mobile-chip"
            style={{ whiteSpace: "normal" }}
          />
          <button type="button" className="mobile-chip" onClick={onClose}>
            Done drawing
          </button>
        </div>
      </section>
    </div>
  );
}
