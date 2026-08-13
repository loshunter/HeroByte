// ============================================================================
// MOBILE MAP-EDIT PALETTE — the dock BECOMES the palette
// ============================================================================
// Map authoring is a Mode, not a Sheet (redesign §1): it is the one activity
// where you must see the whole canvas, and a sheet big enough for the tool
// grid eats most of a 375x812 phone. So while map-edit is armed the dock is
// replaced rather than added to, and nothing else covers the map.
//
// This file is now the composer for the two halves — the dock that replaces
// the player dock, and the sheet its ⚒ Tool slot opens. They were split ahead
// of M5, which adds five tools and their sub-panels to the sheet: the pair
// cannot share one file under the 348-line cap, and the repo's rule is to
// extract BEFORE adding rather than after crossing.
//
// The sheet is rendered conditionally HERE rather than self-gating on an `open`
// prop, so the DOM is identical to what the single file produced.

import React from "react";
import type { MapEditToolbarProps } from "../../features/map-edit/mapEditTypes";
import { MobileMapEditSheet } from "../../features/map-edit/mobile/MobileMapEditSheet";
import { MobileMapEditDock } from "./MobileMapEditDock";

interface MobileMapEditPaletteProps {
  toolbar: MapEditToolbarProps;
  toolsOpen: boolean;
  onToggleTools: () => void;
  /** Abandon the gesture in flight (bumps MobileLayout's cancel signal). */
  onCancelDrag: () => void;
  onResetCamera: () => void;
}

export const MobileMapEditPalette: React.FC<MobileMapEditPaletteProps> = ({
  toolbar,
  toolsOpen,
  onToggleTools,
  onCancelDrag,
  onResetCamera,
}) => (
  <>
    {toolsOpen && (
      <MobileMapEditSheet
        toolbar={toolbar}
        onToggleTools={onToggleTools}
        onResetCamera={onResetCamera}
      />
    )}

    <MobileMapEditDock
      toolbar={toolbar}
      toolsOpen={toolsOpen}
      onToggleTools={onToggleTools}
      onCancelDrag={onCancelDrag}
    />
  </>
);
