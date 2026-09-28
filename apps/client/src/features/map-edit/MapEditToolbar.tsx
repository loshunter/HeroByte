import { DraggableWindow } from "../../components/dice/DraggableWindow";
import { JRPGButton } from "../../components/ui/JRPGPanel";
import { getMapStudioTileAsset } from "../map-studio/starterTiles";
import { BuildEntryPrompt } from "./BuildEntryPrompt";
import { MapEditActiveSettings } from "./MapEditActiveSettings";
import { MapEditDocumentPanels } from "./MapEditDocumentPanels";
import { MapEditPersistentControls } from "./MapEditPersistentControls";
import { MapEditToolGroups } from "./MapEditToolGroups";
import { MapEditToolPanels } from "./MapEditToolPanels";
import { TOOL_DESCRIPTORS } from "./mapEditToolDescriptors";
import type { MapEditToolbarProps } from "./mapEditTypes";
import "./mapEditPalette.css";

export function MapEditToolbar(props: MapEditToolbarProps) {
  const tool = props.activeSubTool;
  const assetId =
    tool === "terrain"
      ? `terrain:${props.floorFamily}`
      : tool === "place" || tool === "scatter" || tool === "row"
        ? props.selectedAssetId
        : null;
  return (
    <DraggableWindow
      title="🏗️ MAP TOOLS"
      onClose={props.onClose}
      initialX={8}
      initialY={100}
      width={300}
      minWidth={280}
      maxWidth={320}
      storageKey="map-edit-toolbar"
      zIndex={200}
      scrollContent={false}
    >
      <div className="map-edit-palette">
        {props.isLive && <MapEditPersistentControls {...props} />}
        <div className="map-edit-palette__scroll" data-testid="build-settings">
          {!props.isLive ? (
            <BuildEntryPrompt
              entry={props.buildEntry}
              busy={props.busy}
              onStartLiveMap={props.onStartLiveMap}
            />
          ) : (
            <>
              <MapEditDocumentPanels {...props} />
              <MapEditToolGroups toolbar={props} />
              <p className="jrpg-text-small">{TOOL_DESCRIPTORS[props.activeSubTool].help}</p>
              <MapEditToolPanels {...props} />
              <MapEditActiveSettings {...props} />
              <JRPGButton
                onClick={props.onToggleWallsOverlay}
                variant={props.wallsOverlayPinned ? "primary" : "default"}
                title="Keep the walls overlay visible after leaving map-edit (always shown while editing)"
              >
                {props.wallsOverlayPinned ? "📐 Walls: pinned" : "📐 Pin walls overlay"}
              </JRPGButton>
              {props.hasRasterBackground && (
                <p className="jrpg-text-small">
                  This table has a raster background. Live terrain may draw over it.
                </p>
              )}
            </>
          )}
          {props.error && (
            <p className="jrpg-text-small" role="alert">
              {props.error}
            </p>
          )}
        </div>
        <div className="map-edit-palette__footer">
          {props.isLive && (
            <p className="map-edit-armed" data-testid="map-edit-armed">
              {TOOL_DESCRIPTORS[tool].label}
              {assetId && ` · ${getMapStudioTileAsset(assetId).name}`}
              {(tool === "terrain" || tool === "erase") && (
                <>
                  {" · "}
                  <span className="map-edit-armed__size">{`${props.terrainBrushSize} × ${props.terrainBrushSize}`}</span>
                </>
              )}
            </p>
          )}
          <JRPGButton onClick={props.onClose}>Done building</JRPGButton>
        </div>
      </div>
    </DraggableWindow>
  );
}
