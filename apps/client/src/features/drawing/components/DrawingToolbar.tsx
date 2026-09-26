import { AREA_TEMPLATE_TOOLS, type DrawTool } from "@herobyte/shared";
import { CancelGestureButton } from "../../interaction/CancelGestureButton";
import { DraggableWindow } from "../../../components/dice/DraggableWindow";
import { JRPGPanel, JRPGButton } from "../../../components/ui/JRPGPanel";
import { ANNOTATION_TOOLS, DRAWING_TOOL_ICONS, DRAWING_TOOL_LABELS } from "../drawingTools";
import { DrawingSettings, type DrawingSettingsProps } from "./DrawingSettings";

export interface DrawingToolbarProps extends DrawingSettingsProps {
  onClose?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  canClearAll?: boolean;
  onToolChange: (tool: DrawTool) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClearAll: () => void;
}

export function DrawingToolbar(props: DrawingToolbarProps) {
  const {
    drawTool,
    onToolChange,
    onClose,
    canUndo = false,
    canRedo = false,
    canClearAll = false,
    onUndo,
    onRedo,
    onClearAll,
  } = props;
  const tools = (inventory: readonly DrawTool[]) =>
    inventory.map((tool) => (
      <JRPGButton
        key={tool}
        onClick={() => onToolChange(tool)}
        aria-pressed={drawTool === tool}
        variant={drawTool === tool ? "primary" : "default"}
        style={{
          fontSize: "8px",
          padding: "6px 4px",
          ...(tool === "eraser" ? { gridColumn: "1 / -1" } : {}),
        }}
      >
        {DRAWING_TOOL_ICONS[tool]} {DRAWING_TOOL_LABELS[tool]}
      </JRPGButton>
    ));
  return (
    <DraggableWindow
      title="🎨 DRAWING TOOLS"
      onClose={onClose}
      initialX={8}
      initialY={100}
      width={250}
      minWidth={220}
      maxWidth={280}
      storageKey="drawing-toolbar"
      zIndex={200}
    >
      <JRPGPanel variant="bevel" style={{ padding: "8px" }}>
        <div className="drawing-controls">
          <section aria-label="Drawing tool">
            <h3 className="drawing-section-title">Tool</h3>
            <div className="drawing-toolbar__tools">{tools(ANNOTATION_TOOLS)}</div>
            <h4 className="drawing-section-title">Area templates</h4>
            <div className="drawing-toolbar__tools">{tools(AREA_TEMPLATE_TOOLS)}</div>
            <p className="drawing-toolbar__help">
              Drag from the origin; size snaps to whole squares.
            </p>
          </section>
          <section aria-label="Drawing settings">
            <h3 className="drawing-section-title">Settings</h3>
            <DrawingSettings {...props} />
          </section>
          <section aria-label="Drawing history">
            <h3 className="drawing-section-title">History</h3>
            <div className="drawing-toolbar__history">
              {onUndo && (
                <JRPGButton onClick={onUndo} variant="default" disabled={!canUndo}>
                  ↶ Undo drawing
                </JRPGButton>
              )}
              {onRedo && (
                <JRPGButton onClick={onRedo} variant="default" disabled={!canRedo}>
                  ↷ Redo drawing
                </JRPGButton>
              )}
              {canClearAll && (
                <JRPGButton onClick={onClearAll} variant="danger">
                  🗑️ Clear all drawings
                </JRPGButton>
              )}
            </div>
          </section>
          <CancelGestureButton idleLabel="Cancel stroke" style={{ fontSize: "9px" }} />
          {onClose && <JRPGButton onClick={onClose}>Done drawing</JRPGButton>}
        </div>
      </JRPGPanel>
    </DraggableWindow>
  );
}
