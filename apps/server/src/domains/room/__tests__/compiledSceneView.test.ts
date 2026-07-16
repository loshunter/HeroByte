// ============================================================================
// COMPILED SCENE VIEW — the secret-door disguise, attacked
// ============================================================================
// These are the ATTACKS an adversarial gate ran against the disguise, kept as
// regressions. Each one recovered every secret door from the player's own
// payload with zero false positives. Asserting "the id looks right" is not
// enough — the geometry has to lie convincingly too.
//
// The attacks were originally run against GENERATED dungeons. Generated ones no
// longer author secret doors at all (see dungeonGeometry.emitDoors: the terrain
// channel hands players the floor plan, which gives away a generated secret
// regardless of what this file does). So the attacks now run against
// HAND-AUTHORED scenes, which is where the disguise still has to hold: a DM
// placing a door with the Door tool decides its state, and nothing about a
// hand-drawn map tells a player where the seams are.
//
// The generated dungeon still appears below — as the source of realistic wall
// geometry for the fusion checks, not as a carrier of secrets.

import { describe, it, expect } from "vitest";
import {
  compileScene,
  type CompiledScene,
  type CompiledWallSegment,
  type MapDocument,
  type MapElement,
} from "@herobyte/shared";
import { compiledSceneFor } from "../compiledSceneView.js";
import { dungeonRecipe } from "../../generation/dungeonRecipe.js";
import type { CellBounds, DungeonParams, RecipeContext } from "../../generation/types.js";

const BOUNDS: CellBounds = { x: 4, y: 4, cols: 24, rows: 18 };
const PARAMS: DungeonParams = { theme: "stone", density: "medium" };
const SIZE = 50;

function ctx(idPrefix = "gen"): RecipeContext {
  return {
    grid: {
      type: "square",
      size: SIZE,
      squareSize: 5,
      offsetX: 0,
      offsetY: 0,
      visible: true,
      snap: true,
    },
    layerIds: { walls: "walls", lighting: "lighting", notes: "notes", objects: "objects" },
    idPrefix,
  };
}

function documentWith(elements: MapElement[]): MapDocument {
  const layer = (id: string, kind: "walls" | "lighting" | "notes" | "objects", zIndex: number) => ({
    id,
    name: id,
    kind,
    visible: true,
    locked: false,
    opacity: 1,
    zIndex,
  });
  return {
    schemaVersion: 1,
    id: "doc",
    name: "doc",
    width: 2048,
    height: 2048,
    grid: ctx().grid,
    layers: [
      layer("walls", "walls", 0),
      layer("lighting", "lighting", 1),
      layer("notes", "notes", 2),
      layer("objects", "objects", 3),
    ],
    elements,
    revision: 1,
    createdAt: 0,
    updatedAt: 0,
  };
}

/** Compile a generated dungeon exactly as the live path does. */
function sceneFor(seed: number, params = PARAMS): CompiledScene {
  return compileScene(documentWith(dungeonRecipe(seed, BOUNDS, params, ctx()).elements), 0);
}

// ---------------------------------------------------------------------------
// Hand-authored fixture: the geometry a DM's own room produces
// ---------------------------------------------------------------------------

/** A wall run along y=0 from x1 to x2, the shape the Wall tool draws. */
function wallElement(id: string, x1: number, y1: number, x2: number, y2: number): MapElement {
  return {
    id,
    layerId: "walls",
    type: "wall",
    locked: false,
    hidden: false,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: {
      points: [
        { x: x1, y: y1 },
        { x: x2, y: y2 },
      ],
      blocksMovement: true,
      blocksVision: true,
    },
  };
}

/** A one-cell door at (x, y), horizontal unless rotated. */
function doorElement(
  id: string,
  x: number,
  y: number,
  state: "closed" | "secret",
  rotation = 0,
): MapElement {
  return {
    id,
    layerId: "walls",
    type: "door",
    locked: false,
    hidden: false,
    transform: { x, y, scaleX: 1, scaleY: 1, rotation },
    data: { width: SIZE, state, blocksMovement: true, blocksVision: true },
  };
}

/**
 * A hand-drawn 4x4 room with a door in the middle of its top wall. The DM broke
 * the top wall around the doorway exactly as the Wall tool would, so the door's
 * seam sits between two collinear touching runs — the junction the segmentation
 * attack hunts for.
 */
function roomWithDoor(state: "closed" | "secret"): MapDocument {
  return documentWith([
    wallElement("w1", 0, 0, 50, 0),
    wallElement("w2", 100, 0, 200, 0),
    wallElement("w3", 200, 0, 200, 200),
    wallElement("w4", 200, 200, 0, 200),
    wallElement("w5", 0, 200, 0, 0),
    doorElement("d1", 50, 0, state),
  ]);
}

/** Ordinal of an element id like `gen:e17` or a segment id like `gen:e17#0`. */
function ordinalOf(id: string): number {
  return Number(id.replace(/^.*:e/, "").replace(/#\d+$/, ""));
}

/** Split a segment into its unit lattice edges, tagged with the owning id. */
function unitEdges(wall: CompiledWallSegment, size = SIZE): Array<{ key: string; owner: string }> {
  const edges: Array<{ key: string; owner: string }> = [];
  const horizontal = wall.y1 === wall.y2;
  const from = horizontal ? Math.min(wall.x1, wall.x2) : Math.min(wall.y1, wall.y2);
  const to = horizontal ? Math.max(wall.x1, wall.x2) : Math.max(wall.y1, wall.y2);
  for (let at = from; at < to; at += size) {
    const key = horizontal ? `h:${at},${wall.y1}` : `v:${wall.x1},${at}`;
    edges.push({ key, owner: wall.id });
  }
  return edges;
}

const SEEDS = Array.from({ length: 15 }, (_, i) => i + 1);

/** Junctions between two differently-owned collinear touching unit edges. */
function splicePoints(scene: CompiledScene): number {
  const owners = new Map<string, string>();
  for (const wall of scene.walls) {
    for (const edge of unitEdges(wall)) owners.set(edge.key, edge.owner);
  }
  let splices = 0;
  for (const [key, owner] of owners) {
    const [orientation, coords] = key.split(":") as ["h" | "v", string];
    const [a, b] = coords.split(",").map(Number) as [number, number];
    // The next unit edge along the same line.
    const nextKey = orientation === "h" ? `h:${a + SIZE},${b}` : `v:${a},${b + SIZE}`;
    const next = owners.get(nextKey);
    if (next && next !== owner) splices++;
  }
  return splices;
}

describe("compiledSceneFor — the segmentation attack", () => {
  // THE ATTACK: a spliced-in 1-cell disguised door leaves an impossible
  // junction — two differently-owned segments that are collinear AND touching.
  // Against generated dungeons (maximal runs, so no genuine junction exists) it
  // recovered 30 of 32 secret doors with zero false positives. It works on
  // hand-drawn rooms for the same reason: a DM who breaks a wall around a
  // doorway leaves two runs that only meet again if something fills the gap.

  it("leaves no splice junction where a hand-placed secret door sits", () => {
    const player = compiledSceneFor(compileScene(roomWithDoor("secret"), 0), false);

    expect(splicePoints(player)).toBe(0);
  });

  it("gives a secret door the same payload as a plain wall on that seam", () => {
    // The strongest statement of the disguise: what the player receives for a
    // secret door must be byte-identical to a room whose top wall was simply
    // drawn unbroken. Not "similar" — the same.
    const secret = compiledSceneFor(compileScene(roomWithDoor("secret"), 0), false);
    const plain = compiledSceneFor(
      compileScene(
        documentWith([
          wallElement("w1", 0, 0, 200, 0),
          wallElement("w3", 200, 0, 200, 200),
          wallElement("w4", 200, 200, 0, 200),
          wallElement("w5", 0, 200, 0, 0),
        ]),
        0,
      ),
      false,
    );
    const geometry = (scene: CompiledScene) =>
      scene.walls
        .flatMap((wall) => unitEdges(wall).map((edge) => edge.key))
        .sort()
        .join("|");

    expect(geometry(secret)).toBe(geometry(plain));
    expect(secret.doors).toHaveLength(0);
  });

  it("keeps the disguised door blocking exactly the seam it covered", () => {
    // Fusing must not move or lose the blocker: the union of unit edges the
    // player receives must equal the DM's walls plus every secret door's seam.
    const scene = compileScene(roomWithDoor("secret"), 0);
    const player = compiledSceneFor(scene, false);
    const dmBlocking = new Set(
      [
        ...scene.walls,
        ...scene.doors
          .filter((door) => door.state === "secret")
          .map((door) => ({ ...door, id: `${door.id}#0` })),
      ].flatMap((segment) => unitEdges(segment as CompiledWallSegment).map((e) => e.key)),
    );
    const playerBlocking = new Set(
      player.walls.flatMap((wall) => unitEdges(wall).map((edge) => edge.key)),
    );

    expect([...playerBlocking].sort()).toEqual([...dmBlocking].sort());
  });

  it("still shows a non-secret door as a door", () => {
    // The control that makes the tests above mean something: the disguise fires
    // for secret doors ONLY. A closed door stays a door the player can see and
    // open, and its seam stays OUT of the wall list — the doorway is a real gap
    // in the top wall, which is why that wall does not fuse into one run.
    const player = compiledSceneFor(compileScene(roomWithDoor("closed"), 0), false);
    const topRun = player.walls.filter((wall) => wall.y1 === 0 && wall.y2 === 0);

    expect(player.doors.map((door) => door.state)).toEqual(["closed"]);
    expect(topRun).toHaveLength(2);
    expect(new Set(player.walls.flatMap((w) => unitEdges(w).map((e) => e.key)))).not.toContain(
      "h:50,0",
    );
  });
});

describe("compiledSceneFor — the id-ordinal attack", () => {
  // THE ATTACK: elements were numbered walls-first, doors-second, so a disguised
  // door arrived in the wall list carrying a door-range ordinal. Filtering walls
  // for `ordinal > min(visible door ordinal)` recovered 27 of 32 secret doors
  // with zero false positives. dungeonRecipe.shuffleIds killed the correlation.

  it("mints ids whose ordinal does not correlate with element kind", () => {
    const scene = sceneFor(1);
    const doorOrdinals = scene.doors.map((door) => ordinalOf(door.id));
    const wallOrdinals = scene.walls.map((wall) => ordinalOf(wall.id));

    // Some wall must out-number some door and vice versa — i.e. the two ranges
    // interleave rather than sitting in disjoint blocks.
    expect(Math.max(...wallOrdinals)).toBeGreaterThan(Math.min(...doorOrdinals));
    expect(Math.min(...wallOrdinals)).toBeLessThan(Math.max(...doorOrdinals));
  });
});

describe("compiledSceneFor — fusion on real generated geometry", () => {
  it("hands players a clean maximal decomposition of a whole dungeon", () => {
    // Not a secrecy claim (generated dungeons hold no secrets) — a fusion one:
    // the merge must be sound across every wall shape the recipe emits, since
    // it runs on the same payload that carries hand-placed secret doors.
    for (const seed of SEEDS) {
      const player = compiledSceneFor(sceneFor(seed), false);

      expect({ seed, splices: splicePoints(player) }).toEqual({ seed, splices: 0 });
      expect(player.walls.length).toBeGreaterThan(0);
    }
  });
});

describe("compiledSceneFor — fusion safety", () => {
  function segment(
    id: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    blocksVision = true,
  ): CompiledWallSegment {
    return { id, x1, y1, x2, y2, blocksMovement: true, blocksVision };
  }

  const scene = (walls: CompiledWallSegment[]): CompiledScene => ({
    schemaVersion: 1,
    sourceDocumentId: "doc",
    sourceRevision: 1,
    width: 1000,
    height: 1000,
    compiledAt: 0,
    walls,
    doors: [],
    lights: [],
  });

  it("never fuses segments that block differently", () => {
    // A window (see-through) beside a solid wall must stay its own segment:
    // fusing them would change what the scene BLOCKS, and blocking is the one
    // thing that may never be cosmetic.
    const window = segment("window#0", 0, 0, 50, 0, false);
    const solid = segment("wall#0", 50, 0, 100, 0, true);

    const player = compiledSceneFor(scene([window, solid]), false);

    expect(player.walls).toHaveLength(2);
    expect(player.walls.map((w) => w.blocksVision).sort()).toEqual([false, true]);
  });

  it("leaves a gap between segments unfused", () => {
    const player = compiledSceneFor(
      scene([segment("a#0", 0, 0, 50, 0), segment("b#0", 100, 0, 150, 0)]),
      false,
    );

    expect(player.walls).toHaveLength(2);
  });

  it("passes rotated (non-axis-aligned) walls through untouched", () => {
    const diagonal = segment("diag#0", 0, 0, 70, 70);

    expect(compiledSceneFor(scene([diagonal]), false).walls).toEqual([diagonal]);
  });

  it("gives the DM the scene unmerged and unmutated", () => {
    const walls = [segment("a#0", 0, 0, 50, 0), segment("b#0", 50, 0, 100, 0)];
    const original = scene(walls);

    expect(compiledSceneFor(original, true)).toBe(original);
    expect(original.walls).toHaveLength(2);
  });
});
