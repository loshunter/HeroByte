// ============================================================================
// MOBILE MAP-EDIT SHEET — the tool sheet the dock's ⚒ Tool slot opens
// ============================================================================
// Split out of MobileMapEditPalette ahead of M5, which adds five more tools and
// their sub-panels here; the sheet and the dock cannot share one file under the
// 348-line cap. Behaviour is unchanged — this is the same markup, moved.
//
// It lives under features/map-edit/mobile/ rather than beside the dock because
// that is where M5's touch-sized sub-panels go, and the sheet is what hosts
// them. Nothing here may import the DESKTOP palette's components: this file is
// reachable from the entry chunk through MobileFloatingControls, and a static
// import would drag the 7.2 KB map-edit chunk (a hover card, search, right-
// click pinning, 8px type) into every player's first load.
//
// It takes the WHOLE toolbar bag rather than the fields it reads, for the same
// reason the dock does — a subset is how a forwarding prop goes missing with a
// green typecheck.

import React from "react";
import type { DragTool } from "../mapEditToolKinds";
import type { MapEditToolbarProps } from "../mapEditTypes";
import { MobileMapEditToolPanels, PANEL_TOOLS } from "./MobileMapEditToolPanels";
import { MobilePopulateBlock } from "./MobilePopulateBlock";
import { MOBILE_TOOL_TILES } from "./mobileToolTiles";

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
  const { isLive, busy, activeSubTool, onSelectSubTool } = toolbar;

  // THE trap this mode carries: the controller no-ops SILENTLY without an
  // active live document, so a tool that looks armed does nothing and says
  // nothing. Every tool stays disabled until the palette can say ● LIVE.
  //
  // The sheet closes on a tool with NO dials and stays open on one that has
  // them. Tap counts are the same either way (Tool, tile, dial, To the map),
  // but the open version never requires the DM to KNOW that a tool they just
  // armed has options and that reopening the sheet is how to reach them.
  const selectSubTool = (tool: DragTool) => {
    onSelectSubTool(tool);
    if (!PANEL_TOOLS.has(tool)) onToggleTools();
  };

  const panelsOpen = isLive && PANEL_TOOLS.has(activeSubTool as DragTool);

  const recenter = () => {
    onResetCamera();
    onToggleTools();
  };

  const subToolClass = (tool: string) =>
    `mobile-tool-sheet__button${activeSubTool === tool ? " mobile-tool-sheet__button--active" : ""}`;

  return (
    <div
      className="mobile-tool-sheet"
      role="dialog"
      aria-label="Map tools"
      data-mobile-surface="tools"
    >
      <div className="mobile-tool-sheet__header">
        <strong>{isLive ? "● Live map" : "Map"}</strong>
        <button
          type="button"
          className="mobile-tool-sheet__close"
          onClick={onToggleTools}
          aria-label="Close tools"
        >
          ✕
        </button>
      </div>

      {!isLive ? (
        <>
          <p className="mobile-tool-sheet__note">
            Author the map on the live table. Rooms and walls appear for every player instantly.
          </p>
          <button
            type="button"
            className="mobile-tool-sheet__button mobile-tool-sheet__button--wide"
            onClick={toolbar.onStartLiveMap}
            disabled={busy}
          >
            {busy ? "Starting…" : "▶ Start live map"}
          </button>
        </>
      ) : (
        <div className="mobile-tool-sheet__grid">
          {MOBILE_TOOL_TILES.map((tile) => (
            <button
              key={tile.id}
              type="button"
              aria-pressed={activeSubTool === tile.id}
              className={subToolClass(tile.id)}
              onClick={() => selectSubTool(tile.id)}
            >
              <span aria-hidden="true">{tile.icon}</span>
              {tile.label}
            </button>
          ))}
          <button type="button" className="mobile-tool-sheet__button" onClick={recenter}>
            <span aria-hidden="true">◇</span>
            Recenter
          </button>
        </div>
      )}

      {panelsOpen && (
        <>
          <MobileMapEditToolPanels {...toolbar} />
          {/* "To the map", NOT "Use Room". The e2e locators for the tool tiles
              match on accessible name, and a second button carrying a tool's
              name is an immediate Playwright strict-mode violation. */}
          <button
            type="button"
            className="mobile-tool-sheet__button mobile-tool-sheet__button--wide"
            onClick={onToggleTools}
          >
            ▶ To the map
          </button>
        </>
      )}

      {/* Populate is a footer on every live tool, not a panel for one of them.
          It has no tile because it is not a sub-tool, and with the dock full
          there is nowhere else it could live — so gating it behind a
          particular armed tool would make it unreachable by accident. */}
      {isLive && <MobilePopulateBlock {...toolbar} />}

      {toolbar.error && (
        <p className="mobile-tool-sheet__note" role="alert">
          {toolbar.error}
        </p>
      )}
    </div>
  );
};
