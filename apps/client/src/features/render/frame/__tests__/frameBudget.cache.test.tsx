// Many framed tokens on one real cache (C5a, review round 4): the map's budget
// keeps every held bitmap inside the cap whatever the count and whatever order
// the tokens render in, a re-render that changes nothing bakes nothing, and
// past the smallest tier's room the stones are shared so the frames are one
// bitmap. jsdom has no Worker: the bake takes the timer path (the same pure
// bake), and the two bitmap globals are stubbed, as in frameBitmapCache.test.

import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { presetFrame, type SceneObject, type TokenFrame } from "@herobyte/shared";
import { frameStatsSnapshot, resetFrameBitmapCache } from "../frameBitmapCache";
import type { FrameTierBudget } from "../frameTier";
import { useFrameBitmap } from "../useFrameBitmap";
import { useFrameTierBudget } from "../useFrameTierBudget";

type TokenObject = SceneObject & { type: "token" };
const token = (index: number, frame: TokenFrame, color = "#390076"): TokenObject => ({
  id: `token:t${index}`,
  type: "token",
  owner: "me",
  locked: false,
  zIndex: 10,
  transform: { x: index, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  data: { color, size: "medium", frame },
});

function Token({ object, budget }: { object: TokenObject; budget: FrameTierBudget }) {
  useFrameBitmap({
    frame: object.data.frame!,
    tokenId: object.id.replace(/^token:/, ""),
    color: object.data.color,
    size: object.data.size,
    tokenPx: 75,
    zoom: 8, // every frame wants 1024 on its own
    budget,
  });
  return null;
}
function Map({ objects }: { objects: TokenObject[]; hovered?: number }) {
  const budget = useFrameTierBudget(objects);
  return (
    <>
      {objects.map((object) => (
        <Token key={object.id} object={object} budget={budget} />
      ))}
    </>
  );
}

describe("the map's frames on one cache", () => {
  let coarse = false;
  beforeEach(() => {
    coarse = false;
    vi.stubGlobal(
      "ImageData",
      class {
        constructor(
          public data: Uint8ClampedArray,
          public width: number,
          public height: number,
        ) {}
      },
    );
    vi.stubGlobal("createImageBitmap", async (image: { width: number }) => ({
      width: image.width,
      height: image.width,
    }));
    window.matchMedia = ((query: string) => ({ matches: coarse, media: query })) as never;
    vi.stubGlobal("devicePixelRatio", 2);
    resetFrameBitmapCache();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("holds thirty different frames at 512 inside the cap, and re-renders bake nothing", async () => {
    const castle = presetFrame("stone.castle")!;
    const objects = [...Array(30)].map((_, index) => token(index, castle));
    const view = render(<Map objects={objects} />);
    await waitFor(() => expect(frameStatsSnapshot().bakes).toBe(30), { timeout: 20_000 });
    const { cacheBytes, cap } = frameStatsSnapshot();
    expect(cacheBytes).toBe(30 * 512 * 512 * 4);
    expect(cacheBytes).toBeLessThanOrEqual(cap);
    for (let hover = 0; hover < 10; hover += 1)
      view.rerender(<Map objects={objects} hovered={hover} />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(frameStatsSnapshot().bakes).toBe(30);
  }, 30_000);

  it("counts one bitmap for rings alike, so they keep the tier their size wants", async () => {
    const ring = presetFrame("plain.ring")!;
    render(<Map objects={[...Array(30)].map((_, index) => token(index, ring))} />);
    await waitFor(() => expect(frameStatsSnapshot().bakes).toBe(1));
    expect(frameStatsSnapshot().cacheBytes).toBe(1024 * 1024 * 4);
  });

  it("on a phone, shares the stones of 240 frames rather than pass the cap", async () => {
    coarse = true;
    const castle = presetFrame("stone.castle")!;
    render(<Map objects={[...Array(240)].map((_, index) => token(index, castle))} />);
    await waitFor(() => expect(frameStatsSnapshot().bakes).toBe(1));
    expect(frameStatsSnapshot().cacheBytes).toBeLessThanOrEqual(frameStatsSnapshot().cap);
  });
});
