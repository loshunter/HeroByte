import { CancelGestureButton } from "../../features/interaction/CancelGestureButton";
import React from "react";
import type { MapEditToolbarProps } from "../../features/map-edit/mapEditTypes";
import { TOOL_DESCRIPTORS } from "../../features/map-edit/mapEditToolDescriptors";
import { getMapStudioTileAsset } from "../../features/map-studio/starterTiles";

interface MobileMapEditDockProps {
  toolbar: MapEditToolbarProps;
  toolsOpen: boolean;
  onToggleTools: () => void;
}

export const MobileMapEditDock: React.FC<MobileMapEditDockProps> = ({
  toolbar,
  toolsOpen,
  onToggleTools,
}) => {
  const { isLive } = toolbar;
  const tool = toolbar.activeSubTool;
  const brush = tool === "terrain" || tool === "erase";
  const assetId =
    tool === "terrain"
      ? `terrain:${toolbar.floorFamily}`
      : tool === "place" || tool === "scatter" || tool === "row"
        ? toolbar.selectedAssetId
        : null;

  return (
    <nav className="mobile-action-dock" aria-label="Map edit actions">
      {isLive && !toolsOpen && (
        <span className="mobile-map-edit-armed" data-testid="map-edit-armed">
          {TOOL_DESCRIPTORS[tool].label}
          {assetId && ` · ${getMapStudioTileAsset(assetId).name}`}
          {brush && (
            <>
              {" "}
              ·{" "}
              <span className="mobile-map-edit-armed__size">{`${toolbar.terrainBrushSize} × ${toolbar.terrainBrushSize}`}</span>
            </>
          )}
          {toolbar.saving && (
            <>
              {" "}
              · <span>Saving…</span>
            </>
          )}
        </span>
      )}
      {/* Saving is ambient feedback for the current round trip. Terrain strokes
          queue; tools that reject a gesture while saving also show a toast.

          Absolutely positioned, which is load-bearing rather than cosmetic:
          the dock is `grid-template-columns: repeat(5, minmax(0, 1fr))`, a
          sixth IN-FLOW child takes a column and overlaps rather than wraps,
          and a ::after on a grid container is itself a grid item. Out of flow
          is what keeps the five slots — and the test that pins them — intact.

          No role="status" and no aria-live, on purpose. There is no
          visually-hidden utility here, and a live region that fires on every
          command — a few hundred milliseconds apart while authoring — would
          narrate a screen reader into uselessness. The event actually worth
          announcing already speaks: the dropped-gesture toast, which fires
          only when something was LOST. This is ambient, and reads as ordinary
          text to anyone browsing the dock. */}
      {toolbar.saving && (toolsOpen || !isLive) && (
        <span className="mobile-dock-saving">Saving…</span>
      )}
      <button
        type="button"
        className="mobile-dock-button"
        onClick={toolbar.onClose}
        aria-label="Done building"
      >
        <span className="mobile-dock-button__icon" aria-hidden="true">
          ✕
        </span>
        Done
      </button>
      <button
        type="button"
        className={`mobile-dock-button${toolsOpen ? " mobile-dock-button--active" : ""}`}
        onClick={onToggleTools}
        aria-expanded={toolsOpen}
      >
        <span className="mobile-dock-button__icon" aria-hidden="true">
          ⚒
        </span>
        Tool
      </button>
      <button
        type="button"
        className="mobile-dock-button"
        aria-label="Undo map edit"
        onClick={toolbar.onUndo}
        disabled={!isLive || !toolbar.canUndo}
      >
        <span className="mobile-dock-button__icon" aria-hidden="true">
          ↶
        </span>
        Undo
      </button>
      <button
        type="button"
        className="mobile-dock-button"
        aria-label="Redo map edit"
        onClick={toolbar.onRedo}
        disabled={!isLive || !toolbar.canRedo}
      >
        <span className="mobile-dock-button__icon" aria-hidden="true">
          ↷
        </span>
        Redo
      </button>
      <CancelGestureButton
        idleLabel={
          toolbar.activeSubTool === "terrain" || toolbar.activeSubTool === "erase"
            ? "Cancel stroke"
            : "Cancel placement"
        }
        dock
        className="mobile-dock-button"
      />
    </nav>
  );
};
