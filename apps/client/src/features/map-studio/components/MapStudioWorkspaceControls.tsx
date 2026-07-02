import { JRPGButton } from "../../../components/ui/JRPGPanel";
import { topBarStyle } from "./mapStudioWorkspaceStyles";

export function StudioTopBar({
  title,
  saving,
  canUndo,
  canRedo,
  publishDisabled = false,
  onUndo,
  onRedo,
  onPublish,
  onExit,
  onZoomIn,
  onZoomOut,
  onResetView,
}: {
  title: string;
  saving: boolean;
  canUndo: boolean;
  canRedo: boolean;
  publishDisabled?: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onPublish: () => void;
  onExit: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetView?: () => void;
}) {
  return (
    <div style={topBarStyle}>
      <strong style={{ color: "#f0e2c3", fontSize: 11 }}>{title}</strong>
      <span className="jrpg-text-small" style={{ opacity: 0.8 }}>
        {saving ? "Saving..." : "Saved"}
      </span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {onZoomIn && (
          <JRPGButton disabled={saving} onClick={onZoomIn}>
            Zoom In
          </JRPGButton>
        )}
        {onZoomOut && (
          <JRPGButton disabled={saving} onClick={onZoomOut}>
            Zoom Out
          </JRPGButton>
        )}
        {onResetView && (
          <JRPGButton disabled={saving} onClick={onResetView}>
            Fit
          </JRPGButton>
        )}
        <JRPGButton disabled={saving || !canUndo} onClick={onUndo}>
          Undo
        </JRPGButton>
        <JRPGButton disabled={saving || !canRedo} onClick={onRedo}>
          Redo
        </JRPGButton>
        <JRPGButton variant="primary" disabled={saving || publishDisabled} onClick={onPublish}>
          Publish
        </JRPGButton>
        <JRPGButton onClick={onExit}>Back to Table</JRPGButton>
      </div>
    </div>
  );
}

export function ToolButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <JRPGButton
      variant={active ? "primary" : "default"}
      style={{ width: "100%", fontSize: 9, padding: "8px 6px" }}
      onClick={onClick}
    >
      {label}
    </JRPGButton>
  );
}
