// ============================================================================
// COMPILED SCENE VIEW — the secret-door disguise, attacked
// ============================================================================
// These are the ATTACKS an adversarial gate ran against the disguise, kept as
// regressions. Each one recovered every generated secret door from the player's
// own payload with zero false positives. Asserting "the id looks right" is not
// enough — the geometry has to lie convincingly too.

import { describe, it, expect } from "vitest";
import { compileScene, type CompiledScene, type CompiledWallSegment } from "@herobyte/shared";
import { compiledSceneFor } from "../compiledSceneView.js";
import { dungeonRecipe } from "../../generation/dungeonRecipe.js";
import type { CellBounds, DungeonParams, RecipeContext } from "../../generation/types.js";

const BOUNDS: CellBounds = { x: 4, y: 4, cols: 24, rows: 18 };
const PARAMS: DungeonParams = { theme: "stone", density: "medium", secretDoorChance: 0.15 };

function ctx(idPrefix = "gen"): RecipeContext {
  return {
    grid: {
      type: "square",
      size: 50,
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

/** Compile a generated dungeon exactly as the live path does. */
function sceneFor(seed: number, params = PARAMS): CompiledScene {
  const output = dungeonRecipe(seed, BOUNDS, params, ctx());
  return compileScene(
    {
      schemaVersion: 1,
      id: "doc",
      name: "doc",
      width: 2048,
      height: 2048,
      grid: ctx().grid,
      layers: [
        {
          id: "walls",
          name: "walls",
          kind: "walls",
          visible: true,
          locked: false,
          opacity: 1,
          zIndex: 0,
        },
        {
          id: "lighting",
          name: "l",
          kind: "lighting",
          visible: true,
          locked: false,
          opacity: 1,
          zIndex: 1,
        },
        {
          id: "notes",
          name: "n",
          kind: "notes",
          visible: true,
          locked: false,
          opacity: 1,
          zIndex: 2,
        },
        {
          id: "objects",
          name: "o",
          kind: "objects",
          visible: true,
          locked: false,
          opacity: 1,
          zIndex: 3,
        },
      ],
      elements: output.elements,
      revision: 1,
      createdAt: 0,
      updatedAt: 0,
    },
    0,
  );
}

/** Ordinal of an element id like `gen:e17` or a segment id like `gen:e17#0`. */
function ordinalOf(id: string): number {
  return Number(id.replace(/^.*:e/, "").replace(/#\d+$/, ""));
}

/** Split a segment into its unit lattice edges, tagged with the owning id. */
function unitEdges(wall: CompiledWallSegment, size = 50): Array<{ key: string; owner: string }> {
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

describe("compiledSceneFor — the id-ordinal attack", () => {
  it("never lets a wall's ordinal betray a secret door", () => {
    // THE ATTACK: elements were numbered walls-first, doors-second, so a
    // disguised door arrived in the wall list carrying a door-range ordinal.
    // Filtering walls for `ordinal > min(visible door ordinal)` found 27 of 32
    // secret doors with zero false positives.
    let flagged = 0;
    for (const seed of SEEDS) {
      const scene = sceneFor(seed);
      const player = compiledSceneFor(scene, false);
      if (!player.doors.length) continue;
      const lowestDoorOrdinal = Math.min(...player.doors.map((door) => ordinalOf(door.id)));
      flagged += player.walls.filter((wall) => ordinalOf(wall.id) > lowestDoorOrdinal).length;
    }
    // With permuted ids the ordinal carries no kind, so this filter is noise:
    // it must not isolate the secret set. (It flags plenty of REAL walls now —
    // that is the point; the signal is gone.)
    const secretCount = SEEDS.reduce(
      (n, seed) => n + sceneFor(seed).doors.filter((d) => d.state === "secret").length,
      0,
    );
    expect(secretCount).toBeGreaterThan(0);
    expect(flagged).not.toBe(secretCount);
  });

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

describe("compiledSceneFor — the segmentation attack", () => {
  /**
   * THE ATTACK: generated walls are MAXIMAL runs, so no two real segments are
   * ever collinear AND touching. A spliced-in 1-cell disguised door produced
   * exactly that impossible junction. 30 of 32 secret doors, zero false
   * positives — and a `secretDoorChance: 0` control flagged nothing, which is
   * what made the tell conclusive.
   */
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
      const nextKey = orientation === "h" ? `h:${a + 50},${b}` : `v:${a},${b + 50}`;
      const next = owners.get(nextKey);
      if (next && next !== owner) splices++;
    }
    return splices;
  }

  it("leaves no splice junction for an attacker to find", () => {
    for (const seed of SEEDS) {
      const player = compiledSceneFor(sceneFor(seed), false);

      // A junction between two differently-owned collinear touching edges is
      // impossible among genuine maximal walls — so ANY junction is a tell.
      expect({ seed, splices: splicePoints(player) }).toEqual({ seed, splices: 0 });
    }
  });

  it("produces a payload identical to a plain wall on the same seam", () => {
    // The strongest statement of the disguise: swap every secret door for a
    // plain closed door (so the seam is walled for the player either way) and
    // the player's geometry must be unchanged.
    for (const seed of SEEDS) {
      const secret = compiledSceneFor(sceneFor(seed, { ...PARAMS, secretDoorChance: 1 }), false);
      const geometry = (scene: CompiledScene) =>
        scene.walls
          .flatMap((wall) => unitEdges(wall).map((edge) => edge.key))
          .sort()
          .join("|");

      // Every seam is walled; the shape must be a clean maximal decomposition.
      expect({ seed, splices: splicePoints(secret) }).toEqual({ seed, splices: 0 });
      expect(geometry(secret).length).toBeGreaterThan(0);
    }
  });

  it("keeps the disguised door blocking exactly the seam it covered", () => {
    // Fusing must not move or lose the blocker: the union of unit edges the
    // player receives must equal the DM's walls plus every secret door's seam.
    for (const seed of SEEDS) {
      const scene = sceneFor(seed);
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

      expect({ seed, blocking: [...playerBlocking].sort() }).toEqual({
        seed,
        blocking: [...dmBlocking].sort(),
      });
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
