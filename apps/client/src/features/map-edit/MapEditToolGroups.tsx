import {
  AUTHORING_TOOLS,
  TOOL_DESCRIPTORS,
  TOOL_GROUPS,
  type MapEditGroup,
} from "./mapEditToolDescriptors";
import type { MapEditToolbarProps } from "./mapEditTypes";

/** Shared lightweight DOM/data; no desktop picker imports enter the phone bundle. */
export function MapEditToolGroups({
  toolbar,
  mobile = false,
  onSelectTool = toolbar.onSelectSubTool,
  onSelectGroup = toolbar.onSelectGroup,
}: {
  toolbar: MapEditToolbarProps;
  mobile?: boolean;
  onSelectTool?: MapEditToolbarProps["onSelectSubTool"];
  onSelectGroup?: MapEditToolbarProps["onSelectGroup"];
}) {
  const group = TOOL_DESCRIPTORS[toolbar.activeSubTool].group ?? toolbar.activeGroup;
  return (
    <div className="map-edit-tool-groups">
      <label className="map-edit-group-label">
        Tool group
        <select
          aria-label="Tool group"
          className="mobile-tool-sheet__select"
          value={group}
          onChange={(event) => onSelectGroup(event.target.value as MapEditGroup)}
        >
          {TOOL_GROUPS.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="map-edit-tool-grid">
        {AUTHORING_TOOLS.filter((id) => TOOL_DESCRIPTORS[id].group === group).map((id) => {
          const tool = TOOL_DESCRIPTORS[id];
          const active = toolbar.activeSubTool === id;
          return (
            <button
              key={id}
              type="button"
              data-testid={`build-tool-${id}`}
              aria-pressed={active}
              title={tool.help}
              onClick={() => onSelectTool(id)}
              className={
                mobile
                  ? `mobile-tool-sheet__button${active ? " mobile-tool-sheet__button--active" : ""}`
                  : `jrpg-button${active ? " jrpg-button-primary" : ""}`
              }
            >
              <span aria-hidden="true">{tool.icon}</span> {tool.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
