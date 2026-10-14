// ============================================================================
// TOKEN CREATOR — BACKDROP (pure)
// ============================================================================
// What fills the square behind the picture: transparent art, and the margin a
// zoomed-out picture leaves. Baked into the picture (the map draws no
// backdrop of its own).
//
// The AUTO rule: the mean colour of the picture's outermost ring of pixels
// that is mostly opaque. Rings are read from the edge inward, up to a quarter
// of the way in; a ring counts when at least 5% of it (and at least 8 pixels)
// is ≥ 50% opaque, and only those pixels are averaged. A picture whose edges
// are opaque (a photo) gets its own edge colour, so a zoom-out margin reads as
// more of the picture; a cut-out figure gets the colour where its silhouette
// first meets the edge. Nothing opaque found: AUTO_FALLBACK.

export type Backdrop =
  | { kind: "none" }
  | { kind: "solid"; color: string }
  | { kind: "auto" }
  | { kind: "gradient"; from: string; to: string };

/** What actually gets painted: auto resolved to a colour. */
export type BackdropFill =
  | { kind: "none" }
  | { kind: "solid"; color: string }
  | { kind: "gradient"; from: string; to: string };

/** The table's dark parchment: a neutral behind art with no opaque edge. */
export const AUTO_FALLBACK = "#2a2622";

/** The side of the sample the auto rule reads (the picture scaled to fit). */
export const AUTO_SAMPLE_EDGE = 64;

const OPAQUE = 128;

function hex(value: number): string {
  return Math.round(Math.min(255, Math.max(0, value)))
    .toString(16)
    .padStart(2, "0");
}

export function rgbHex(r: number, g: number, b: number): string {
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** The auto colour from RGBA pixels (row-major, 4 bytes a pixel). */
export function autoBackdropColor(data: ArrayLike<number>, width: number, height: number): string {
  const depth = Math.floor(Math.min(width, height) / 4);
  for (let ring = 0; ring <= depth; ring += 1) {
    const left = ring;
    const top = ring;
    const right = width - 1 - ring;
    const bottom = height - 1 - ring;
    if (right < left || bottom < top) break;
    let r = 0;
    let g = 0;
    let b = 0;
    let opaque = 0;
    let total = 0;
    const read = (x: number, y: number) => {
      const i = (y * width + x) * 4;
      total += 1;
      if ((data[i + 3] ?? 0) < OPAQUE) return;
      r += data[i] ?? 0;
      g += data[i + 1] ?? 0;
      b += data[i + 2] ?? 0;
      opaque += 1;
    };
    for (let x = left; x <= right; x += 1) {
      read(x, top);
      if (bottom !== top) read(x, bottom);
    }
    for (let y = top + 1; y < bottom; y += 1) {
      read(left, y);
      if (right !== left) read(right, y);
    }
    if (opaque >= 8 && opaque >= total * 0.05) {
      return rgbHex(r / opaque, g / opaque, b / opaque);
    }
  }
  return AUTO_FALLBACK;
}

function parseHex(color: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return null;
  const n = Number.parseInt(match[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mix a #rrggbb colour toward white (amount > 0) or black (amount < 0). */
export function shade(color: string, amount: number): string {
  const rgb = parseHex(color);
  if (!rgb) return color;
  const target = amount > 0 ? 255 : 0;
  const t = Math.min(1, Math.abs(amount));
  const [r, g, b] = rgb.map((c) => c + (target - c) * t) as [number, number, number];
  return rgbHex(r, g, b);
}

/** A gradient's starting pair, from the auto colour: lit top, shaded foot. */
export function defaultGradient(autoColor: string): { from: string; to: string } {
  return { from: shade(autoColor, 0.25), to: shade(autoColor, -0.35) };
}

export function resolveBackdrop(backdrop: Backdrop, autoColor: string): BackdropFill {
  return backdrop.kind === "auto" ? { kind: "solid", color: autoColor } : backdrop;
}

/** The fill as a CSS background (the crop area and preview tiles). */
export function cssBackground(fill: BackdropFill): string {
  if (fill.kind === "solid") return fill.color;
  if (fill.kind === "gradient") return `linear-gradient(180deg, ${fill.from}, ${fill.to})`;
  return "transparent";
}
