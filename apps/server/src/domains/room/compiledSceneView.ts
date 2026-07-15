// ============================================================================
// COMPILED SCENE — the per-recipient view
// ============================================================================
// The compiled scene is server-enforced geometry, and parts of it are DM-only.
// This is the ONE place that decides what a given recipient may see of it; keep
// it that way, the way `deriveMapElements` is the sole producer of player-safe
// scenery. A second stripper is how secrets leak.

import type { CompiledScene, CompiledWallSegment } from "@herobyte/shared";

/**
 * The compiled scene as `isDM` may see it.
 *
 * SECRET DOORS must be indistinguishable from wall. They leave the doors list
 * and reappear as anonymous `${door.id}#0` wall segments — the `#index` suffix
 * matters because a bare door id would fingerprint every one of them to anyone
 * reading the socket.
 *
 * Hiding the ID is not enough: the SEGMENTATION talks too. A generated dungeon
 * emits MAXIMAL wall runs, so among real walls no two segments are ever both
 * collinear and touching — they would have been merged. Splicing a 1-cell
 * disguised door into the middle of a run produces exactly that "impossible"
 * pattern, and an adversarial gate read every secret door straight off the
 * player payload with zero false positives (and a `secretDoorChance: 0` control
 * flagging nothing, which is what made it conclusive). So the player's blocking
 * set is RE-MERGED here: the disguised door fuses back into its neighbours and
 * the payload becomes byte-for-byte what a plain wall on that seam would emit.
 *
 * LIGHTS are DM-only: nothing renders them at the table yet, so their
 * coordinates buy a player nothing but a map of the rooms fog is hiding (and
 * every generated dungeon lights its rooms). When the lighting system ships,
 * lights must come back VISION-FILTERED — like tokens — never restored whole.
 *
 * Pure: the caller's scene is never mutated.
 */
export function compiledSceneFor(scene: CompiledScene, isDM: boolean): CompiledScene {
  if (isDM) return scene;

  const disguised = scene.doors
    .filter((door) => door.state === "secret")
    .map((door) => ({
      id: `${door.id}#0`,
      x1: door.x1,
      y1: door.y1,
      x2: door.x2,
      y2: door.y2,
      blocksMovement: door.blocksMovement,
      blocksVision: door.blocksVision,
    }));

  return {
    ...scene,
    lights: [],
    walls: mergeCollinear([...scene.walls, ...disguised]),
    doors: scene.doors.filter((door) => door.state !== "secret"),
  };
}

/**
 * Fuse axis-aligned segments that are collinear AND touch end-to-end into one
 * maximal segment, so the decomposition carries no information about how the
 * pieces arose. Segments that are not axis-aligned (a rotated hand-authored
 * wall) pass through untouched — they carry no maximal-run invariant to betray.
 *
 * A fused run inherits the id of its lowest-positioned contributor, so a
 * disguised door's own id never reaches the wire when it fuses with a wall.
 * Blocking flags must match to fuse: a window (blocksVision false) beside a
 * solid wall stays its own segment, because merging them would change what the
 * scene BLOCKS — the one thing that must never be cosmetic.
 */
function mergeCollinear(segments: CompiledWallSegment[]): CompiledWallSegment[] {
  const axisAligned: CompiledWallSegment[] = [];
  const passthrough: CompiledWallSegment[] = [];
  for (const segment of segments) {
    const horizontal = segment.y1 === segment.y2;
    const vertical = segment.x1 === segment.x2;
    // A zero-length segment is neither; leave it alone rather than fuse on it.
    if ((horizontal || vertical) && !(horizontal && vertical)) axisAligned.push(segment);
    else passthrough.push(segment);
  }

  const groups = new Map<string, CompiledWallSegment[]>();
  for (const segment of axisAligned) {
    const key = groupKeyOf(segment);
    const group = groups.get(key);
    if (group) group.push(segment);
    else groups.set(key, [segment]);
  }

  const merged: CompiledWallSegment[] = [];
  // Sort the group keys so output order never depends on Map insertion order,
  // which upstream derives from a Set iteration.
  for (const key of [...groups.keys()].sort()) {
    merged.push(...mergeGroup(groups.get(key)!));
  }
  return [...merged, ...passthrough];
}

/** Same line + same blocking behaviour = fusable. */
function groupKeyOf(segment: CompiledWallSegment): string {
  const orientation = segment.y1 === segment.y2 ? "h" : "v";
  const line = orientation === "h" ? segment.y1 : segment.x1;
  return `${orientation}:${line}:${segment.blocksMovement ? 1 : 0}${segment.blocksVision ? 1 : 0}`;
}

function mergeGroup(group: CompiledWallSegment[]): CompiledWallSegment[] {
  const horizontal = group[0]!.y1 === group[0]!.y2;
  const start = (s: CompiledWallSegment) =>
    horizontal ? Math.min(s.x1, s.x2) : Math.min(s.y1, s.y2);
  const end = (s: CompiledWallSegment) =>
    horizontal ? Math.max(s.x1, s.x2) : Math.max(s.y1, s.y2);

  const sorted = [...group].sort(
    (a, b) => start(a) - start(b) || end(a) - end(b) || a.id.localeCompare(b.id),
  );
  const runs: CompiledWallSegment[] = [];
  for (const segment of sorted) {
    const open = runs[runs.length - 1];
    // Touching or overlapping continues the run; a gap starts a new one.
    if (open && start(segment) <= end(open)) {
      const far = Math.max(end(open), end(segment));
      if (horizontal) open.x2 = far;
      else open.y2 = far;
      continue;
    }
    runs.push(
      horizontal
        ? { ...segment, x1: start(segment), x2: end(segment) }
        : { ...segment, y1: start(segment), y2: end(segment) },
    );
  }
  return runs;
}
