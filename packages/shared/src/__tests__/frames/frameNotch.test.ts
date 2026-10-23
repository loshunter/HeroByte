/**
 * The facing notch (C5b): one arrow gem at the top of the frame, pointing up.
 * It must sit at the top centre of every shape at every weight, leave the
 * rest of the frame untouched, bake the same whatever the token's seed, and
 * the server must take only the one arrow.
 */

import { describe, expect, it } from "vitest";
import {
  bakeFrame,
  coerceTokenFrame,
  FRAME_SHAPES,
  FRAME_WEIGHTS,
  frameBakeKey,
  presetFrame,
  sanitizeTokenFrame,
  type TokenFrame,
} from "../../index.js";

const notched = (frame: TokenFrame): TokenFrame => ({ ...frame, notch: { gem: "arrow" } });
const bake = (frame: TokenFrame, seed = 1) =>
  bakeFrame({ frame, accent: "#4f7cc4", seed, tier: 128 });

describe("the facing notch", () => {
  it("sits at the top centre of every shape at every weight, and nowhere else", () => {
    for (const shape of FRAME_SHAPES) {
      for (const weight of [...Object.values(FRAME_WEIGHTS), 0.34]) {
        const frame = { ...presetFrame("stone.castle", weight)!, shape };
        const plain = bake(frame);
        const gem = bake(notched(frame));
        const { tier, layout } = gem;
        const scale = tier / (2 * layout.extent);
        let changed = 0;
        for (let y = 0; y < tier; y += 1) {
          for (let x = 0; x < tier; x += 1) {
            const at = (y * tier + x) * 4;
            if (gem.pixels.slice(at, at + 4).every((value, k) => value === plain.pixels[at + k])) {
              continue;
            }
            changed += 1;
            const tx = (x + 0.5) / scale - layout.extent;
            const ty = (y + 0.5) / scale - layout.extent;
            expect(Math.abs(tx), `${shape} at ${weight}`).toBeLessThan(0.13); // 0.62 × 1.18 / 2 of the gem, at 0.34
            expect(ty, `${shape} at ${weight}`).toBeLessThan(-0.08); // the upper part only (a hexagon's top is lower: 0.433)
          }
        }
        expect(changed, `${shape} at ${weight}`).toBeGreaterThan(20);
      }
    }
  });

  it("is the same gem whatever the token, and a frame without one bakes as before", () => {
    const frame = presetFrame("plain.ring")!;
    expect(bake(notched(frame), 1).pixels).toEqual(bake(notched(frame), 99).pixels);
    const { notch: _none, ...without } = notched(frame);
    expect(bake(without).pixels).toEqual(bake(frame).pixels);
  });

  it("is part of the bake key, so a frame with one never shares a bitmap without", () => {
    const input = { accent: "#4f7cc4", seed: 1, tier: 128 };
    // a ring in the frame's colour already: only the notch itself can tell the keys apart
    const frame = presetFrame("plain.ring")!;
    expect(frameBakeKey({ ...input, frame })).not.toBe(
      frameBakeKey({ ...input, frame: notched(frame) }),
    );
  });

  it("is refused by the server for any gem but the arrow and any count but one", () => {
    const frame = presetFrame("plain.ring")!;
    const refusal = (notch: unknown) => {
      const result = sanitizeTokenFrame({ ...frame, notch });
      return "error" in result ? result.error : null;
    };
    expect(refusal({ gem: "arrow" })).toBeNull();
    expect(refusal({ gem: "arrow", count: 1 })).toBeNull();
    expect(refusal({ gem: "arrow", count: 2 })).toBe("frame notch count must be 1");
    expect(refusal({ gem: "star" })).toBe("frame notch gem must be arrow");
    expect(refusal("arrow")).toBe("frame notch must be an object");
    const kept = sanitizeTokenFrame({ ...frame, notch: { gem: "arrow", count: 1, glow: true } });
    expect("frame" in kept && kept.frame.notch).toEqual({ gem: "arrow" });
  });

  it("loads from a file as the one arrow, or not at all", () => {
    const frame = presetFrame("plain.ring")!;
    expect(coerceTokenFrame({ ...frame, notch: { gem: "arrow", count: 3 } })!.notch).toEqual({
      gem: "arrow",
    });
    expect(coerceTokenFrame({ ...frame, notch: { gem: "star" } })).not.toHaveProperty("notch");
  });
});
