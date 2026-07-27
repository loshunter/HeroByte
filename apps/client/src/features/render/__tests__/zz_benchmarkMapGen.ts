// TEMPORARY benchmark fixture — geometry generator for the island grammar
// study (internal recreation of a Czepeku-style coastal reference, dev-only).
// Deterministic: seeded hashes, no Date/Math.random. Produces a cell→family
// assignment plus decal-stamp intents; zz_benchmarkMapDoc assembles the
// MapDocument. Never committed to starter content.

export const BENCH_W = 44;
export const BENCH_H = 56;

export interface BenchStampIntent {
  assetId: string;
  /** stamp CENTRE in cell coords */
  centerX: number;
  centerY: number;
  /** footprint in cells */
  cellsW: number;
  cellsH: number;
}

export interface BenchMap {
  width: number;
  height: number;
  /** cell "x,y" -> terrain asset id */
  cells: Map<string, string>;
  stamps: BenchStampIntent[];
}

function hash2(x: number, y: number, seed: number): number {
  let h = (seed ^ (x * 0x9e3779b1) ^ (y * 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const key = (x: number, y: number) => `${x},${y}`;
const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < BENCH_W && y < BENCH_H;

/** Organic blob: radial-noise disc (silhouette frequency = lobes). */
function blob(set: Set<string>, cx: number, cy: number, baseR: number, seed: number, lobes = 5, amp = 0.22): void {
  const p1 = hash2(1, seed, 7) * Math.PI * 2;
  const p2 = hash2(2, seed, 7) * Math.PI * 2;
  for (let y = Math.floor(cy - baseR * 1.5); y <= Math.ceil(cy + baseR * 1.5); y++) {
    for (let x = Math.floor(cx - baseR * 1.5); x <= Math.ceil(cx + baseR * 1.5); x++) {
      if (!inBounds(x, y)) continue;
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const th = Math.atan2(dy, dx);
      const r = baseR * (1 + amp * Math.sin(lobes * th + p1) + amp * 0.6 * Math.sin((lobes + 3) * th + p2));
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
function thickLine(
  set: Set<string>,
  x0: number, y0: number, x1: number, y1: number,
  halfW: number, seed: number, wobble: number,
): void {
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

/** Ring of separated single cells (standing stones / field-wall posts).
 * Posts land only on plain grass — never in water, on cliffs, or on paths. */
function postRing(
  cells: Map<string, string>,
  cx: number, cy: number, r: number, count: number, seed: number,
  family: string, skipArcs: ReadonlyArray<readonly [number, number]> = [],
): void {
  for (let i = 0; i < count; i++) {
    const th = (i / count) * Math.PI * 2;
    const deg = ((th * 180) / Math.PI + 360) % 360;
    if (skipArcs.some(([a, b]) => (a <= b ? deg >= a && deg <= b : deg >= a || deg <= b))) continue;
    const jr = r * (1 + (hash2(i, 0, seed) - 0.5) * 0.12);
    const x = Math.round(cx + Math.cos(th) * jr - 0.5);
    const y = Math.round(cy + Math.sin(th) * jr - 0.5);
    if (inBounds(x, y) && cells.get(key(x, y)) === "terrain:grass") cells.set(key(x, y), family);
  }
}

/** Connected low-wall arc (degrees, 0=E, 90=S); writes only over grass so
 * path mouths and buildings break it into natural gaps. */
function arcWall(
  cells: Map<string, string>,
  cx: number, cy: number, r: number,
  degStart: number, degEnd: number, family: string,
): void {
  const steps = Math.ceil((degEnd - degStart) / 3);
  for (let i = 0; i <= steps; i++) {
    const th = ((degStart + ((degEnd - degStart) * i) / steps) * Math.PI) / 180;
    const x = Math.round(cx + Math.cos(th) * r - 0.5);
    const y = Math.round(cy + Math.sin(th) * r - 0.5);
    if (inBounds(x, y) && cells.get(key(x, y)) === "terrain:grass") cells.set(key(x, y), family);
  }
}

function fillFamily(cells: Map<string, string>, set: Set<string>, family: string): void {
  for (const k of set) cells.set(k, family);
}

function stampRect(cells: Map<string, string>, family: string, x0: number, y0: number, w: number, h: number): void {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) if (inBounds(x, y)) cells.set(key(x, y), family);
}

export function buildBenchmarkMap(): BenchMap {
  const cells = new Map<string, string>();

  // 1. ocean everywhere
  for (let y = 0; y < BENCH_H; y++) for (let x = 0; x < BENCH_W; x++) cells.set(key(x, y), "terrain:water");

  // 2. landmasses
  const main = new Set<string>();
  blob(main, 22, 15, 11, 101, 5, 0.2);
  blob(main, 30, 9, 5.5, 102, 4, 0.22);
  blob(main, 13, 23, 5, 103, 5, 0.24);
  blob(main, 9, 27, 3.6, 104, 4, 0.24);
  blob(main, 25, 28, 4, 105, 4, 0.2);

  const midIslet = new Set<string>();
  blob(midIslet, 29, 34, 2.4, 111, 4, 0.25);

  const seIsland = new Set<string>();
  blob(seIsland, 33, 45, 6.5, 121, 5, 0.2);
  blob(seIsland, 37, 49, 4.5, 122, 4, 0.22);
  blob(seIsland, 31, 41, 2.8, 123, 4, 0.22);

  const swLand = new Set<string>();
  blob(swLand, 5, 48, 8, 131, 5, 0.2);
  blob(swLand, 13, 51, 5.5, 132, 4, 0.22);

  const land = new Set<string>([...main, ...midIslet, ...seIsland, ...swLand]);
  fillFamily(cells, land, "terrain:grass");

  // 3. cliff ring: land cells touching in-frame water; off-frame counts as land
  const coast = new Set<string>();
  for (const k of land) {
    const [x, y] = k.split(",").map(Number) as [number, number];
    let touchesWater = false;
    for (let dy = -1; dy <= 1 && !touchesWater; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (inBounds(nx, ny) && !land.has(key(nx, ny))) {
          touchesWater = true;
          break;
        }
      }
    if (touchesWater) coast.add(k);
  }
  // single-row ring: two rows read as fortress ramparts, not rock (pass 1 note)
  fillFamily(cells, coast, "terrain:cliff");

  // 4. dirt path web + clearings
  const paths = new Set<string>();
  disc(paths, 21, 18, 3.2);
  thickLine(paths, 21, 18, 20, 12, 1.1, 21, 0.8);
  thickLine(paths, 21, 18, 13, 13, 1.0, 22, 0.9);
  thickLine(paths, 21, 18, 11, 7, 0.9, 23, 1.0);
  thickLine(paths, 21, 18, 22, 25, 1.0, 24, 0.8);
  thickLine(paths, 22, 25, 26, 30, 0.9, 25, 0.8);
  thickLine(paths, 13, 23, 10, 27, 0.8, 26, 0.9);
  thickLine(paths, 31, 41, 33, 45, 1.0, 27, 0.8);
  thickLine(paths, 33, 45, 37, 48, 0.9, 28, 0.8);
  thickLine(paths, 33, 45, 27, 47, 0.9, 29, 0.8);
  thickLine(paths, 16, 49, 8, 48, 0.9, 30, 0.9);
  thickLine(paths, 8, 48, 6, 51, 0.8, 31, 0.8);
  // Paths and clearings are warm SAND (the reference's dominant ground read);
  // sand↔grass interleave gives the hand-painted seam for free.
  for (const k of paths) if (cells.get(k) === "terrain:grass") cells.set(k, "terrain:sand");
  // Tilled ground stays dirt (pairs with grass): peninsula patch + firepit yard.
  const tilled = new Set<string>();
  blob(tilled, 12, 22, 2.0, 161, 4, 0.3);
  blob(tilled, 30, 44, 1.5, 162, 4, 0.3);
  for (const k of tilled)
    if (cells.get(k) === "terrain:grass" || cells.get(k) === "terrain:sand")
      cells.set(k, "terrain:dirt");

  // 5. farm plots (SE island): the furrow family draws its own sub-cell
  // ridge rows and crop ticks — plots are plain rects of one family now.
  for (const [px, py, pw, ph] of [[35, 41, 4, 3], [35, 45, 4, 3]] as const) {
    for (let y = py; y < py + ph; y++)
      for (let x = px; x < px + pw; x++) {
        const k = key(x, y);
        if (!seIsland.has(k) || cells.get(k) === "terrain:cliff") continue;
        cells.set(k, "terrain:farm-furrow");
      }
  }

  // 6. buildings
  stampRect(cells, "terrain:roof-thatch", 11, 9, 4, 7); // longhouse
  const roundhouse = new Set<string>();
  disc(roundhouse, 20.5, 9.5, 4.2); // hero silhouette
  fillFamily(cells, roundhouse, "terrain:roof-thatch-spiral");
  cells.set(key(20, 13), "terrain:wood-floor"); // porch step at the S door
  const dais = new Set<string>();
  disc(dais, 22.5, 25.5, 2.6);
  fillFamily(cells, dais, "terrain:dais-stone");
  // SW landmass web circle: dais ring courses (closer to the reference's pale
  // radial web than the gold medallion mosaic)
  const swCircle = new Set<string>();
  disc(swCircle, 4.5, 47, 2.2);
  for (const k of swCircle)
    if (cells.get(k) === "terrain:grass" || cells.get(k) === "terrain:dirt")
      cells.set(k, "terrain:dais-stone");

  // 7. stone features (the stone circle itself is menhir STAMPS now — see
  // the stamps list below)
  // broken compound wall over the N side of the roundhouse plateau
  arcWall(cells, 20.5, 9.5, 7.2, 150, 395, "terrain:wall-stone");
  for (const [x, y] of [[25, 30], [26, 30], [26, 31]] as const) cells.set(key(x, y), "terrain:wall-stone");
  for (const [x, y] of [[29, 42], [30, 42], [31, 42], [29, 43], [29, 44]] as const)
    cells.set(key(x, y), "terrain:wall-stone");
  for (const [x, y] of [[11, 46], [12, 46], [13, 46], [11, 47]] as const)
    cells.set(key(x, y), "terrain:wall-stone");
  cells.set(key(15, 50), "terrain:wall-stone");
  // drowned architecture just offshore of the SE ruin
  for (const [x, y] of [[27, 38], [28, 38], [28, 37], [26, 39]] as const)
    if (cells.get(key(x, y)) === "terrain:water") cells.set(key(x, y), "terrain:sunken-flagstone");

  // 8. crossings — slender plank ribbons (the log-rib bridge deck family)
  stampRect(cells, "terrain:bridge-plank", 27, 31, 1, 3); // bridge 1
  stampRect(cells, "terrain:bridge-plank", 29, 36, 1, 3); // bridge 2
  cells.set(key(27, 30), "terrain:stairs-stone");
  cells.set(key(29, 39), "terrain:stairs-stone");
  stampRect(cells, "terrain:stone-cobble", 18, 49, 9, 2); // causeway

  // 9. rock islets (foam halos come free from the water BFS)
  for (const [cx, cy, r] of [
    [4, 12, 1.2], [39, 8, 1.4], [41, 16, 1.8], [20, 36, 1.0],
    [10, 37, 1.3], [39, 33, 1.0], [22, 47, 0.9], [3, 33, 1.1],
  ] as const) {
    const s = new Set<string>();
    disc(s, cx, cy, r);
    fillFamily(cells, s, "terrain:cliff");
  }
  cells.set(key(41, 16), "terrain:grass"); // tuft on the biggest islet

  // 10. canopy on top
  const trees = new Set<string>();
  blob(trees, 28, 12, 2.2, 141, 4, 0.3);
  blob(trees, 31, 15, 1.8, 142, 4, 0.3);
  blob(trees, 25, 6, 1.6, 143, 4, 0.3);
  blob(trees, 29, 33, 1.3, 144, 4, 0.3);
  blob(trees, 30, 39, 1.5, 145, 4, 0.3);
  blob(trees, 27, 43, 1.3, 146, 4, 0.3);
  blob(trees, 3, 44, 1.6, 147, 4, 0.3);
  for (const k of trees) if (land.has(k)) cells.set(k, "terrain:canopy");
  const garden = new Set<string>();
  blob(garden, 26, 8, 1.5, 151, 4, 0.35);
  blob(garden, 28, 7, 1.2, 152, 4, 0.35);
  for (const k of garden) if (main.has(k)) cells.set(k, "terrain:canopy-blossom");

  const stamps: BenchStampIntent[] = [
    { assetId: "inlay:sun-medallion", centerX: 33, centerY: 46.5, cellsW: 6, cellsH: 6 },
    { assetId: "inlay:ceremony-stain", centerX: 20.5, centerY: 21, cellsW: 6, cellsH: 6 },
    { assetId: "decal:wear-ring", centerX: 20.5, centerY: 17.5, cellsW: 3, cellsH: 3 },
    { assetId: "decal:scorch", centerX: 31, centerY: 44, cellsW: 3, cellsH: 3 },
    // rowboats riding the channels
    { assetId: "objects:boat", centerX: 5.5, centerY: 21.5, cellsW: 1, cellsH: 2 },
    { assetId: "objects:boat", centerX: 20, centerY: 33.5, cellsW: 1, cellsH: 2 },
  ];
  // the stone circle: a ring of menhir stamps on the peninsula neck
  for (let i = 0; i < 7; i += 1) {
    const th = (i / 7) * Math.PI * 2;
    const jr = 2.1 * (1 + (hash2(i, 1, 63) - 0.5) * 0.15);
    stamps.push({
      assetId: "objects:menhir",
      centerX: 8.5 + Math.cos(th) * jr,
      centerY: 20.5 + Math.sin(th) * jr,
      cellsW: 0.8,
      cellsH: 1.1,
    });
  }
  // lone menhirs on the SW landmass
  stamps.push({ assetId: "objects:menhir", centerX: 10.5, centerY: 44.5, cellsW: 0.8, cellsH: 1.2 });
  stamps.push({ assetId: "objects:menhir", centerX: 15.2, centerY: 50.2, cellsW: 0.7, cellsH: 1 });
  // gull flecks over open water
  for (const [gx, gy] of [
    [8, 10], [14, 5], [35, 12], [40, 25], [6, 36], [24, 38], [16, 44], [38, 36], [28, 20],
  ] as const) {
    stamps.push({ assetId: "objects:gull", centerX: gx, centerY: gy, cellsW: 0.5, cellsH: 0.5 });
  }

  return { width: BENCH_W, height: BENCH_H, cells, stamps };
}
