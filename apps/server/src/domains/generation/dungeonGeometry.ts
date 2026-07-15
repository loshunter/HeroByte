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

import type { MapDoorElement, MapWallElement, SeededRng, TerrainPaintCell } from "@herobyte/shared";
import { cellKey, indexRoomCells, type DungeonLayout, type LayoutEdge } from "./dungeonLayout.js";
import { makeIdFactory } from "./types.js";
import type { CellBounds, DungeonParams, RecipeContext, RecipeOutput } from "./types.js";

const THEME_FLOOR: Record<DungeonParams["theme"], string> = {
  stone: "terrain:stone-floor",
  wood: "terrain:wood-floor",
};

/** A merged, maximal line of wall edges along one lattice line. */
interface WallRun {
  orientation: "h" | "v";
  /** Row for "h", column for "v". */
  line: number;
  /** Inclusive edge positions along the line. */
  from: number;
  to: number;
}

export function emitGeometry(
  layout: DungeonLayout,
  bounds: CellBounds,
  params: DungeonParams,
  ctx: RecipeContext,
  rng: SeededRng,
  /** Shared with the other stages so ONE counter spans the whole document. */
  nextId: () => string = makeIdFactory(ctx.idPrefix),
): RecipeOutput {
  return {
    cells: emitFloor(layout, bounds, params),
    elements: [
      ...emitWalls(layout, bounds, ctx, nextId),
      ...emitDoors(layout, bounds, ctx, params, rng, nextId),
    ],
  };
}

// ---------------------------------------------------------------------------
// Floor
// ---------------------------------------------------------------------------

/** Scan order (y, then x) so the payload — and the golden — is order-stable. */
function emitFloor(
  layout: DungeonLayout,
  bounds: CellBounds,
  params: DungeonParams,
): TerrainPaintCell[] {
  const assetId = THEME_FLOOR[params.theme];
  const cells: TerrainPaintCell[] = [];
  for (let y = 0; y < bounds.rows; y++) {
    for (let x = 0; x < bounds.cols; x++) {
      if (layout.floor.has(cellKey(x, y))) {
        cells.push({ x: bounds.x + x, y: bounds.y + y, assetId });
      }
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
): MapWallElement[] {
  const runs = mergeRuns(wallEdgesOf(layout));
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
function wallEdgesOf(layout: DungeonLayout): LayoutEdge[] {
  const roomOf = indexRoomCells(layout.rooms);
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

function emitDoors(
  layout: DungeonLayout,
  bounds: CellBounds,
  ctx: RecipeContext,
  params: DungeonParams,
  rng: SeededRng,
  nextId: () => string,
): MapDoorElement[] {
  return layout.doorSites.map((site) => {
    // ONE roll per site, drawn unconditionally in door-site order (rule §4.2).
    const secret = rng() < params.secretDoorChance;
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
        // Authored "closed" (or "secret"): an authored-open door compiles to
        // nothing blocking — an invisible hole in the wall.
        state: secret ? ("secret" as const) : ("closed" as const),
        blocksMovement: true,
        blocksVision: true,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Lattice helpers — bounds-local cell -> document pixel
// ---------------------------------------------------------------------------

function pxX(cellX: number, bounds: CellBounds, ctx: RecipeContext): number {
  return (bounds.x + cellX) * ctx.grid.size + ctx.grid.offsetX;
}

function pxY(cellY: number, bounds: CellBounds, ctx: RecipeContext): number {
  return (bounds.y + cellY) * ctx.grid.size + ctx.grid.offsetY;
}

function parseCell(key: string): [number, number] {
  const [x, y] = key.split(",").map(Number);
  return [x!, y!];
}

function edgeKey(edge: LayoutEdge): string {
  return `${edge.orientation}:${edge.x},${edge.y}`;
}

function lineOf(edge: LayoutEdge): number {
  return edge.orientation === "h" ? edge.y : edge.x;
}

function positionOf(edge: LayoutEdge): number {
  return edge.orientation === "h" ? edge.x : edge.y;
}

function minYOf(run: WallRun): number {
  return run.orientation === "h" ? run.line : run.from;
}

function minXOf(run: WallRun): number {
  return run.orientation === "h" ? run.from : run.line;
}
