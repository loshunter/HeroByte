// ============================================================================
// useFrameTierBudget — the one tier every framed token on the map bakes at (C5a)
// ============================================================================
// Every framed token holds its bitmap while it draws, and held bitmaps are
// never evicted, so the map's frames must fit the cache together. Counted in
// DISTINCT bitmaps, not tokens: plain rings of one colour, weight and size
// share one, and costing them one each would blur everyone's for nothing.

import { useRef } from "react";
import { frameBakeKey, frameSeed, type SceneObject } from "@herobyte/shared";
import { frameCacheCap } from "./frameBitmapCache";
import { nextFrameBudget, type FrameTierBudget } from "./frameTier";
import { frameAccent, framePersonal } from "./frameColors";

type TokenObject = SceneObject & { type: "token" };

/** A token's bake key at no tier, kept per scene object (a changed token is a new object). */
const keys = new WeakMap<TokenObject, string | null>();
function tierFreeKey(object: TokenObject): string | null {
  if (keys.has(object)) return keys.get(object)!;
  const { frame, color, size } = object.data;
  const key = frame
    ? frameBakeKey({
        frame,
        size,
        accent: frameAccent(frame, color),
        personal: framePersonal(color),
        seed: frameSeed(object.id.replace(/^token:/, "")),
        tier: 0,
      })
    : null;
  keys.set(object, key);
  return key;
}

/** How many different bitmaps these tokens' frames are. */
export function distinctFrameBitmaps(objects: readonly TokenObject[]): number {
  const seen = new Set<string>();
  for (const object of objects) {
    const key = tierFreeKey(object);
    if (key !== null) seen.add(key);
  }
  return seen.size;
}

export function useFrameTierBudget(objects: readonly TokenObject[]): FrameTierBudget {
  const budget = useRef<FrameTierBudget | null>(null);
  const next = nextFrameBudget(budget.current, distinctFrameBitmaps(objects), frameCacheCap());
  // The same object while nothing changes, so no sprite sees a new prop.
  if (
    budget.current === null ||
    budget.current.tier !== next.tier ||
    budget.current.shareSeeds !== next.shareSeeds
  ) {
    budget.current = next;
  }
  return budget.current;
}
