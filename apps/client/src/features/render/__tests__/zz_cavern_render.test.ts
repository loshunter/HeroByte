// TEMPORARY benchmark harness — headless render of the lava-cavern study
// document to a PNG. Opt-in via BENCH_RENDER=1 (a full bake takes tens of
// seconds). Follows the island study's precedent: zz_ prefix, env gate.
import { describe, it } from "vitest";

import { buildCavernDocument } from "./zz_cavernMapDoc";
import { renderDocumentToPng } from "./zz_renderHarness";

const RUN_BENCH = process.env.BENCH_RENDER === "1";

describe.skipIf(!RUN_BENCH)("lava cavern benchmark render (temporary)", () => {
  it("renders the lava cavern study document to temp/benchmark/", () => {
    const doc = buildCavernDocument();
    // Smoke pools low: a thin veil at the lake, thickening toward the floor —
    // the reference's lower half is heavily hazed.
    const { width, height, fieldMs, detailMs } = renderDocumentToPng(doc, "benchmark-lava-cavern", {
      color: "#b9a99e",
      strength: 0.5,
      scale: 9,
      rampTop: 0.25,
      rampBottom: 1.15,
    });
    console.log(
      `bake ${width}x${height} field ${fieldMs.toFixed(0)}ms detail ${detailMs.toFixed(0)}ms ` +
        `-> temp/benchmark/benchmark-lava-cavern.png`,
    );
  }, 900_000);
});
