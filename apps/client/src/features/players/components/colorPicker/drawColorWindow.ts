// The colour picker's window, painted one pixel per raster cell (the CSS scales
// it up): free cells in their colour, cells inside another player's zone striped.

import { COLOR_WINDOW, windowCells } from "@herobyte/shared";
import type { PickerField } from "./colorPickerModel";

/**
 * Zone cells are diagonal stripes: the colour darkened, and the colour washed
 * toward white. The window runs from pastels to deep shades, so darkening alone
 * vanishes in its dark half; with both stripes a zone's edge is at least 3.5:1
 * against the free colours beside it at every lightness.
 */
const ZONE_DARK = 0.2;
const ZONE_WASH = 0.75;
/** Stripe period in raster cells, and how many of them are the light stripe. */
const STRIPE_PERIOD = 6;
const STRIPE_LIGHT = 2;

export function drawColorWindow(canvas: HTMLCanvasElement | null, field: PickerField): void {
  let context: CanvasRenderingContext2D | null = null;
  try {
    context = canvas?.getContext("2d") ?? null;
  } catch {
    context = null; // jsdom: no 2D canvas. The handle, spots and readout are DOM.
  }
  if (!context) return;
  const { columns, rows } = COLOR_WINDOW;
  const image = context.createImageData(columns, rows);
  windowCells().forEach((cell, index) => {
    const offset = index * 4;
    const zoned = field.zones[index] !== -1;
    const light = (cell.column + cell.row) % STRIPE_PERIOD < STRIPE_LIGHT;
    for (let channel = 0; channel < 3; channel += 1) {
      const value = parseInt(cell.hex.slice(1 + channel * 2, 3 + channel * 2), 16);
      image.data[offset + channel] = !zoned
        ? value
        : light
          ? value + (255 - value) * ZONE_WASH
          : value * ZONE_DARK;
    }
    image.data[offset + 3] = 255;
  });
  context.putImageData(image, 0, 0);
}
