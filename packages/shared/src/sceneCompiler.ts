// Compiles a Map Studio document into the play-surface geometry a live room
// enforces: occlusion segments, interactive doors, and light sources.
//
// Publish compiles, never flattens: the rendered background is cosmetic, while
// the CompiledScene carries the structured walls/doors/lights that live
// systems (movement blocking, door interaction, vision) consume. Layer
// visibility and opacity are paint-only concerns, so walls on a hidden layer
// still block; the per-element `hidden` flag is the only opt-out.

import type { MapDocument, MapDoorElement, MapElementTransform } from "./mapStudioTypes.js";

export const COMPILED_SCENE_SCHEMA_VERSION = 1;

export interface CompiledWallSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  blocksMovement: boolean;
  blocksVision: boolean;
}

export type CompiledDoorState = MapDoorElement["data"]["state"];

export interface CompiledDoor {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  state: CompiledDoorState;
  blocksMovement: boolean;
  blocksVision: boolean;
}

export interface CompiledLight {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  intensity: number;
  castsShadows: boolean;
}

export interface CompiledScene {
  schemaVersion: typeof COMPILED_SCENE_SCHEMA_VERSION;
  sourceDocumentId: string;
  sourceRevision: number;
  compiledAt: number;
  walls: CompiledWallSegment[];
  doors: CompiledDoor[];
  lights: CompiledLight[];
}

export interface BlockingSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function compileScene(document: MapDocument, timestamp: number = Date.now()): CompiledScene {
  const walls: CompiledWallSegment[] = [];
  const doors: CompiledDoor[] = [];
  const lights: CompiledLight[] = [];

  for (const element of document.elements) {
    if (element.hidden) continue;

    if (element.type === "wall") {
      const points = element.data.points.map((point) =>
        toWorld(element.transform, point.x, point.y),
      );
      for (let index = 0; index < points.length - 1; index += 1) {
        walls.push({
          id: `${element.id}#${index}`,
          x1: points[index]!.x,
          y1: points[index]!.y,
          x2: points[index + 1]!.x,
          y2: points[index + 1]!.y,
          blocksMovement: element.data.blocksMovement,
          blocksVision: element.data.blocksVision,
        });
      }
    } else if (element.type === "door") {
      const start = toWorld(element.transform, 0, 0);
      const end = toWorld(element.transform, element.data.width, 0);
      doors.push({
        id: element.id,
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        state: element.data.state,
        blocksMovement: element.data.blocksMovement,
        blocksVision: element.data.blocksVision,
      });
    } else if (element.type === "light") {
      const origin = toWorld(element.transform, 0, 0);
      lights.push({
        id: element.id,
        x: origin.x,
        y: origin.y,
        radius:
          element.data.radius *
          Math.max(Math.abs(element.transform.scaleX), Math.abs(element.transform.scaleY)),
        color: element.data.color,
        intensity: element.data.intensity,
        castsShadows: element.data.castsShadows,
      });
    }
  }

  return {
    schemaVersion: COMPILED_SCENE_SCHEMA_VERSION,
    sourceDocumentId: document.id,
    sourceRevision: document.revision,
    compiledAt: timestamp,
    walls,
    doors,
    lights,
  };
}

// Clamps an authored document grid size into the range the live tabletop
// supports. Shared so client previews and the server publish path agree.
export function toLiveGridSize(documentGridSize: number): number {
  return Math.min(500, Math.max(10, Math.round(documentGridSize)));
}

export function doorBlocksMovement(door: CompiledDoor): boolean {
  return door.state !== "open" && door.blocksMovement;
}

export function doorBlocksVision(door: CompiledDoor): boolean {
  return door.state !== "open" && door.blocksVision;
}

export function getMovementBlockingSegments(scene: CompiledScene): BlockingSegment[] {
  const segments: BlockingSegment[] = [];
  for (const wall of scene.walls) {
    if (wall.blocksMovement) {
      segments.push({ id: wall.id, x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 });
    }
  }
  for (const door of scene.doors) {
    if (doorBlocksMovement(door)) {
      segments.push({ id: door.id, x1: door.x1, y1: door.y1, x2: door.x2, y2: door.y2 });
    }
  }
  return segments;
}

// Matches the SVG export transform `translate(x y) rotate(r) scale(sx sy)`:
// scale applies first, then rotation (degrees), then translation.
function toWorld(
  transform: MapElementTransform,
  localX: number,
  localY: number,
): { x: number; y: number } {
  const scaledX = localX * transform.scaleX;
  const scaledY = localY * transform.scaleY;
  const radians = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: transform.x + scaledX * cos - scaledY * sin,
    y: transform.y + scaledX * sin + scaledY * cos,
  };
}
