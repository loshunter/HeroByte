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
  computeViewerVisionPolygon,
  effectiveVisionRadiusFeet,
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
  // `computeViewerVisionPolygon` — not `computeVisionPolygon` — is what keeps
  // this identical to the client's fog: it owns BOTH the world->document
  // conversion of the origin and the feet->document conversion of the radius,
  // so neither half of the app can spell that chain its own way.
  const polygons = state.tokens
    .filter((token) => token.owner === recipientUid)
    .map((token) =>
      computeViewerVisionPolygon({
        origin: gridCellToWorldPoint(state.gridSize, { x: token.x, y: token.y }),
        radiusFeet: effectiveVisionRadiusFeet(token.visionRadius, state.defaultVisionRadius),
        segments,
        bounds,
        gridSize: state.gridSize,
        gridSquareSize: state.gridSquareSize,
        mapTransform,
      }),
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
 * fog flag, published scene identity, grid scale, feet per square, door
 * states, the recipient's own token cells AND their sight radii, and the live
 * map transform.
 *
 * Every input the polygon reads must appear here or the router serves a stale
 * one. S7 added two: `visionRadius` because setting one otherwise does nothing
 * until the token also moves (presenting as "the message never sent"), and
 * `gridSquareSize` because the radius is in FEET and a table can change
 * feet-per-square live, with no republish. The room default is here for the
 * first of those reasons and more sharply: it is resolved at READ time for
 * every token that has no radius of its own, so a DM setting it changes what
 * every such player may see while nothing about any token has changed.
 */
export function visionSignature(state: RoomState, recipientUid: string): string {
  const scene = state.compiledScene;
  const doors = scene ? scene.doors.map((door) => door.state).join(",") : "";
  const ownTokens = state.tokens
    .filter((token) => token.owner === recipientUid)
    .map((token) => `${token.x}:${token.y}:${token.visionRadius ?? ""}`)
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
    state.gridSquareSize,
    doors,
    ownTokens,
    state.defaultVisionRadius ?? "",
    transformKey,
  ].join("|");
}
