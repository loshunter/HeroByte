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
import type { DragTool } from "../mapEditToolKinds";
import type { MapEditSplineKind, MapEditToolbarProps, MapEditWallFamily } from "../mapEditTypes";
import { MobileFloorPicker } from "./MobileFloorPicker";
import { MobileSwatchRow } from "./MobileSwatchRow";

/** The tools whose panel below is non-empty — the sheet's open/close rule. */
export const PANEL_TOOLS: ReadonlySet<DragTool> = new Set<DragTool>([
  "room",
  "hallway",
  "row",
  "spline",
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

export function MobileMapEditToolPanels({
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
