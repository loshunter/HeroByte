import { describe, expect, it } from "vitest";
import { COLOR_WINDOW, contrastRatio, parseColor, windowCells, type Rgb } from "@herobyte/shared";
import { drawColorWindow } from "../drawColorWindow";
import type { PickerField } from "../colorPickerModel";

/** Paints the window into a fake 2D context (jsdom has none) and returns its pixels. */
function paint(zoned: (index: number) => boolean): Uint8ClampedArray {
  const { columns, rows } = COLOR_WINDOW;
  const data = new Uint8ClampedArray(columns * rows * 4);
  const context = {
    createImageData: () => ({ data }),
    putImageData: () => undefined,
  };
  const canvas = { getContext: () => context } as unknown as HTMLCanvasElement;
  const zones = new Int16Array(windowCells().length).map((_, index) => (zoned(index) ? 0 : -1));
  drawColorWindow(canvas, { others: [], zones, ownDots: [], suggestions: [] } as PickerField);
  return data;
}

const pixel = (data: Uint8ClampedArray, index: number): Rgb => ({
  r: data[index * 4]! / 255,
  g: data[index * 4 + 1]! / 255,
  b: data[index * 4 + 2]! / 255,
});

describe("drawColorWindow", () => {
  it("paints a free cell in its own colour", () => {
    const data = paint(() => false);
    const cell = windowCells()[1234]!;
    const own = parseColor(cell.hex)!;
    const shown = pixel(data, 1234);
    expect(Math.abs(shown.r - own.r) + Math.abs(shown.g - own.g) + Math.abs(shown.b - own.b)).toBe(
      0,
    );
  });

  it("stripes a zone so its edge shows at every lightness, the dark half included", () => {
    const data = paint(() => true);
    const { columns, rows } = COLOR_WINDOW;
    // Down every column, the better of a zone's two stripes stands out from the free
    // colour beside it by at least 3.5:1 (darkening alone fell to 1.35:1 at the bottom).
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 9) {
        const index = row * columns + column;
        const free = parseColor(windowCells()[index]!.hex)!;
        const rowStart = row * columns;
        let best = 0;
        for (let step = 0; step < 6; step += 1) {
          const neighbour = rowStart + ((column + step) % columns);
          best = Math.max(best, contrastRatio(free, pixel(data, neighbour)));
        }
        expect(best).toBeGreaterThanOrEqual(3.5);
      }
    }
  });
});
