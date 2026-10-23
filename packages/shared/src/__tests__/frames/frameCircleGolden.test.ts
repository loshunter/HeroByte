/**
 * The circle must not change (C5b): every shipped preset bakes to the same
 * bytes as C5a shipped them, recorded on 2026-10-22 before shapes were added.
 * A change here is a visible change to every framed token on every table.
 */

import { describe, expect, it } from "vitest";
import { bakeFrame, FRAME_PRESETS, frameSeed, presetFrame } from "../../index.js";

const C5A_CIRCLE: Record<string, string> = {
  "plain.ring@128/0.1/in/medium": "5de7f36f",
  "plain.ring@512/0.1/in/medium": "a20694cf",
  "plain.ring@128/0.24/out/gargantuan": "2c5a9bc9",
  "plain.chamfer@128/0.1/in/medium": "a935b97b",
  "plain.chamfer@512/0.1/in/medium": "2150e8d9",
  "plain.chamfer@128/0.24/out/gargantuan": "28301029",
  "plain.shadow@128/0.1/in/medium": "d021bc69",
  "plain.shadow@512/0.1/in/medium": "816f993c",
  "plain.shadow@128/0.24/out/gargantuan": "9b0ddc16",
  "brick.red@128/0.1/in/medium": "cfe96845",
  "brick.red@512/0.1/in/medium": "ef3616e7",
  "brick.red@128/0.24/out/gargantuan": "33233e57",
  "stone.castle@128/0.1/in/medium": "18781d65",
  "stone.castle@512/0.1/in/medium": "e60edb4f",
  "stone.castle@128/0.24/out/gargantuan": "8d7fd609",
  "stone.cave@128/0.1/in/medium": "bf35bb8e",
  "stone.cave@512/0.1/in/medium": "8ff20d89",
  "stone.cave@128/0.24/out/gargantuan": "9790e566",
  "stone.cracked@128/0.1/in/medium": "1b40291e",
  "stone.cracked@512/0.1/in/medium": "4e03b55f",
  "stone.cracked@128/0.24/out/gargantuan": "d28def83",
  "stone.sandstone@128/0.1/in/medium": "eb188852",
  "stone.sandstone@512/0.1/in/medium": "f0df897d",
  "stone.sandstone@128/0.24/out/gargantuan": "49007336",
  "metal.blackened@128/0.1/in/medium": "53a0ed9c",
  "metal.blackened@512/0.1/in/medium": "8e0248",
  "metal.blackened@128/0.24/out/gargantuan": "291c920d",
  "metal.riveted@128/0.1/in/medium": "65144b9b",
  "metal.riveted@512/0.1/in/medium": "f7703010",
  "metal.riveted@128/0.24/out/gargantuan": "912b2c92",
  "metal.rusted@128/0.1/in/medium": "5688e0fb",
  "metal.rusted@512/0.1/in/medium": "d12080e7",
  "metal.rusted@128/0.24/out/gargantuan": "fc83a9c0",
  "metal.steel@128/0.1/in/medium": "ca671cfc",
  "metal.steel@512/0.1/in/medium": "cadbd47a",
  "metal.steel@128/0.24/out/gargantuan": "1dc2e1d7",
  "metal.welded@128/0.1/in/medium": "7e0f111d",
  "metal.welded@512/0.1/in/medium": "6a3c0f1e",
  "metal.welded@128/0.24/out/gargantuan": "6098eb4a",
  "wood.oak@128/0.1/in/medium": "7cf158d0",
  "wood.oak@512/0.1/in/medium": "2aaa339f",
  "wood.oak@128/0.24/out/gargantuan": "94c2ea66",
};

const fnv = (bytes: Uint8ClampedArray) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < bytes.length; index += 1) {
    hash ^= bytes[index]!;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
};

const SETUPS = [
  [128, 0.1, "in", "medium"],
  [512, 0.1, "in", "medium"],
  [128, 0.24, "out", "gargantuan"],
] as const;

describe("the circle, as C5a shipped it", () => {
  it("bakes every shipped preset to the same bytes", () => {
    const now: Record<string, string> = {};
    for (const preset of FRAME_PRESETS) {
      for (const [tier, weight, growth, size] of SETUPS) {
        const frame = { ...presetFrame(preset.id, weight)!, growth };
        const { pixels } = bakeFrame({
          frame,
          size,
          accent: "#4f7cc4",
          personal: "#c4504f",
          seed: frameSeed("golden"),
          tier,
        });
        now[`${preset.id}@${tier}/${weight}/${growth}/${size}`] = fnv(pixels);
      }
    }
    expect(now).toEqual(C5A_CIRCLE);
  });
});
