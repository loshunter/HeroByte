import { JRPGButton } from "../../components/ui/JRPGPanel";
import { MapEditHistoryActions } from "./MapEditHistoryActions";
import { PERSISTENT_TOOLS, TOOL_DESCRIPTORS } from "./mapEditToolDescriptors";
import type { MapEditToolbarProps } from "./mapEditTypes";

export function MapEditPersistentControls(props: MapEditToolbarProps) {
  return (
    <div className="map-edit-palette__persistent" data-testid="build-persistent-controls">
      <strong className="map-edit-map-name">{props.mapName}</strong>
      <div className="jrpg-text-small">
        <span>● LIVE</span> · Edits appear on the table.
      </div>
      {props.busy && <span className="jrpg-text-small">loading…</span>}
      {props.saving && (
        <div className="jrpg-text-small">
          <span>saving…</span> Working — wait before placing.
        </div>
      )}
      <MapEditHistoryActions {...props} />
      <div className="map-edit-tool-grid">
        {PERSISTENT_TOOLS.map((id) => (
          <JRPGButton
            key={id}
            data-testid={`build-tool-${id}`}
            aria-pressed={props.activeSubTool === id}
            title={TOOL_DESCRIPTORS[id].help}
            variant={props.activeSubTool === id ? "primary" : "default"}
            onClick={() => props.onSelectSubTool(id)}
          >
            {TOOL_DESCRIPTORS[id].icon} {TOOL_DESCRIPTORS[id].label}
          </JRPGButton>
        ))}
        <JRPGButton
          onClick={props.onToggleLayers}
          aria-expanded={props.layersOpen}
          variant={props.layersOpen ? "primary" : "default"}
        >
          🗂 Layers
        </JRPGButton>
        <JRPGButton
          onClick={props.onToggleInspector}
          aria-expanded={props.inspectorOpen}
          variant={props.inspectorOpen ? "primary" : "default"}
        >
          🔍 Inspect
        </JRPGButton>
      </div>
    </div>
  );
}
