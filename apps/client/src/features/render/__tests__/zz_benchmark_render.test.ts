// TEMPORARY benchmark harness — headless render of the island-grammar-study
// document to a PNG (terrain field + detail pass + decal stamps), plus the
// importable document JSON. Opt-in via BENCH_RENDER=1 (a full bake takes tens
// of seconds — far too slow for default vitest runs). Follows the perfbench
// precedent: zz_ prefix, env gate, never committed to CI paths.
import { describe, it } from "vitest";
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildBenchmarkDocument } from "./zz_benchmarkMapDoc";
import {
  buildProceduralFieldConfig,
  paintProceduralDetail,
} from "../proceduralTerrainSurface";
import { createTerrainField, renderTerrainField } from "../proceduralTerrain";
import { VILLAGE_TERRAIN, VILLAGE_SHADOW_TINT } from "../terrainPalette";
import { paintWearStamp, wearStampSeed, type WearStampContext2D } from "../wearStampDetail";
import { paintSpline } from "../splineDetail";
import type { TileRenderContext2D } from "../tileRenderCore";
import { buildStructuredTerrainLayers } from "../../map-studio/terrainRender";
import { buildTileOccupancy } from "../../map-studio/tileAutotiling";
import { MAP_STUDIO_TILE_ASSETS } from "../../map-studio/starterTileAssets";

const RUN_BENCH = process.env.BENCH_RENDER === "1";
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "../../../../../../temp/benchmark");

// ---- PNG encoder (ported from temp/_dirt_path_proto/transition_v2_proto.mjs) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(w: number, h: number, rgba: Buffer): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- software TileRenderContext2D over the bake buffer ----
function parseHex(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function makeSoftwareCtx(
  buf: Uint8ClampedArray,
  width: number,
  height: number,
  originX: number,
  originY: number,
): TileRenderContext2D {
  let style: string | CanvasGradient | CanvasPattern = "#000000";
  let fill: [number, number, number] = [0, 0, 0];
  let alpha = 1;
  return {
    get fillStyle() {
      return style;
    },
    set fillStyle(value) {
      style = value;
      if (typeof value === "string" && value.startsWith("#")) fill = parseHex(value);
    },
    strokeStyle: "#000000",
    lineWidth: 1,
    get globalAlpha() {
      return alpha;
    },
    set globalAlpha(value) {
      alpha = Math.min(1, Math.max(0, value));
    },
    imageSmoothingEnabled: false,
    fillRect(x, y, w, h) {
      const x0 = Math.max(0, Math.round(x - originX));
      const y0 = Math.max(0, Math.round(y - originY));
      const x1 = Math.min(width, Math.round(x + w - originX));
      const y1 = Math.min(height, Math.round(y + h - originY));
      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          const o = (py * width + px) * 4;
          if (alpha >= 1) {
            buf[o] = fill[0];
            buf[o + 1] = fill[1];
            buf[o + 2] = fill[2];
            buf[o + 3] = 255;
          } else {
            buf[o] = buf[o]! * (1 - alpha) + fill[0] * alpha;
            buf[o + 1] = buf[o + 1]! * (1 - alpha) + fill[1] * alpha;
            buf[o + 2] = buf[o + 2]! * (1 - alpha) + fill[2] * alpha;
            buf[o + 3] = 255;
          }
        }
      }
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    save() {},
    restore() {},
    drawImage() {},
  };
}

/** Shift a stamp painter's local coords to the element's document position. */
function offsetCtx(real: TileRenderContext2D, dx: number, dy: number): WearStampContext2D {
  return {
    get fillStyle() {
      return real.fillStyle;
    },
    set fillStyle(value) {
      real.fillStyle = value;
    },
    get globalAlpha() {
      return real.globalAlpha;
    },
    set globalAlpha(value) {
      real.globalAlpha = value;
    },
    fillRect: (x, y, w, h) => real.fillRect(x + dx, y + dy, w, h),
  };
}

describe.skipIf(!RUN_BENCH)("benchmark render (temporary)", () => {
  it("renders the island study document to temp/benchmark/", () => {
    const doc = buildBenchmarkDocument();
    const occupancy = buildTileOccupancy(doc);
    const layers = buildStructuredTerrainLayers(doc.terrain!, doc.grid, occupancy);
    const built = buildProceduralFieldConfig(layers, doc.grid, VILLAGE_TERRAIN, VILLAGE_SHADOW_TINT);
    if (!built) throw new Error("no field terrain in benchmark document");
    const { config, width, height } = built;
    if (width * height > 32_000_000) throw new Error(`bake too large: ${width}x${height}`);

    const buffer = new Uint8ClampedArray(width * height * 4);
    const t0 = performance.now();
    renderTerrainField(buffer, width, height, config);
    const t1 = performance.now();

    const ctx = makeSoftwareCtx(buffer, width, height, config.originX, config.originY);
    const field = createTerrainField(config);
    const fieldLayers = layers.filter((layer) => VILLAGE_TERRAIN[layer.assetId]);
    paintProceduralDetail(ctx, fieldLayers, VILLAGE_TERRAIN, field, config.familyAt, config.depthOf);
    const t2 = performance.now();

    // spline elements (persistent curves) over the terrain
    for (const el of doc.elements) {
      if (el.type !== "spline") continue;
      paintSpline(
        offsetCtx(ctx, el.transform.x, el.transform.y),
        el.data.points,
        el.data.kind,
        wearStampSeed(el.id),
        doc.grid.size,
        el.data.tint,
      );
    }

    // decal stamps (rank 7/8 art) over the terrain, as the bake layers them
    for (const el of doc.elements) {
      if (el.type !== "stamp") continue;
      const asset = MAP_STUDIO_TILE_ASSETS.find((a) => a.id === el.data.assetId);
      if (!asset?.decal) continue;
      paintWearStamp(
        offsetCtx(ctx, el.transform.x, el.transform.y),
        el.data.width,
        el.data.height,
        wearStampSeed(el.id),
        asset.decal,
        el.data.tint,
      );
    }

    mkdirSync(OUT_DIR, { recursive: true });
    const png = encodePNG(width, height, Buffer.from(buffer.buffer, 0, buffer.byteLength));
    writeFileSync(join(OUT_DIR, "benchmark-island-study.png"), png);
    writeFileSync(join(OUT_DIR, "benchmark-map-document.json"), JSON.stringify(doc));
    console.log(
      `bake ${width}x${height} field ${(t1 - t0).toFixed(0)}ms detail ${(t2 - t1).toFixed(0)}ms -> temp/benchmark/benchmark-island-study.png`,
    );
  }, 600_000);
});
