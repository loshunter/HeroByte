import { JRPGButton } from "../../components/ui/JRPGPanel";
import { CancelGestureButton } from "../interaction/CancelGestureButton";
import type { MapEditToolbarProps } from "./mapEditTypes";

export function MapEditHistoryActions({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  activeSubTool,
}: Pick<MapEditToolbarProps, "canUndo" | "canRedo" | "onUndo" | "onRedo" | "activeSubTool">) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "4px",
        position: "sticky",
        top: 0,
        zIndex: 1,
        background: "var(--jrpg-navy)",
      }}
    >
      <JRPGButton
        onClick={onUndo}
        variant="default"
        disabled={!canUndo}
        title="Undo map edit"
        style={{ fontSize: "8px", padding: "6px", minHeight: 44 }}
      >
        ↶ Undo map
      </JRPGButton>
      <JRPGButton
        onClick={onRedo}
        variant="default"
        disabled={!canRedo}
        title="Redo map edit"
        style={{ fontSize: "8px", padding: "6px", minHeight: 44 }}
      >
        ↷ Redo map
      </JRPGButton>
      <CancelGestureButton
        idleLabel={
          activeSubTool === "terrain" || activeSubTool === "erase"
            ? "Cancel stroke"
            : "Cancel placement"
        }
        style={{ gridColumn: "1 / -1", fontSize: "9px" }}
      />
    </div>
  );
}
