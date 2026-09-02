import { describe, expect, it } from "vitest";
import {
  MAX_RECIPE_CELLS,
  MIN_RECIPE_COLS,
  MIN_RECIPE_ROWS,
} from "../../../domains/generation/types.js";
import { GENERATE_PRESETS } from "../atlasGenerate.js";

describe("GENERATE_PRESETS", () => {
  it("every preset clears the recipe floor and the cell ceiling — a new preset cannot ship an always-erroring button", () => {
    // The floor is 20×20 (MIN_RECIPE_COLS/ROWS), NOT the wire validator's 8×8
    // — the m4 plan's old number. Small sits at zero row margin on purpose.
    for (const [name, { cols, rows }] of Object.entries(GENERATE_PRESETS)) {
      expect(cols, `${name}.cols`).toBeGreaterThanOrEqual(MIN_RECIPE_COLS);
      expect(rows, `${name}.rows`).toBeGreaterThanOrEqual(MIN_RECIPE_ROWS);
      expect(cols * rows, `${name} area`).toBeLessThanOrEqual(MAX_RECIPE_CELLS);
    }
  });
});
