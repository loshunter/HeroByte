import type { SceneObject } from "@shared";

/**
 * Convert world coordinates to local coordinates relative to a scene object.
 *
 * This function accounts for:
 * - Object position (x, y)
 * - Object rotation (in degrees)
 * - Object scale (scaleX, scaleY)
 *
 * @param world - World coordinates {x, y}
 * @param transform - Scene object transform containing position, rotation, and scale
 * @returns Local coordinates relative to the object's transform
 *
 * @example
 * ```ts
 * const world = { x: 100, y: 200 };
 * const transform = { x: 50, y: 50, scaleX: 2, scaleY: 2, rotation: 45 };
 * const local = worldToMapLocal(world, transform);
 * // Returns coordinates in the object's local space
 * ```
 */
export function worldToMapLocal(
  world: { x: number; y: number },
  transform: SceneObject["transform"],
): { x: number; y: number } {
  const { x, y, scaleX, scaleY, rotation } = transform;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const dx = world.x - x;
  const dy = world.y - y;

  const localX = (cos * dx + sin * dy) / (Math.abs(scaleX) < 1e-6 ? 1 : scaleX);
  const localY = (-sin * dx + cos * dy) / (Math.abs(scaleY) < 1e-6 ? 1 : scaleY);

  return { x: localX, y: localY };
}
