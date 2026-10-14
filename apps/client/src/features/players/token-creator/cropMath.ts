// ============================================================================
// TOKEN CREATOR — CROP MATH (pure)
// ============================================================================
// Where the picture sits inside the token's square, in units of that square
// ("box edges"), so the crop is the same at the 280 px crop area, the 48 px
// preview tiles and the 512 px bake. One plan drives all three: the canvas
// bake and the CSS preview both read `placementFor`, so what the player
// framed is what gets baked.
//
// Screen order, outermost first: move to the box centre plus the offset,
// mirror horizontally (flip), turn by quarter turns, draw the picture centred.
// The flip sits OUTSIDE the turn so it always mirrors left↔right on screen,
// whatever the turn; `rotateClockwise` counts the other way while flipped so
// the button always turns clockwise on screen.

export type QuarterTurn = 0 | 1 | 2 | 3;

export interface Size {
  width: number;
  height: number;
}

export interface CropState {
  /** 1 = the picture just covers the square (its shorter side fits). */
  zoom: number;
  /** Picture centre minus box centre, in box edges (+x right, +y down). */
  x: number;
  y: number;
  /** Clockwise quarter turns in picture space (see the flip note above). */
  turn: QuarterTurn;
  /** Mirrored left↔right on screen. */
  flip: boolean;
}

/** Zoom ceiling: an 8× crop of a 512 px source is already 64 px of picture. */
export const ZOOM_MAX = 8;
/** Zoom floor, as a fraction of "fit the whole picture": room for a backdrop. */
export const ZOOM_OUT_FACTOR = 0.5;

export const DEFAULT_CROP: CropState = { zoom: 1, x: 0, y: 0, turn: 0, flip: false };

/** The picture's size once turned (a quarter turn swaps the sides). */
export function orientedSize(source: Size, turn: QuarterTurn): Size {
  return turn % 2 === 1 ? { width: source.height, height: source.width } : source;
}

/** The smallest zoom: half the size at which the whole picture fits. */
export function minZoom(source: Size): number {
  const short = Math.min(source.width, source.height);
  const long = Math.max(source.width, source.height);
  return (short / long) * ZOOM_OUT_FACTOR;
}

/** The turned picture's size on screen, in box edges. */
export function displaySize(source: Size, crop: Pick<CropState, "zoom" | "turn">): Size {
  const oriented = orientedSize(source, crop.turn);
  const perPixel = crop.zoom / Math.min(source.width, source.height);
  return { width: oriented.width * perPixel, height: oriented.height * perPixel };
}

function clampAxis(offset: number, span: number): number {
  // Bigger than the box: its edges may not come inside. Smaller: it may not leave.
  const limit = Math.abs(span - 1) / 2;
  return Math.min(limit, Math.max(-limit, offset));
}

/** Keep the zoom in range and the picture where the rules above allow. */
export function clampCrop(crop: CropState, source: Size): CropState {
  const zoom = Math.min(ZOOM_MAX, Math.max(minZoom(source), crop.zoom));
  const shown = displaySize(source, { zoom, turn: crop.turn });
  return {
    ...crop,
    zoom,
    x: clampAxis(crop.x, shown.width),
    y: clampAxis(crop.y, shown.height),
  };
}

/** Move by a screen delta given in box edges. */
export function panBy(crop: CropState, source: Size, dx: number, dy: number): CropState {
  return clampCrop({ ...crop, x: crop.x + dx, y: crop.y + dy }, source);
}

/**
 * Zoom by a factor about a focus point (box edges from the box centre), so the
 * spot under the cursor or between the fingers stays put.
 */
export function zoomAbout(
  crop: CropState,
  source: Size,
  factor: number,
  focus: { x: number; y: number } = { x: 0, y: 0 },
): CropState {
  const zoom = Math.min(ZOOM_MAX, Math.max(minZoom(source), crop.zoom * factor));
  const applied = zoom / crop.zoom;
  return clampCrop(
    {
      ...crop,
      zoom,
      x: focus.x + (crop.x - focus.x) * applied,
      y: focus.y + (crop.y - focus.y) * applied,
    },
    source,
  );
}

/** A quarter turn clockwise ON SCREEN, about the box centre. */
export function rotateClockwise(crop: CropState, source: Size): CropState {
  const step = crop.flip ? 3 : 1;
  const turn = ((crop.turn + step) % 4) as QuarterTurn;
  // The offset turns with the picture: (x, y) → (−y, x) clockwise, y down.
  return clampCrop({ ...crop, turn, x: -crop.y, y: crop.x }, source);
}

/** Mirror left↔right on screen, about the box centre. */
export function flipHorizontal(crop: CropState, source: Size): CropState {
  return clampCrop({ ...crop, flip: !crop.flip, x: -crop.x }, source);
}

/** How to draw the picture into a square of `edge` pixels. */
export interface Placement {
  /** Where the picture's centre lands, in output pixels. */
  centerX: number;
  centerY: number;
  /** -1 when flipped. */
  scaleX: 1 | -1;
  /** Clockwise, in degrees (0, 90, 180, 270). */
  rotationDeg: number;
  /** The UNTURNED picture's drawn size, in output pixels. */
  drawWidth: number;
  drawHeight: number;
}

export function placementFor(crop: CropState, source: Size, edge: number): Placement {
  const perPixel = (crop.zoom * edge) / Math.min(source.width, source.height);
  return {
    centerX: edge / 2 + crop.x * edge,
    centerY: edge / 2 + crop.y * edge,
    scaleX: crop.flip ? -1 : 1,
    rotationDeg: crop.turn * 90,
    drawWidth: source.width * perPixel,
    drawHeight: source.height * perPixel,
  };
}

/**
 * Where a SOURCE pixel lands in the output square: the placement applied by
 * hand, exactly as the canvas applies it (translate, scale, rotate, draw
 * centred). Tests read orientation through this.
 */
export function mapSourcePoint(
  placement: Placement,
  source: Size,
  point: { x: number; y: number },
): { x: number; y: number } {
  const localX = (point.x / source.width - 0.5) * placement.drawWidth;
  const localY = (point.y / source.height - 0.5) * placement.drawHeight;
  const radians = (placement.rotationDeg * Math.PI) / 180;
  const cos = Math.round(Math.cos(radians));
  const sin = Math.round(Math.sin(radians));
  const turnedX = localX * cos - localY * sin;
  const turnedY = localX * sin + localY * cos;
  return {
    x: placement.centerX + turnedX * placement.scaleX,
    y: placement.centerY + turnedY,
  };
}

/** The same placement as CSS for an <img> inside a box of `edge` px. */
export function cssPlacement(placement: Placement): {
  left: number;
  top: number;
  width: number;
  height: number;
  transform: string;
} {
  return {
    left: placement.centerX - placement.drawWidth / 2,
    top: placement.centerY - placement.drawHeight / 2,
    width: placement.drawWidth,
    height: placement.drawHeight,
    // transform-origin is the image centre, which already sits on centerX/Y.
    transform: `scaleX(${placement.scaleX}) rotate(${placement.rotationDeg}deg)`,
  };
}
