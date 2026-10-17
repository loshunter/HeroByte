// ============================================================================
// FRAME RASTER — polygons into an RGBA buffer, no canvas (C5a)
// ============================================================================
// The bake runs where there is no 2D canvas (a worker without one, Node for
// the contact sheet and the tests), so it fills its own polygons: an even-odd
// scanline fill with four sub-rows per pixel and exact coverage along each
// sub-row, composited "over" into premultiplied floats, then handed out as
// ordinary straight-alpha bytes (what ImageData and PNG both want).

const SUB_ROWS = 4;

export interface Raster {
  size: number;
  /** Premultiplied RGBA, 0–1, row-major. */
  data: Float32Array;
  /** Scratch: one row of coverage, and the crossings of one sub-row. */
  coverage: Float32Array;
  crossings: number[];
  /** Scratch for one polygon's edges (grown on demand, reused for every polygon). */
  edges: EdgeScratch;
}

interface EdgeScratch {
  tops: Float64Array;
  bottoms: Float64Array;
  xs: Float64Array;
  slopes: Float64Array;
  order: Int32Array;
  active: number[];
}

function edgeScratch(capacity: number): EdgeScratch {
  return {
    tops: new Float64Array(capacity),
    bottoms: new Float64Array(capacity),
    xs: new Float64Array(capacity),
    slopes: new Float64Array(capacity),
    order: new Int32Array(capacity),
    active: [],
  };
}

export function createRaster(size: number): Raster {
  return {
    size,
    data: new Float32Array(size * size * 4),
    coverage: new Float32Array(size + 1),
    crossings: [],
    edges: edgeScratch(64),
  };
}

function addSpan(coverage: Float32Array, size: number, from: number, to: number, weight: number) {
  const a = Math.max(0, Math.min(size, from));
  const b = Math.max(0, Math.min(size, to));
  if (b <= a) return;
  const first = Math.floor(a);
  const last = Math.floor(b);
  if (first === last) {
    coverage[first]! += (b - a) * weight;
    return;
  }
  coverage[first]! += (first + 1 - a) * weight;
  for (let column = first + 1; column < last; column += 1) coverage[column]! += weight;
  if (last < size) coverage[last]! += (b - last) * weight;
}

/** Fills a polygon (flat [x0, y0, …] in pixels) with one sRGB colour at `alpha`. */
export function fillPolygon(
  raster: Raster,
  points: readonly number[],
  color: { r: number; g: number; b: number },
  alpha = 1,
): void {
  const { size, data, coverage, crossings } = raster;
  const count = points.length / 2;
  if (count < 3 || alpha <= 0) return;
  let minY = Infinity;
  let maxY = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  for (let index = 0; index < count; index += 1) {
    const x = points[index * 2]!;
    const y = points[index * 2 + 1]!;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  const rowFrom = Math.max(0, Math.floor(minY));
  const rowTo = Math.min(size - 1, Math.ceil(maxY));
  const columnFrom = Math.max(0, Math.floor(minX));
  const columnTo = Math.min(size - 1, Math.ceil(maxX));
  if (rowFrom > rowTo || columnFrom > columnTo) return;
  // Edges by their top, each with its x at the top and its slope: a sub-row
  // tests only the edges that cross it (an active list), not every edge of
  // the polygon, so a long ring of hundreds of edges costs a few per row.
  if (raster.edges.tops.length < count) raster.edges = edgeScratch(count * 2);
  const { tops, bottoms, xs, slopes, order, active } = raster.edges;
  active.length = 0;
  let edges = 0;
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    const y0 = points[index * 2 + 1]!;
    const y1 = points[next * 2 + 1]!;
    if (y0 === y1) continue;
    const x0 = points[index * 2]!;
    const x1 = points[next * 2]!;
    const down = y0 < y1;
    tops[edges] = down ? y0 : y1;
    bottoms[edges] = down ? y1 : y0;
    xs[edges] = down ? x0 : x1;
    slopes[edges] = (x1 - x0) / (y1 - y0);
    edges += 1;
  }
  // By top, an insertion sort over the typed scratch (polygons are small or nearly sorted).
  for (let index = 0; index < edges; index += 1) {
    let at = index;
    while (at > 0 && tops[order[at - 1]!]! > tops[index]!) {
      order[at] = order[at - 1]!;
      at -= 1;
    }
    order[at] = index;
  }
  let waiting = 0;
  const weight = 1 / SUB_ROWS;
  for (let row = rowFrom; row <= rowTo; row += 1) {
    coverage.fill(0, columnFrom, columnTo + 2);
    let any = false;
    for (let sub = 0; sub < SUB_ROWS; sub += 1) {
      const y = row + (sub + 0.5) / SUB_ROWS;
      while (waiting < edges && tops[order[waiting]!]! <= y) active.push(order[waiting++]!);
      crossings.length = 0;
      let kept = 0;
      for (const edge of active) {
        if (bottoms[edge]! <= y) continue; // finished above this sub-row
        active[kept++] = edge;
        crossings.push(xs[edge]! + (y - tops[edge]!) * slopes[edge]!);
      }
      active.length = kept;
      if (crossings.length < 2) continue;
      crossings.sort((first, second) => first - second);
      for (let pair = 0; pair + 1 < crossings.length; pair += 2) {
        addSpan(coverage, size, crossings[pair]!, crossings[pair + 1]!, weight);
        any = true;
      }
    }
    if (!any) continue;
    for (let column = columnFrom; column <= columnTo; column += 1) {
      const cover = Math.min(1, coverage[column]!) * alpha;
      if (cover <= 0) continue;
      const at = (row * size + column) * 4;
      const keep = 1 - cover;
      data[at] = color.r * cover + data[at]! * keep;
      data[at + 1] = color.g * cover + data[at + 1]! * keep;
      data[at + 2] = color.b * cover + data[at + 2]! * keep;
      data[at + 3] = cover + data[at + 3]! * keep;
    }
  }
}

/** Straight-alpha bytes, ready for ImageData or a PNG. */
export function rasterToRgba(raster: Raster): Uint8ClampedArray {
  const { data } = raster;
  const out = new Uint8ClampedArray(data.length);
  for (let at = 0; at < data.length; at += 4) {
    const alpha = data[at + 3]!;
    if (alpha <= 0) continue;
    out[at] = Math.round((data[at]! / alpha) * 255);
    out[at + 1] = Math.round((data[at + 1]! / alpha) * 255);
    out[at + 2] = Math.round((data[at + 2]! / alpha) * 255);
    out[at + 3] = Math.round(alpha * 255);
  }
  return out;
}
