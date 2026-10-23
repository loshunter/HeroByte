/**
 * A Frame tab preview while a changed shape's bake is still out (C5b review
 * round 3): the picture is clipped to the shape of the bitmap on show, the old
 * frame's, so a circle bitmap never sits over a hexagon's clip.
 */

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultTokenFrame, layoutFrame } from "@herobyte/shared";
import { FramePreview } from "../FramePreview";

const circle = defaultTokenFrame();
vi.mock("../../../render/frame/useFrameBitmap", () => ({
  useFrameBitmap: () => ({ bitmap: null, extent: 0.6, layout: layoutFrame(circle) }),
}));

describe("a Frame tab preview while a changed shape bakes", () => {
  it("clips to the shape of the bitmap on show", () => {
    const calls: string[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () =>
        new Proxy({} as Record<string, unknown>, {
          get: (target, name: string) => (name in target ? target[name] : () => calls.push(name)),
          set: (target, name: string, value) => {
            target[name] = value;
            return true;
          },
        }) as never,
    );
    render(
      <FramePreview
        frame={{ ...circle, shape: "hexagon" }}
        tokenId="t1"
        color="#390076"
        edge={88}
        floor="dark"
        label="Preview"
      />,
    );
    expect(calls).toContain("arc");
    expect(calls).not.toContain("lineTo");
  });
});
