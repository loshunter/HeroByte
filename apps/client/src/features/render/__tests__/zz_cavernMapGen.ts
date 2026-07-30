// TEMPORARY benchmark fixture generator — the LAVA CAVERN study map, composed
// from our own procedural families only (terrainPaletteCavern + the shipped
// roster). Deterministic: no Math.random, every jitter is hash2-seeded, so the
// render is reproducible. Mirrors zz_benchmarkMapGen's helper vocabulary.

import { hash2 } from "../valueNoise";

export const CAV_W = 40;
export const CAV_H = 58;

export interface CavStampIntent {
  assetId: string;
  /** stamp CENTRE in cell coords */
  centerX: number;
  centerY: number;
  /** footprint in cells */
  cellsW: number;
  cellsH: number;
  /** Optional recolour — the stamp painters take a tint, so one bundled prop
   * serves several moods (a pale menhir becomes a basalt boulder). */
  tint?: string;
}

export interface CavMap {
  width: number;
  height: number;
  cells: Map<string, string>;
  stamps: CavStampIntent[];
}

const key = (x: number, y: number) => `${x},${y}`;
const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < CAV_W && y < CAV_H;

/** Organic blob: radial-noise disc (silhouette frequency = lobes). */
// prettier-ignore
function blob(set: Set<string>, cx: number, cy: number, baseR: number, seed: number, lobes = 5, amp = 0.24): void {
  const p1 = hash2(1, seed, 7) * Math.PI * 2;
  const p2 = hash2(2, seed, 7) * Math.PI * 2;
  for (let y = Math.floor(cy - baseR * 1.6); y <= Math.ceil(cy + baseR * 1.6); y++) {
    for (let x = Math.floor(cx - baseR * 1.6); x <= Math.ceil(cx + baseR * 1.6); x++) {
      if (!inBounds(x, y)) continue;
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const th = Math.atan2(dy, dx);
      const r =
        baseR * (1 + amp * Math.sin(lobes * th + p1) + amp * 0.6 * Math.sin((lobes + 3) * th + p2));
      if (Math.hypot(dx, dy) < r) set.add(key(x, y));
    }
  }
}

function disc(set: Set<string>, cx: number, cy: number, r: number): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (inBounds(x, y) && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < r) set.add(key(x, y));
    }
}

/** Cells within halfW of the segment, with sideways wobble noise. */
// prettier-ignore
function thickLine(set: Set<string>, x0: number, y0: number, x1: number, y1: number, halfW: number, seed: number, wobble: number): void {
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const steps = Math.ceil(len * 3);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let px = x0 + (x1 - x0) * t;
    let py = y0 + (y1 - y0) * t;
    if (wobble > 0) {
      const n = hash2(Math.round(px * 2), Math.round(py * 2), seed) - 0.5;
      px += (-(y1 - y0) / len) * n * wobble * 2;
      py += ((x1 - x0) / len) * n * wobble * 2;
    }
    disc(set, px, py, halfW);
  }
}

function fill(cells: Map<string, string>, set: Set<string>, family: string): void {
  for (const k of set) cells.set(k, family);
}

// prettier-ignore
function rect(cells: Map<string, string>, family: string, x0: number, y0: number, w: number, h: number): void {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) if (inBounds(x, y)) cells.set(key(x, y), family);
}

/** Hollow ring one cell thick — room walls and forge collars. */
// prettier-ignore
function ringRect(cells: Map<string, string>, family: string, x0: number, y0: number, w: number, h: number): void {
  for (let x = x0; x < x0 + w; x++) {
    if (inBounds(x, y0)) cells.set(key(x, y0), family);
    if (inBounds(x, y0 + h - 1)) cells.set(key(x, y0 + h - 1), family);
  }
  for (let y = y0; y < y0 + h; y++) {
    if (inBounds(x0, y)) cells.set(key(x0, y), family);
    if (inBounds(x0 + w - 1, y)) cells.set(key(x0 + w - 1, y), family);
  }
}

/** A forge platform: dais collar, molten core, timber beams radiating out. */
function forge(cells: Map<string, string>, cx: number, cy: number, seed: number): void {
  const beams = new Set<string>();
  for (let i = 0; i < 6; i++) {
    const th = (i / 6) * Math.PI * 2 + hash2(i, seed, 3) * 0.5;
    thickLine(beams, cx, cy, cx + Math.cos(th) * 4.2, cy + Math.sin(th) * 4.2, 0.35, seed + i, 0);
  }
  fill(cells, beams, "terrain:wood-walnut");
  const collar = new Set<string>();
  disc(collar, cx, cy, 2.6);
  fill(cells, collar, "terrain:dais-stone");
  const core = new Set<string>();
  disc(core, cx, cy, 1.35);
  fill(cells, core, "terrain:lava");
}

export function buildCavernMap(): CavMap {
  const cells = new Map<string, string>();
  const stamps: CavStampIntent[] = [];

  // 1. Living rock everywhere — the cavern is carved OUT of solid stone.
  rect(cells, "terrain:cave-wall", 0, 0, CAV_W, CAV_H);

  // 2. Carve the chamber floor: one big irregular cavity, lobed so the walls
  //    read as natural rock rather than a drawn boundary.
  const floor = new Set<string>();
  blob(floor, 20, 12, 15, 101, 5, 0.2);
  blob(floor, 19, 26, 15, 102, 6, 0.22);
  blob(floor, 20, 40, 15.5, 103, 5, 0.2);
  blob(floor, 20, 51, 15, 104, 6, 0.22);
  blob(floor, 8, 33, 6, 105, 4, 0.26);
  blob(floor, 32, 33, 6, 106, 4, 0.26);
  fill(cells, floor, "terrain:cave-floor");

  // 3. Ash drifts pooling in the lee of the rock (interleaves with the floor).
  const ash = new Set<string>();
  blob(ash, 10, 45, 6.5, 201, 5, 0.3);
  blob(ash, 29, 47, 6, 202, 5, 0.3);
  blob(ash, 20, 34, 5.5, 203, 6, 0.28);
  blob(ash, 6, 22, 4, 204, 4, 0.3);
  blob(ash, 34, 22, 3.6, 205, 4, 0.3);
  for (const k of ash) if (cells.get(k) === "terrain:cave-floor") cells.set(k, "terrain:ash-drift");

  // 4. THE LAVA LAKE — the top chamber's molten heart, with a cooled crust
  //    scabbing its northern shore and rivers draining south.
  const lake = new Set<string>();
  blob(lake, 19, 10, 9.5, 301, 5, 0.26);
  blob(lake, 12, 8, 4.5, 302, 4, 0.3);
  blob(lake, 27, 9, 5, 303, 4, 0.3);
  const crust = new Set<string>();
  blob(crust, 19, 4.5, 5.5, 311, 5, 0.3);
  blob(crust, 25, 14, 3.2, 312, 4, 0.3);
  // Rivers: two channels draining the lake toward the lower chamber.
  const rivers = new Set<string>();
  thickLine(rivers, 14, 17, 11, 27, 1.1, 321, 1.1);
  thickLine(rivers, 24, 17, 28, 27, 1.0, 322, 1.1);
  thickLine(rivers, 11, 27, 14, 33, 0.8, 323, 0.9);
  // The bottom flow — a lava field along the cavern's southern lip.
  const bottom = new Set<string>();
  thickLine(bottom, 2, 55.5, 38, 55, 2.4, 331, 1.4);
  blob(bottom, 12, 55, 3.6, 332, 4, 0.3);
  blob(bottom, 28, 55.5, 3.2, 333, 4, 0.3);

  fill(cells, crust, "terrain:lava-crust");
  fill(cells, lake, "terrain:lava");
  fill(cells, rivers, "terrain:lava");
  fill(cells, bottom, "terrain:lava");

  // 5. Mineral clusters — gold flanking the lake, verdigris at the north wall.
  const gold = new Set<string>();
  blob(gold, 4.5, 7, 3.6, 401, 6, 0.34);
  blob(gold, 35, 5.5, 3.4, 402, 6, 0.34);
  blob(gold, 33, 30, 2.2, 403, 5, 0.34);
  fill(cells, gold, "terrain:crystal-gold");
  const teal = new Set<string>();
  blob(teal, 19, 2.6, 4.4, 411, 6, 0.32);
  blob(teal, 7, 38, 2.0, 412, 5, 0.34);
  fill(cells, teal, "terrain:crystal-verdigris");

  // 6. Four forge platforms over molten vents.
  forge(cells, 5, 15, 501);
  forge(cells, 35, 15, 502);
  forge(cells, 13, 24, 503);
  forge(cells, 29, 24, 504);

  // 7. The great hall — cobbled floor, DARK wall ring (the reference's hall is
  //    a black-stone structure, not a pale keep), a molten trough down its
  //    spine and lamps along both aisles.
  rect(cells, "terrain:stone-cobble", 11, 35, 10, 7);
  ringRect(cells, "terrain:wall-dark", 10, 34, 12, 9);
  rect(cells, "terrain:lava", 15, 36, 2, 5);
  for (let i = 0; i < 4; i++) {
    stamps.push({
      assetId: "objects:lamp",
      centerX: 13,
      centerY: 36.5 + i * 1.4,
      cellsW: 1,
      cellsH: 1,
    });
    stamps.push({
      assetId: "objects:lamp",
      centerX: 19,
      centerY: 36.5 + i * 1.4,
      cellsW: 1,
      cellsH: 1,
    });
  }

  // 8. Workshop cellars — small timber rooms around the lower chamber.
  const rooms: [number, number, number, number][] = [
    [4, 45, 5, 4],
    [11, 49, 4, 3],
    [24, 44, 4, 3],
    [30, 51, 5, 3],
  ];
  for (const [x, y, w, h] of rooms) {
    rect(cells, "terrain:wood-grey", x, y, w, h);
    ringRect(cells, "terrain:wall-timber", x - 1, y - 1, w + 2, h + 2);
    stamps.push({ assetId: "objects:crate", centerX: x + 1, centerY: y + 1, cellsW: 1, cellsH: 1 });
    stamps.push({
      assetId: "objects:table",
      centerX: x + w - 1.5,
      centerY: y + h - 1.5,
      cellsW: 2,
      cellsH: 1,
    });
  }

  // 9. Boulder scatter + scorch marks — deterministic, biased toward the rock
  //    edges and the lava shores.
  for (let i = 0; i < 46; i++) {
    const gx = 2 + hash2(i, 11, 61) * (CAV_W - 4);
    const gy = 2 + hash2(i, 23, 67) * (CAV_H - 4);
    const here = cells.get(key(Math.floor(gx), Math.floor(gy)));
    if (here === "terrain:cave-floor" || here === "terrain:ash-drift") {
      // Pass 1's 1-cell menhirs vanished at map zoom — the reference's
      // boulders are chunky, and their size varies. Pass 2: the bundled
      // menhir is a PALE standing stone, which read as light blobs on dark
      // rock; tinted to basalt it becomes a volcanic boulder.
      const size = 1.4 + hash2(i, 53, 79) * 1.1;
      const dark = hash2(i, 67, 83) < 0.5 ? "#2f2830" : "#3a3139";
      stamps.push({
        assetId: "objects:menhir",
        centerX: gx,
        centerY: gy,
        cellsW: size,
        cellsH: size,
        tint: dark,
      });
    }
  }
  for (let i = 0; i < 22; i++) {
    const gx = 3 + hash2(i, 31, 71) * (CAV_W - 6);
    const gy = 3 + hash2(i, 41, 73) * (CAV_H - 6);
    const here = cells.get(key(Math.floor(gx), Math.floor(gy)));
    if (here === "terrain:cave-floor" || here === "terrain:ash-drift") {
      stamps.push({ assetId: "decal:scorch", centerX: gx, centerY: gy, cellsW: 2, cellsH: 2 });
    }
  }

  return { width: CAV_W, height: CAV_H, cells, stamps };
}
