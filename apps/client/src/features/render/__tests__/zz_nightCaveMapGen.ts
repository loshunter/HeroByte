// TEMPORARY benchmark fixture generator — the NIGHT FLOODED CAVE study map
// (smugglers' lagoon in a sea cave). Composed only from our own families, and
// unlike the previous two studies this one is LIT: it emits lantern positions
// alongside cells and stamps, so the harness can run the ambient veil + 3-stop
// pools + night grade the way the live table does.
//
// Deterministic: no Math.random, every jitter is hash2-seeded.

import { hash2 } from "../valueNoise";

export const CAVE_W = 46;
export const CAVE_H = 46;

export interface CaveStampIntent {
  assetId: string;
  centerX: number;
  centerY: number;
  cellsW: number;
  cellsH: number;
  tint?: string;
}

/** A lantern/brazier: world position comes from the cell centre, radius in cells. */
export interface CaveLightIntent {
  cellX: number;
  cellY: number;
  radiusCells: number;
  color: string;
  intensity: number;
  /** Overdrive so the pool climbs ABOVE the unlit ground (see BakeLight.gain).
   * Without it a lantern only cancels the veil and reads as "less dark". */
  gain: number;
}

export interface CaveMap {
  width: number;
  height: number;
  cells: Map<string, string>;
  stamps: CaveStampIntent[];
  lights: CaveLightIntent[];
}

const key = (x: number, y: number) => `${x},${y}`;
const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < CAVE_W && y < CAVE_H;

// prettier-ignore
function blob(set: Set<string>, cx: number, cy: number, baseR: number, seed: number, lobes = 5, amp = 0.26): void {
  const p1 = hash2(1, seed, 7) * Math.PI * 2;
  const p2 = hash2(2, seed, 7) * Math.PI * 2;
  for (let y = Math.floor(cy - baseR * 1.7); y <= Math.ceil(cy + baseR * 1.7); y++) {
    for (let x = Math.floor(cx - baseR * 1.7); x <= Math.ceil(cx + baseR * 1.7); x++) {
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

/** Painted hulls — the reference's fleet is red, green, blue and white. */
const HULLS = ["#a8332c", "#2f6f43", "#2b5f96", "#d8d3c6", "#8a6b2f"];

export function buildNightCaveMap(): CaveMap {
  const cells = new Map<string, string>();
  const stamps: CaveStampIntent[] = [];
  const lights: CaveLightIntent[] = [];

  // 1. Solid rock, then flood the whole cavern with cave water.
  rect(cells, "terrain:cave-wall", 0, 0, CAVE_W, CAVE_H);
  const lagoon = new Set<string>();
  blob(lagoon, 23, 20, 19, 101, 5, 0.16);
  blob(lagoon, 14, 34, 11, 102, 5, 0.2);
  blob(lagoon, 33, 33, 10, 103, 5, 0.2);
  fill(cells, lagoon, "terrain:water");

  // 2. The sand bar — the warm dry floor the lanterns stand on. One big
  //    irregular mass through the middle, which the water then bites into.
  const sand = new Set<string>();
  blob(sand, 21, 11, 9.5, 201, 5, 0.22);
  blob(sand, 22, 20, 10, 202, 6, 0.2);
  blob(sand, 15, 26, 6.5, 203, 5, 0.24);
  blob(sand, 28, 27, 6, 204, 5, 0.24);
  blob(sand, 11, 17, 5, 205, 4, 0.26);
  blob(sand, 33, 16, 5.5, 206, 4, 0.26);
  for (const k of sand) if (cells.get(k) === "terrain:water") cells.set(k, "terrain:sand");

  // 3. Water bites back: channels and tarns cut through the sand, so the floor
  //    reads as a braided bar rather than one island.
  const channels = new Set<string>();
  thickLine(channels, 8, 6, 20, 15, 1.3, 301, 1.2);
  thickLine(channels, 38, 8, 26, 17, 1.2, 302, 1.2);
  thickLine(channels, 24, 24, 34, 30, 1.4, 303, 1.3);
  thickLine(channels, 18, 24, 12, 33, 1.2, 304, 1.2);
  blob(channels, 21, 6, 3.2, 305, 4, 0.3);
  blob(channels, 27, 22, 3.6, 306, 5, 0.3);
  blob(channels, 18, 31, 3.0, 307, 4, 0.3);
  blob(channels, 12, 21, 2.4, 308, 4, 0.3);
  for (const k of channels) if (cells.get(k) === "terrain:sand") cells.set(k, "terrain:water");

  // 4. The two black side chambers — the ABYSS body, kept separate from the
  //    lagoon so each keeps its own bathymetry.
  const abyss = new Set<string>();
  blob(abyss, 7, 38, 6.5, 401, 5, 0.24);
  blob(abyss, 39, 39, 5.5, 402, 5, 0.24);
  fill(cells, abyss, "terrain:abyss-water");
  // Glowing algae in the western tarn.
  const glow = new Set<string>();
  blob(glow, 5, 41, 2.4, 411, 4, 0.3);
  fill(cells, glow, "terrain:biolume");
  lights.push({
    cellX: 5,
    cellY: 41,
    radiusCells: 4.5,
    color: "#5fe0aa",
    intensity: 0.55,
    gain: 0.16,
  });

  // 5. Plank docks over the water at the landings.
  const docks: [number, number, number, number][] = [
    [17, 8, 5, 1],
    [26, 15, 1, 4],
    [13, 24, 4, 1],
    [24, 31, 1, 4],
    [30, 25, 4, 1],
  ];
  for (const [x, y, w, h] of docks) rect(cells, "terrain:bridge-plank", x, y, w, h);

  // 6. Lanterns along the shoreline: any sand cell that touches water. Sampled
  //    on a coarse stride so pools spread instead of merging into daylight.
  const shore: [number, number][] = [];
  for (const [k, family] of cells) {
    if (family !== "terrain:sand") continue;
    const [x, y] = k.split(",").map(Number) as [number, number];
    const wet =
      cells.get(key(x + 1, y)) === "terrain:water" ||
      cells.get(key(x - 1, y)) === "terrain:water" ||
      cells.get(key(x, y + 1)) === "terrain:water" ||
      cells.get(key(x, y - 1)) === "terrain:water";
    if (wet) shore.push([x, y]);
  }
  shore.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  let placed = 0;
  for (let i = 0; i < shore.length; i += 1) {
    const [x, y] = shore[i]!;
    // Lanterns must stay DISCRETE. A pool washes to 2.75x its radius
    // (WASH_REACH), so a 2-cell lamp already touches 5 cells out — pass 1 used
    // radius 3-4 with 4.5-cell spacing and the pools merged into one warm sheet
    // across the whole bar. Small radii, wide spacing.
    if (lights.some((l) => Math.hypot(l.cellX - x, l.cellY - y) < 7)) continue;
    lights.push({
      cellX: x + 0.5,
      cellY: y + 0.5,
      radiusCells: 1.5 + hash2(i, 3, 71) * 0.5,
      color: hash2(i, 5, 73) < 0.5 ? "#ffb765" : "#ffa23f",
      intensity: 0.9 + hash2(i, 7, 79) * 0.1,
      // Enough overdrive that the sand inside the pool goes warm gold while the
      // shore a few cells out stays cold blue — the reference's whole mood.
      gain: 0.26 + hash2(i, 9, 89) * 0.08,
    });
    placed += 1;
    if (placed >= 18) break;
  }

  // 7. The fleet — beached boats along the shore, painted hulls.
  const berths: [number, number][] = [
    [16, 6],
    [19, 5],
    [12, 15],
    [10, 19],
    [34, 12],
    [36, 15],
    [25, 19],
    [14, 28],
    [30, 29],
    [22, 34],
    [8, 24],
    [31, 21],
  ];
  berths.forEach(([x, y], i) => {
    stamps.push({
      assetId: "objects:boat",
      centerX: x,
      centerY: y,
      cellsW: 1.6,
      cellsH: 2.4,
      tint: HULLS[i % HULLS.length],
    });
  });

  // 8. Cargo: crate piles and tables (the trestles of a smugglers' camp), only
  //    on dry sand.
  for (let i = 0; i < 34; i += 1) {
    const gx = 3 + hash2(i, 11, 61) * (CAVE_W - 6);
    const gy = 3 + hash2(i, 23, 67) * (CAVE_H - 6);
    if (cells.get(key(Math.floor(gx), Math.floor(gy))) !== "terrain:sand") continue;
    const crate = hash2(i, 29, 83) < 0.65;
    stamps.push({
      assetId: crate ? "objects:crate" : "objects:table",
      centerX: gx,
      centerY: gy,
      cellsW: crate ? 1.1 : 2,
      cellsH: crate ? 1.1 : 1,
    });
  }

  // 9. Wet-rock wear where the water laps the sand.
  for (let i = 0; i < 18; i += 1) {
    const gx = 4 + hash2(i, 31, 91) * (CAVE_W - 8);
    const gy = 4 + hash2(i, 41, 97) * (CAVE_H - 8);
    if (cells.get(key(Math.floor(gx), Math.floor(gy))) !== "terrain:sand") continue;
    stamps.push({ assetId: "decal:wear-ring", centerX: gx, centerY: gy, cellsW: 2, cellsH: 2 });
  }

  return { width: CAVE_W, height: CAVE_H, cells, stamps, lights };
}
