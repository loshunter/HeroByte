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
  "plain.ring@256/0.05/mid/large": "70dfb1e",
  "plain.ring@1024/0.34/in/tiny": "ac60ea7f",
  "plain.chamfer@256/0.05/mid/large": "86dbbe71",
  "plain.chamfer@1024/0.34/in/tiny": "bbaf2645",
  "plain.shadow@256/0.05/mid/large": "d3f70501",
  "plain.shadow@1024/0.34/in/tiny": "f75cb442",
  "brick.red@256/0.05/mid/large": "7c17770f",
  "brick.red@1024/0.34/in/tiny": "8f021cc8",
  "stone.castle@256/0.05/mid/large": "7734fcda",
  "stone.castle@1024/0.34/in/tiny": "470ab4c3",
  "stone.cave@256/0.05/mid/large": "c34a8ee7",
  "stone.cave@1024/0.34/in/tiny": "c4d45657",
  "stone.cracked@256/0.05/mid/large": "d779d21",
  "stone.cracked@1024/0.34/in/tiny": "acc0c5ba",
  "stone.sandstone@256/0.05/mid/large": "f2a25103",
  "stone.sandstone@1024/0.34/in/tiny": "69831b88",
  "metal.blackened@256/0.05/mid/large": "b30697e0",
  "metal.blackened@1024/0.34/in/tiny": "c70f7321",
  "metal.riveted@256/0.05/mid/large": "2443587c",
  "metal.riveted@1024/0.34/in/tiny": "931d1372",
  "metal.rusted@256/0.05/mid/large": "abeadf9f",
  "metal.rusted@1024/0.34/in/tiny": "984499ca",
  "metal.steel@256/0.05/mid/large": "2e102fea",
  "metal.steel@1024/0.34/in/tiny": "ae1123d5",
  "metal.welded@256/0.05/mid/large": "ca8225cf",
  "metal.welded@1024/0.34/in/tiny": "1706d35a",
  "wood.oak@256/0.05/mid/large": "2383ea70",
  "wood.oak@1024/0.34/in/tiny": "de0dcb1c",
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
  [256, 0.05, "mid", "large"],
  [1024, 0.34, "in", "tiny"],
] as const;

describe("the circle, as C5a shipped it", () => {
  it.each(FRAME_PRESETS.map((preset) => preset.id))(
    "bakes %s to the same bytes",
    { timeout: 30_000 },
    (id) => {
      const now: Record<string, string> = {};
      const expected: Record<string, string> = {};
      for (const preset of FRAME_PRESETS.filter((each) => each.id === id)) {
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
          const key = `${preset.id}@${tier}/${weight}/${growth}/${size}`;
          now[key] = fnv(pixels);
          expected[key] = C5A_CIRCLE[key]!;
        }
      }
      expect(now).toEqual(expected);
    },
  );

  it("holds a hash for every shipped preset and setup, and no other", () => {
    const keys = FRAME_PRESETS.flatMap((preset) =>
      SETUPS.map(
        ([tier, weight, growth, size]) => `${preset.id}@${tier}/${weight}/${growth}/${size}`,
      ),
    );
    expect(Object.keys(C5A_CIRCLE).sort()).toEqual(keys.sort());
  });
});
