// ============================================================================
// COMPILED SCENE — the per-recipient view
// ============================================================================
// The compiled scene is server-enforced geometry, and parts of it are DM-only.
// This is the ONE place that decides what a given recipient may see of it; keep
// it that way, the way `deriveMapElements` is the sole producer of player-safe
// scenery. A second stripper is how secrets leak.

import type { CompiledScene } from "@herobyte/shared";

/**
 * The compiled scene as `isDM` may see it.
 *
 * Secret doors must be indistinguishable from wall to players: they leave the
 * doors list and reappear as anonymous wall segments, so client-side vision
 * still cannot see through them and nothing in the payload hints a door exists.
 * That includes the id — compiled wall segments are always
 * `${elementId}#${index}`, and a bare door id would fingerprint every secret
 * door to anyone reading the socket.
 *
 * Lights are DM-only for the same reason: nothing renders them at the table
 * yet, so their coordinates buy a player nothing but a map of the rooms fog is
 * hiding (and every generated dungeon lights its rooms). When the lighting
 * system ships, lights must come back VISION-FILTERED — like tokens — never
 * restored wholesale.
 *
 * Pure: the caller's scene is never mutated.
 */
export function compiledSceneFor(scene: CompiledScene, isDM: boolean): CompiledScene {
  if (isDM) return scene;

  return {
    ...scene,
    lights: [],
    walls: [
      ...scene.walls,
      ...scene.doors
        .filter((door) => door.state === "secret")
        .map((door) => ({
          id: `${door.id}#0`,
          x1: door.x1,
          y1: door.y1,
          x2: door.x2,
          y2: door.y2,
          blocksMovement: door.blocksMovement,
          blocksVision: door.blocksVision,
        })),
    ],
    doors: scene.doors.filter((door) => door.state !== "secret"),
  };
}
