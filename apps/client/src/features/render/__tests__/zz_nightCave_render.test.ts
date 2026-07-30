// TEMPORARY benchmark harness — headless render of the night-flooded-cave study
// document to a PNG. The first study rendered WITH lighting: ambient veil +
// 3-stop lantern pools + the night grade. Opt-in via BENCH_RENDER=1.
import { describe, it } from "vitest";

import { buildNightCaveDocument } from "./zz_nightCaveMapDoc";
import { renderDocumentToPng } from "./zz_renderHarness";

const RUN_BENCH = process.env.BENCH_RENDER === "1";

describe.skipIf(!RUN_BENCH)("night cave benchmark render (temporary)", () => {
  it("renders the night flooded cave study document to temp/benchmark/", () => {
    const { doc, lighting } = buildNightCaveDocument();
    const { width, height, fieldMs, detailMs } = renderDocumentToPng(doc, "benchmark-night-cave", {
      lighting,
      // A faint cold sea-mist over the water, pooling toward the far chambers.
      haze: { color: "#22384f", strength: 0.3, scale: 11, rampTop: 0.6, rampBottom: 1.1 },
    });
    console.log(
      `bake ${width}x${height} field ${fieldMs.toFixed(0)}ms detail ${detailMs.toFixed(0)}ms ` +
        `lights ${lighting.lights.length} ambient ${lighting.ambient} ` +
        `-> temp/benchmark/benchmark-night-cave.png`,
    );
  }, 900_000);
});
