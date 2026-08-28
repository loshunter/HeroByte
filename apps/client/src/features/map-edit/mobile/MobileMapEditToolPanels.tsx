// The armed tool's dials, rendered below the tool grid in the same sheet.
//
// Which tools HAVE dials is exported as PANEL_TOOLS rather than hard-coded in
// the sheet, because the sheet's open/close rule keys off it: a tool with dials
// keeps the sheet open so the DM can set them, a tool without one closes it so
// the map is visible. Two lists would let the rule and the panels disagree —
// a tool that keeps the sheet open showing nothing, or one that closes it over
// dials the DM never sees.
//
// Nothing here may import the desktop panels. This file is reachable from the
// entry chunk through MobileFloatingControls, so a static import of
// MapEditSwatchGrid / MapEditAssetPicker / MapEditBrushDeck / GeneratePanel
// would pull the 7.2 KB desktop map-edit chunk into every player's first load —
// and ship 8px type and ~20px hit targets to a phone while doing it. The DATA
// those components read (PAINT_FAMILIES, the tile catalog) is already in the
// entry chunk and is free to use.

import React from "react";
import { MAP_STUDIO_TILE_ASSETS } from "../../map-studio/starterTiles";
import { PAINT_FAMILIES, WALL_FAMILIES } from "../mapEditFamilies";
import type { TouchTool } from "../mapEditToolKinds";
import type { MapEditSplineKind, MapEditToolbarProps, MapEditWallFamily } from "../mapEditTypes";
import { MobileFloorPicker } from "./MobileFloorPicker";
import { MobileGeneratePanel } from "./MobileGeneratePanel";
import { MobileSelectPanel } from "./MobileSelectPanel";
import { MobileSwatchRow } from "./MobileSwatchRow";

/**
 * A tool the sheet can render a panel for. Every tool a finger arms qualifies,
 * plus "select" — which arms no touch gesture at all (see MobileSelectPanel for
 * why it works anyway), but does own a panel and so obeys the same open/close
 * rule as the rest.
 */
export type SheetPanelTool = TouchTool | "select";

/** The tools whose panel below is non-empty — the sheet's open/close rule.
 *
 * Paint is here and Erase is not, which is the whole difference between them:
 * Paint carries the family picker, Erase takes no argument at all, so it closes
 * the sheet and puts the DM straight on the map. */
export const PANEL_TOOLS: ReadonlySet<SheetPanelTool> = new Set<SheetPanelTool>([
  "terrain",
  "room",
  "hallway",
  "row",
  "spline",
  "generate",
  "select",
]);

const HALLWAY_WIDTHS = [1, 2, 3, 4] as const;

const SPLINE_KINDS: { id: MapEditSplineKind; label: string }[] = [
  { id: "rope", label: "Rope" },
  { id: "chain", label: "Chain" },
  { id: "ribbon", label: "Ribbon" },
  { id: "filigree", label: "Filigree" },
];

/** A wall material, or no ring at all. Names lose a trailing " Wall" exactly as
 * the desktop palette does, so "Stone Wall" swatches as "Stone". */
const WALL_RING_OPTIONS: { id: MapEditWallFamily | "none"; label: string; fill?: string }[] = [
  { id: "none", label: "None" },
  ...WALL_FAMILIES.map((family) => {
    const entry = PAINT_FAMILIES.find((candidate) => candidate.family === family);
    return {
      id: family,
      label: (entry?.name ?? family).replace(/ Wall$/, ""),
      fill: entry?.fill,
      stroke: entry?.stroke,
    };
  }),
];

/** Row stamps a bundled object along the drag. Derived from the catalog rather
 * than a hand-listed six, so a new bundled object appears without an edit. */
const ROW_ASSETS = MAP_STUDIO_TILE_ASSETS.filter((asset) => asset.category === "objects").map(
  (asset) => ({ id: asset.id, label: asset.name, fill: asset.fill, stroke: asset.stroke }),
);

export function MobileMapEditToolPanels(props: MapEditToolbarProps): JSX.Element | null {
  // Generate takes the whole bag: it reads eight fields, and listing them here
  // to forward them one by one is how a forwarding prop goes missing.
  if (props.activeSubTool === "generate") return <MobileGeneratePanel {...props} />;
  // Select's panel is a readout of the current selection plus DELETE — it takes
  // the bag for the same reason, and is imported STATICALLY: React caches a
  // rejected lazy chunk forever, and the phone's only delete route is the last
  // thing that should be reachable only on a good network.
  if (props.activeSubTool === "select") return <MobileSelectPanel {...props} />;
  return <ToolDials {...props} />;
}

function ToolDials({
  activeSubTool,
  floorFamily,
  onSelectFloorFamily,
  roomWallFamily,
  onSelectRoomWallFamily,
  hallwayWidth,
  onSelectHallwayWidth,
  splineKind,
  onSelectSplineKind,
  selectedAssetId,
  onSelectAsset,
}: MapEditToolbarProps): JSX.Element | null {
  // Paint writes the SAME family Room and Hall fill with — one swatch state,
  // exactly as the desktop toolbar shares MapEditBrushDeck across the three.
  // A separate mobile-only brush family would be a second source of truth for
  // "what colour am I painting", and the two would disagree the first time a
  // DM armed Room after painting.
  if (activeSubTool === "terrain") {
    return (
      <MobileFloorPicker label="Paint" selected={floorFamily} onSelect={onSelectFloorFamily} />
    );
  }

  if (activeSubTool === "room" || activeSubTool === "hallway") {
    return (
      <>
        {activeSubTool === "hallway" && (
          <MobileSwatchRow
            label="Width (cells)"
            options={HALLWAY_WIDTHS.map((width) => ({ id: width, label: String(width) }))}
            selected={hallwayWidth}
            onSelect={onSelectHallwayWidth}
          />
        )}
        <MobileSwatchRow
          label={activeSubTool === "room" ? "Wall ring" : "Side walls"}
          options={WALL_RING_OPTIONS}
          selected={roomWallFamily}
          onSelect={onSelectRoomWallFamily}
        />
        <MobileFloorPicker label="Floor" selected={floorFamily} onSelect={onSelectFloorFamily} />
      </>
    );
  }

  if (activeSubTool === "spline") {
    return (
      <MobileSwatchRow
        label="Curve"
        options={SPLINE_KINDS}
        selected={splineKind}
        onSelect={onSelectSplineKind}
      />
    );
  }

  if (activeSubTool === "row") {
    return (
      <MobileSwatchRow
        label="Stamp"
        options={ROW_ASSETS}
        selected={selectedAssetId}
        onSelect={onSelectAsset}
      />
    );
  }

  return null;
}
