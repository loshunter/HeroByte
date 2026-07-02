// Per-recipient vision filtering — the server-side half of fog of war.
// The FogLayer hides entities from players' eyes; this module keeps them out
// of players' network payloads entirely, so reading the WebSocket frames
// reveals nothing the table can't see.
//
// All geometry runs in map-document space (the compiled scene's coordinates):
// world positions are inverse-transformed through the live map transform,
// exactly like the client fog. Fog only covers the published map rect, so
// anything outside it — staging zones, off-map tokens — is never filtered.

import {
  computeVisionPolygon,
  getVisionBlockingSegments,
  gridCellToWorldPoint,
  inverseTransformScenePoint,
  pointInPolygon,
  type CompiledScene,
  type ScenePoint,
} from "@herobyte/shared";
import type { RoomState } from "../model.js";

export interface VisionContext {
  /** Vision polygons for the recipient's own tokens, in document space. */
  polygons: ScenePoint[][];
  scene: CompiledScene;
  toDocSpace: (point: ScenePoint) => ScenePoint;
}

/**
 * Build the recipient's vision for one broadcast pass, or null when no
 * filtering applies (fog off, or nothing published). DM recipients should
 * never reach this — callers skip filtering for them.
 */
export function createVisionContext(state: RoomState, recipientUid: string): VisionContext | null {
  const scene = state.compiledScene;
  if (!state.fogEnabled || !scene) {
    return null;
  }

  const mapTransform = state.sceneObjects.find((object) => object.type === "map")?.transform;
  const toDocSpace = (point: ScenePoint): ScenePoint =>
    mapTransform ? inverseTransformScenePoint(mapTransform, point) : point;

  const segments = getVisionBlockingSegments(scene);
  const bounds = { width: scene.width, height: scene.height };
  // Tokens live in grid cells; vision origins are their world-pixel centers.
  const polygons = state.tokens
    .filter((token) => token.owner === recipientUid)
    .map((token) =>
      computeVisionPolygon(
        toDocSpace(gridCellToWorldPoint(state.gridSize, { x: token.x, y: token.y })),
        segments,
        bounds,
      ),
    );

  return { polygons, scene, toDocSpace };
}

export function isWorldPointVisible(context: VisionContext, point: ScenePoint): boolean {
  const doc = context.toDocSpace(point);
  // Fog only covers the published map rect; the void outside it is never
  // hidden (staging zones live there).
  if (doc.x < 0 || doc.y < 0 || doc.x > context.scene.width || doc.y > context.scene.height) {
    return true;
  }
  return context.polygons.some((polygon) => pointInPolygon(doc, polygon));
}

/** Token ids of NPCs the DM has hidden — never sent to non-DM clients on any channel. */
export function getHiddenNpcTokenIds(state: RoomState): Set<string> {
  const ids = new Set<string>();
  for (const character of state.characters) {
    if (character.visibleToPlayers === false && character.tokenId) {
      ids.add(character.tokenId);
    }
  }
  return ids;
}

/**
 * Cache key covering everything a recipient's vision polygons depend on:
 * fog flag, published scene identity, grid scale, door states, the
 * recipient's own token cells, and the live map transform.
 */
export function visionSignature(state: RoomState, recipientUid: string): string {
  const scene = state.compiledScene;
  const doors = scene ? scene.doors.map((door) => door.state).join(",") : "";
  const ownTokens = state.tokens
    .filter((token) => token.owner === recipientUid)
    .map((token) => `${token.x}:${token.y}`)
    .join(";");
  const transform = state.sceneObjects.find((object) => object.type === "map")?.transform;
  const transformKey = transform
    ? `${transform.x},${transform.y},${transform.scaleX},${transform.scaleY},${transform.rotation}`
    : "";
  return [
    state.fogEnabled ? 1 : 0,
    scene?.compiledAt ?? 0,
    scene?.sourceRevision ?? 0,
    state.gridSize,
    doors,
    ownTokens,
    transformKey,
  ].join("|");
}
