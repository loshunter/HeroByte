// Procedural 47-blob quarter-tile generator (dependency-free).
//
// Emits a family's blob47 SILHOUETTE sheet in the layout
// tileAtlas.quarterRectsForCell consumes: columns are the quarter variant,
// rows are the corner (tl=0, tr=1, bl=2, br=3).
//   col 0 outer corner · col 1 horiz edge · col 2 vert edge · col 3 inner
//   corner · col 4 interior (flat fill).
//
// This handles only the terrain SHAPE — a flat base with a cool rim on
// boundary edges and rounded convex / softened concave corners (SLYNYRD-style
// top-down terrain, pixelblog #20). All interior DECORATION (grass blades,
// tall-grass blobs, flowers) is painted separately by render/terrainDetail
// from coherent noise, so it isn't baked/repeated in the tile. NO AI art, no
// third-party pixels, no new deps — provenance is this script.
//
// Usage: node scripts/gen-tile-blob47.mjs [--preview]

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");

// --- Minimal PNG encoder (RGBA, 8-bit, no interlace) — zlib is built in. ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// --- Palette (grass silhouette: flat base + cool rim). ---
const BASE = [124, 176, 74, 255]; // #7cb04a
const RIM = [74, 118, 78, 255]; // #4a764e cool shadow lip

const Q = 16; // logical px per quarter
const SCALE = 4; // -> 64px quarter / 128px tile
const PAD = 4;
const ROUND_R = 5; // convex corner radius (v0)
const RIM_D = 2.6; // distance-to-empty < this -> rim
const COLS = 5; // variants 0..3 (edges) + 4 (interior)

const CORNERS = ["tl", "tr", "bl", "br"];
const CORNER_ROW = { tl: 0, tr: 1, bl: 2, br: 3 };
const GEOM = {
  tl: { outerH: "top", outerV: "left" },
  tr: { outerH: "top", outerV: "right" },
  bl: { outerH: "bottom", outerV: "left" },
  br: { outerH: "bottom", outerV: "right" },
};

function insideSolid(corner, variant, lx, ly) {
  const g = GEOM[corner];
  const dH = g.outerH === "top" ? ly : Q - 1 - ly;
  const dV = g.outerV === "left" ? lx : Q - 1 - lx;
  if (variant === 0 && dH < ROUND_R && dV < ROUND_R) {
    const a = ROUND_R - dV;
    const b = ROUND_R - dH;
    if (a * a + b * b > ROUND_R * ROUND_R) return false; // carve convex corner
  }
  return true; // v3 inner corner stays solid; its rim comes from padSolid
}
function padSolid(corner, variant, lx, ly) {
  const g = GEOM[corner];
  const hBoundary = variant === 0 || variant === 1;
  const vBoundary = variant === 0 || variant === 2;
  const outerTop = g.outerH === "top";
  const outerLeft = g.outerV === "left";
  let vSolid = true;
  let hSolid = true;
  if (ly < 0) hSolid = outerTop ? !hBoundary : true;
  else if (ly >= Q) hSolid = outerTop ? true : !hBoundary;
  if (lx < 0) vSolid = outerLeft ? !vBoundary : true;
  else if (lx >= Q) vSolid = outerLeft ? true : !vBoundary;
  const outsideY = ly < 0 || ly >= Q;
  const outsideX = lx < 0 || lx >= Q;
  if (outsideY && outsideX) {
    if (variant === 3) {
      const atOuterH = outerTop ? ly < 0 : ly >= Q;
      const atOuterV = outerLeft ? lx < 0 : lx >= Q;
      if (atOuterH && atOuterV) return false; // concave corner rim
    }
    return hSolid && vSolid;
  }
  if (outsideY) return hSolid;
  return vSolid;
}
// One quarter (Q x Q RGBA) for a corner + variant (0..4).
function renderQuarter(corner, variant) {
  const S = Q + 2 * PAD;
  const solid = new Uint8Array(S * S);
  for (let gy = 0; gy < S; gy += 1) {
    for (let gx = 0; gx < S; gx += 1) {
      const lx = gx - PAD;
      const ly = gy - PAD;
      const inside = lx >= 0 && lx < Q && ly >= 0 && ly < Q;
      solid[gy * S + gx] = inside ? (insideSolid(corner, variant, lx, ly) ? 1 : 0) : padSolid(corner, variant, lx, ly) ? 1 : 0;
    }
  }
  const out = new Uint8Array(Q * Q * 4);
  for (let ly = 0; ly < Q; ly += 1) {
    for (let lx = 0; lx < Q; lx += 1) {
      const o = (ly * Q + lx) * 4;
      const gx = lx + PAD;
      const gy = ly + PAD;
      if (!solid[gy * S + gx]) continue; // transparent
      let best = Infinity;
      for (let ny = 0; ny < S; ny += 1) {
        for (let nx = 0; nx < S; nx += 1) {
          if (solid[ny * S + nx]) continue;
          const dx = nx - gx;
          const dy = ny - gy;
          const dd = dx * dx + dy * dy;
          if (dd < best) best = dd;
        }
      }
      const color = Math.sqrt(best) < RIM_D ? RIM : BASE; // interior (v4) has no empty -> all base
      out[o] = color[0];
      out[o + 1] = color[1];
      out[o + 2] = color[2];
      out[o + 3] = color[3];
    }
  }
  return out;
}

function blit(dst, dstW, src, ox, oy, scale) {
  for (let ly = 0; ly < Q; ly += 1) {
    for (let lx = 0; lx < Q; lx += 1) {
      const s = (ly * Q + lx) * 4;
      if (src[s + 3] === 0) continue;
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const d = ((oy + ly * scale + sy) * dstW + (ox + lx * scale + sx)) * 4;
          dst[d] = src[s];
          dst[d + 1] = src[s + 1];
          dst[d + 2] = src[s + 2];
          dst[d + 3] = 255;
        }
      }
    }
  }
}

const q = Q * SCALE;
const SW = COLS * q;
const SH = 4 * q;
const sheet = Buffer.alloc(SW * SH * 4);
for (const corner of CORNERS) {
  for (let v = 0; v < COLS; v += 1) {
    blit(sheet, SW, renderQuarter(corner, v), v * q, CORNER_ROW[corner] * q, SCALE);
  }
}
writeFileSync(join(REPO, "assets/images/tiles/grass_blob47.png"), encodePNG(SW, SH, sheet));
console.log(`grass_blob47.png: ${SW}x${SH} (silhouette only; detail is procedural)`);
