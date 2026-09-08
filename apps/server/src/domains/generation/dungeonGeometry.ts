// ============================================================================
// DUNGEON GEOMETRY — layout (cells) -> place-room payload (document pixels)
// ============================================================================
// Pure. Turns G2's cell-space layout into the floor cells, wall polylines, and
// door elements that ONE place-room command carries.
//
// WHAT BLOCKS (the model — G3's plan text was wrong here; see the plan's
// [G3-RESOLVED] note): a wall is needed on every edge a walker must not cross.
// That is TWO families of edge, not one:
//   1. floor <-> non-floor — the dungeon's outer shell.
//   2. room <-> corridor seams — the doorway line. G2 already reduced each
//      contiguous seam group to exactly ONE door site; every OTHER seam in the
//      group must be walled, which is what keeps a width-2 corridor sealed.
// Wall edges = (1) union (2) minus the door sites. The plan's "floor <-> non-
// floor, remove door sites" alone would emit no wall on family (2) at all,
// because both of a seam's cells are floor — every wide corridor would open a
// hole into its room. G2's walkability property is what pins this.

import type { MapDoorElement, MapWallElement, TerrainPaintCell } from "@herobyte/shared";
import { cellKey, indexRoomCells, type DungeonLayout, type LayoutEdge } from "./dungeonLayout.js";
import {
  edgeKey,
  lineOf,
  minXOf,
  minYOf,
  parseCell,
  positionOf,
  pxX,
  pxY,
  type WallRun,
} from "./geometryLattice.js";
import { makeIdFactory } from "./types.js";
import type { CellBounds, RecipeContext, RecipeOutput } from "./types.js";

/**
 * The two painted materials a layout is drawn with: the floor inside it, and
 * the one-cell wall band hugging it (the client's Czepeku wall families —
 * light top + rim + cast shadow). The CALLER chooses them, because "which
 * floor goes with which theme" is a recipe's decision, not the emitter's —
 * and a building's kinds are not a dungeon's themes.
 */
export interface GeometryMaterials {
  floorAssetId: string;
  wallAssetId: string;
}

/**
 * Geometry draws NO rolls: the layout decides where everything goes, and every
 * door is authored closed (see emitDoors). It kept an RNG only while generated
 * doors could be secret.
 */
export function emitGeometry(
  layout: DungeonLayout,
  bounds: CellBounds,
  materials: GeometryMaterials,
  ctx: RecipeContext,
  /** Shared with the other stages so ONE counter spans the whole document. */
  nextId: () => string = makeIdFactory(ctx.idPrefix),
  /**
   * Which room each floor cell belongs to. Defaults to deriving it from
   * `layout.rooms`, which is right for a dungeon: every floor cell is either
   * inside a room rect or corridor. A BUILDING punches its doors as floor
   * cells THROUGH its partition lines, outside every rect — derive there and
   * both of a doorway's edges read as seams, only one is a door site, and the
   * other gets walled: a door that opens onto a wall. The building passes its
   * own index, in which each punched cell belongs to one side.
   */
  roomIndexByCell: Map<string, number> = indexRoomCells(layout.rooms),
): RecipeOutput {
  return {
    cells: emitFloor(layout, bounds, materials),
    elements: [
      ...emitWalls(layout, bounds, ctx, nextId, roomIndexByCell),
      ...emitDoors(layout, bounds, ctx, nextId),
    ],
  };
}

// ---------------------------------------------------------------------------
// Floor
// ---------------------------------------------------------------------------

/** Scan order (y, then x) so the payload — and the golden — is order-stable.
 * Floors first, then the painted wall halo appended in its own scan, so a
 * fixture regeneration diffs as pure addition. */
function emitFloor(
  layout: DungeonLayout,
  bounds: CellBounds,
  materials: GeometryMaterials,
): TerrainPaintCell[] {
  const assetId = materials.floorAssetId;
  const cells: TerrainPaintCell[] = [];
  for (let y = 0; y < bounds.rows; y++) {
    for (let x = 0; x < bounds.cols; x++) {
      if (layout.floor.has(cellKey(x, y))) {
        cells.push({ x: bounds.x + x, y: bounds.y + y, assetId });
      }
    }
  }
  return [...cells, ...emitWallHalo(layout, bounds, materials)];
}

/**
 * One-cell painted wall band hugging the floor plan: every non-floor cell that
 * 8-touches a floor cell (8-way, so diagonal corners close and the band reads
 * continuous). Pure art — blocking stays with the wall polylines — and it
 * cannot leak layout the player payload doesn't already carry: the halo is a
 * pure function of the floor plan `mapTerrain` already ships. The 1-cell scan
 * margin covers a floor cell on the region border.
 */
function emitWallHalo(
  layout: DungeonLayout,
  bounds: CellBounds,
  materials: GeometryMaterials,
): TerrainPaintCell[] {
  const assetId = materials.wallAssetId;
  const cells: TerrainPaintCell[] = [];
  for (let y = -1; y <= bounds.rows; y++) {
    for (let x = -1; x <= bounds.cols; x++) {
      if (layout.floor.has(cellKey(x, y))) continue;
      let touchesFloor = false;
      for (let dy = -1; dy <= 1 && !touchesFloor; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx !== 0 || dy !== 0) && layout.floor.has(cellKey(x + dx, y + dy))) {
            touchesFloor = true;
            break;
          }
        }
      }
      if (touchesFloor) cells.push({ x: bounds.x + x, y: bounds.y + y, assetId });
    }
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Walls
// ---------------------------------------------------------------------------

function emitWalls(
  layout: DungeonLayout,
  bounds: CellBounds,
  ctx: RecipeContext,
  nextId: () => string,
  roomIndexByCell: Map<string, number>,
): MapWallElement[] {
  const runs = mergeRuns(wallEdgesOf(layout, roomIndexByCell));
  return runs.map((run) => ({
    id: nextId(),
    layerId: ctx.layerIds.walls,
    type: "wall" as const,
    locked: false,
    hidden: false,
    // Identity transform: the points carry the geometry (plan §4.1b — a zeroed
    // scale would be rejected by sanitizeElement and abort the whole command).
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: {
      points: runEndpoints(run, bounds, ctx),
      blocksMovement: true,
      blocksVision: true,
    },
  }));
}

/** Every edge that must block, minus the door sites. See the header note. */
function wallEdgesOf(layout: DungeonLayout, roomOf: Map<string, number>): LayoutEdge[] {
  const blocking = new Map<string, LayoutEdge>();
  const add = (edge: LayoutEdge) => blocking.set(edgeKey(edge), edge);

  for (const key of layout.floor) {
    const [x, y] = parseCell(key);
    for (const [nx, ny, edge] of neighbourEdges(x, y)) {
      const neighbour = cellKey(nx, ny);
      if (!layout.floor.has(neighbour)) {
        add(edge); // outer shell
      } else if (roomOf.get(key) !== roomOf.get(neighbour)) {
        add(edge); // room/corridor seam — a door may carve it back out below
      }
    }
  }

  for (const site of layout.doorSites) blocking.delete(edgeKey(site.edge));
  return [...blocking.values()];
}

/** The four edges around a cell, paired with the neighbour each one faces. */
function neighbourEdges(x: number, y: number): Array<[number, number, LayoutEdge]> {
  return [
    [x, y - 1, { x, y, orientation: "h" }],
    [x, y + 1, { x, y: y + 1, orientation: "h" }],
    [x - 1, y, { x, y, orientation: "v" }],
    [x + 1, y, { x: x + 1, y, orientation: "v" }],
  ];
}

/**
 * Collapse contiguous collinear edges into maximal runs, then order them by
 * (min y, min x, horizontal first) so ids are assigned in a stable scan order
 * rather than by Map iteration.
 */
function mergeRuns(edges: LayoutEdge[]): WallRun[] {
  const sorted = [...edges].sort(
    (a, b) =>
      a.orientation.localeCompare(b.orientation) ||
      lineOf(a) - lineOf(b) ||
      positionOf(a) - positionOf(b),
  );

  const runs: WallRun[] = [];
  for (const edge of sorted) {
    const open = runs[runs.length - 1];
    const contiguous =
      open !== undefined &&
      open.orientation === edge.orientation &&
      open.line === lineOf(edge) &&
      open.to + 1 === positionOf(edge);
    if (contiguous) {
      open.to = positionOf(edge);
    } else {
      runs.push({
        orientation: edge.orientation,
        line: lineOf(edge),
        from: positionOf(edge),
        to: positionOf(edge),
      });
    }
  }

  return runs.sort(
    (a, b) =>
      minYOf(a) - minYOf(b) || minXOf(a) - minXOf(b) || a.orientation.localeCompare(b.orientation),
  );
}

/** A run spans corner `from` to corner `to + 1` along its position axis. */
function runEndpoints(
  run: WallRun,
  bounds: CellBounds,
  ctx: RecipeContext,
): { x: number; y: number }[] {
  return run.orientation === "h"
    ? [
        { x: pxX(run.from, bounds, ctx), y: pxY(run.line, bounds, ctx) },
        { x: pxX(run.to + 1, bounds, ctx), y: pxY(run.line, bounds, ctx) },
      ]
    : [
        { x: pxX(run.line, bounds, ctx), y: pxY(run.from, bounds, ctx) },
        { x: pxX(run.line, bounds, ctx), y: pxY(run.to + 1, bounds, ctx) },
      ];
}

// ---------------------------------------------------------------------------
// Doors
// ---------------------------------------------------------------------------

/**
 * Every generated door is authored CLOSED. None are secret, deliberately.
 *
 * A secret door is disguised for players by re-emitting it as anonymous wall
 * (compiledSceneView). That disguise holds for a HAND-AUTHORED map, and it does
 * not hold here, because this recipe is too regular to lie:
 *
 *   - `mapTerrain` ships the whole floor plan to every player, unfiltered — by
 *     design, since fog hides it visually rather than by omission.
 *   - `wallEdgesOf` blocks exactly two families, so a wall with floor on BOTH
 *     sides can only be a room/corridor seam.
 *   - `findDoorSites` gives every seam group exactly ONE door.
 *
 * So: group the internal blockers, and any group without a visible door has a
 * secret one. A gate ran that over the player's own payload — 202/202 found,
 * zero false positives, and a no-secrets control flagging nothing, which is what
 * made it total. G4.5 fixed how the walls are CHOPPED; it cannot hide WHERE they
 * are, and the floor plan is what talks.
 *
 * A DM who selects "many secret doors" and builds a session on that is worse off
 * than one told the feature is not ready. Restoring it needs the terrain channel
 * to stop shipping unexplored floor — VISION's memory fog — not a tweak here.
 */
function emitDoors(
  layout: DungeonLayout,
  bounds: CellBounds,
  ctx: RecipeContext,
  nextId: () => string,
): MapDoorElement[] {
  return layout.doorSites.map((site) => {
    return {
      id: nextId(),
      layerId: ctx.layerIds.walls,
      type: "door" as const,
      locked: false,
      hidden: false,
      // The door sits ON the seam: transform at the edge's START corner, and
      // the compiled segment runs from there toward (width, 0) rotated — so a
      // vertical seam needs rotation 90 (plan §3).
      transform: {
        x: pxX(site.edge.x, bounds, ctx),
        y: pxY(site.edge.y, bounds, ctx),
        scaleX: 1,
        scaleY: 1,
        rotation: site.edge.orientation === "h" ? 0 : 90,
      },
      data: {
        width: ctx.grid.size,
        // Authored "closed": an authored-open door compiles to nothing blocking
        // — an invisible hole in the wall.
        state: "closed" as const,
        blocksMovement: true,
        blocksVision: true,
      },
    };
  });
}
