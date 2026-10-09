// The colour picker's window, painted one pixel per raster cell (the CSS scales
// it up): free cells in their colour, cells inside another player's zone darkened.

import { COLOR_WINDOW, windowCells } from "@herobyte/shared";
import type { PickerField } from "./colorPickerModel";

/** Zone cells are drawn this much darker, so the free colours stand out. */
const ZONE_DIM = 0.35;

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
    const dim = field.zones[index] === -1 ? 1 : ZONE_DIM;
    const offset = index * 4;
    image.data[offset] = parseInt(cell.hex.slice(1, 3), 16) * dim;
    image.data[offset + 1] = parseInt(cell.hex.slice(3, 5), 16) * dim;
    image.data[offset + 2] = parseInt(cell.hex.slice(5, 7), 16) * dim;
    image.data[offset + 3] = 255;
  });
  context.putImageData(image, 0, 0);
}
