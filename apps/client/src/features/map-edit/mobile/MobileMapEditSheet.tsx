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
import type { MapEditToolbarProps } from "../mapEditTypes";

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
  const selectSubTool = (tool: "room" | "wall") => {
    onSelectSubTool(tool);
    onToggleTools();
  };

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
          <button
            type="button"
            className={subToolClass("room")}
            onClick={() => selectSubTool("room")}
          >
            <span aria-hidden="true">🏠</span>
            Room
          </button>
          <button
            type="button"
            className={subToolClass("wall")}
            onClick={() => selectSubTool("wall")}
          >
            <span aria-hidden="true">▬</span>
            Wall
          </button>
          <button type="button" className="mobile-tool-sheet__button" onClick={recenter}>
            <span aria-hidden="true">◇</span>
            Recenter
          </button>
        </div>
      )}

      {toolbar.error && (
        <p className="mobile-tool-sheet__note" role="alert">
          {toolbar.error}
        </p>
      )}
    </div>
  );
};
