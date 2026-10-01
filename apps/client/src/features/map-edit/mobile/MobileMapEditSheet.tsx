import React from "react";
import type { MapEditSubTool, MapEditToolbarProps } from "../mapEditTypes";
import { MobileMapEditToolPanels, PANEL_TOOLS } from "./MobileMapEditToolPanels";
import { MobileLayersPanel } from "./MobileLayersPanel";
import { MobilePopulateBlock } from "./MobilePopulateBlock";
import { MapEditToolGroups } from "../MapEditToolGroups";
import { PERSISTENT_TOOLS, TOOL_DESCRIPTORS } from "../mapEditToolDescriptors";
import "../mapEditPalette.css";
import { useRevealMapPanel } from "../useRevealMapPanel";
import { BuildEntryPrompt } from "../BuildEntryPrompt";
import { RESET_VIEW_TITLE } from "../../../components/layout/viewWords";

interface MobileMapEditSheetProps {
  toolbar: MapEditToolbarProps;
  onToggleTools: () => void;
  onResetCamera: () => void;
}

export const MobileMapEditSheet: React.FC<MobileMapEditSheetProps> = ({
  toolbar,
  onToggleTools,
  onResetCamera,
}) => {
  const { isLive, busy, activeSubTool } = toolbar;
  const layersRef = useRevealMapPanel(toolbar.layersOpen);
  const closeToAim = (tool: MapEditSubTool) => {
    if (!PANEL_TOOLS.has(tool)) onToggleTools();
  };
  const selectSubTool = (tool: MapEditSubTool) => {
    toolbar.onSelectSubTool(tool);
    closeToAim(tool);
  };
  const selectGroup: MapEditToolbarProps["onSelectGroup"] = (group) => {
    const tool = toolbar.onSelectGroup(group);
    closeToAim(tool);
    return tool;
  };
  const recenter = () => {
    onResetCamera();
    onToggleTools();
  };
  return (
    <div
      className="mobile-tool-sheet mobile-tool-sheet--build"
      role="dialog"
      aria-label="Map tools"
      data-mobile-surface="tools"
    >
      <div className="mobile-tool-sheet__header">
        <strong className="map-edit-map-name">{isLive ? toolbar.mapName : "Map"}</strong>
        <button
          type="button"
          className="mobile-tool-sheet__close"
          onClick={onToggleTools}
          aria-label="Close tools"
        >
          ✕
        </button>
      </div>
      {isLive && (
        <div className="map-edit-palette__persistent" data-testid="build-persistent-controls">
          <span className="mobile-tool-sheet__note">● Live map · Edits appear on the table.</span>
          <div className="mobile-build-controls">
            {PERSISTENT_TOOLS.map((id) => (
              <button
                key={id}
                type="button"
                data-testid={`build-tool-${id}`}
                aria-pressed={activeSubTool === id}
                title={TOOL_DESCRIPTORS[id].help}
                className={`mobile-tool-sheet__button${activeSubTool === id ? " mobile-tool-sheet__button--active" : ""}`}
                onClick={() => selectSubTool(id)}
              >
                <span aria-hidden="true">{TOOL_DESCRIPTORS[id].icon}</span>
                {TOOL_DESCRIPTORS[id].label}
              </button>
            ))}
            <button
              type="button"
              className="mobile-tool-sheet__button"
              aria-expanded={toolbar.layersOpen}
              onClick={toolbar.onToggleLayers}
              data-testid="mobile-layers-toggle"
            >
              <span aria-hidden="true">🗂</span>Layers
            </button>
          </div>
        </div>
      )}
      <div className="map-edit-palette__scroll" data-testid="build-settings">
        {!isLive ? (
          <BuildEntryPrompt
            entry={toolbar.buildEntry}
            busy={busy}
            onStartLiveMap={toolbar.onStartLiveMap}
            mobile
          />
        ) : (
          <>
            {(toolbar.saving || busy) && (
              <p className="mobile-tool-sheet__note">Working… wait before placing.</p>
            )}
            {toolbar.layersOpen && (
              <div ref={layersRef}>
                <MobileLayersPanel
                  layers={toolbar.layers}
                  open={toolbar.layersOpen}
                  saving={toolbar.saving}
                  onUpdateLayer={toolbar.onUpdateLayer}
                />
              </div>
            )}
            <MapEditToolGroups
              toolbar={toolbar}
              mobile
              onSelectTool={selectSubTool}
              onSelectGroup={selectGroup}
            />
            <p className="mobile-tool-sheet__note">{TOOL_DESCRIPTORS[activeSubTool].help}</p>
            {(activeSubTool === "room" || activeSubTool === "hallway") && (
              <MobilePopulateBlock {...toolbar} />
            )}
            {PANEL_TOOLS.has(activeSubTool) && <MobileMapEditToolPanels {...toolbar} />}
            <button
              type="button"
              className="mobile-tool-sheet__button"
              title={RESET_VIEW_TITLE}
              onClick={recenter}
            >
              ◇ Reset view
            </button>
          </>
        )}
        {toolbar.error && (
          <p className="mobile-tool-sheet__note" role="alert">
            {toolbar.error}
          </p>
        )}
      </div>
      {isLive && (
        <div className="map-edit-palette__footer">
          <button
            type="button"
            className="mobile-tool-sheet__button mobile-tool-sheet__button--wide"
            onClick={onToggleTools}
          >
            ▶ To the map
          </button>
        </div>
      )}
    </div>
  );
};
