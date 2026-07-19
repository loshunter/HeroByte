// Water II S4: deep-water dash flocks. The painter is fillRect-only,
// world-lattice deterministic, strictly depth-gated (dashes live past the
// caustic shallows), clamps inside its cell, and every dash in a region steps
// along one shared diagonal heading.

import { describe, expect, it } from "vitest";
import { VILLAGE_TERRAIN } from "../terrainPalette";
import {
  ALGAE_MAX_DEPTH,
  DASH_MIN_DEPTH,
  dashHeadingFor,
  paintAlgaeTicks,
  paintWaterDetail,
} from "../terrainWaterDetail";
import { createTerrainField } from "../proceduralTerrain";
import { buildProceduralFieldConfig, paintProceduralDetail } from "../proceduralTerrainSurface";
import type { StructuredTerrainLayer, TileRenderContext2D } from "../tileRenderCore";
import { createRecordingContext, type RecordedCall } from "./recordingContext";

const SIZE = 48;
const DASH = { dash: "#142f43" };
const cellAt = (cellX: number, cellY: number) => ({
  x: cellX * SIZE,
  y: cellY * SIZE,
  size: SIZE,
  cellX,
  cellY,
});
const asCtx = (context: unknown) => context as unknown as TileRenderContext2D;
const rects = (calls: RecordedCall[]) => calls.filter(([op]) => op === "fillRect");
/** Float-add residue tolerance (~1e-13 px) — invisible to rasterization. */
const EPS = 1e-6;

describe("paintWaterDetail (dash flocks)", () => {
  it("paints nothing at or below the depth gate", () => {
    for (let cx = 0; cx < 8; cx += 1) {
      for (let cy = 0; cy < 8; cy += 1) {
        const { context, calls } = createRecordingContext();
        paintWaterDetail(asCtx(context), cellAt(cx, cy), DASH, DASH_MIN_DEPTH);
        expect(calls).toHaveLength(0);
      }
    }
  });

  it("paints sparse dashes past the gate, in the dash colour, inside the cell", () => {
    let painted = 0;
    for (let cx = 0; cx < 10; cx += 1) {
      for (let cy = 0; cy < 10; cy += 1) {
        const { context, calls } = createRecordingContext();
        paintWaterDetail(asCtx(context), cellAt(cx, cy), DASH, DASH_MIN_DEPTH + 1);
        if (calls.length === 0) continue;
        painted += 1;
        expect(calls[0]).toEqual(["set:fillStyle", DASH.dash]);
        for (const [, x, y, w, h] of rects(calls)) {
          expect(x as number).toBeGreaterThanOrEqual(cx * SIZE);
          expect((x as number) + (w as number)).toBeLessThanOrEqual((cx + 1) * SIZE + EPS);
          expect(y as number).toBeGreaterThanOrEqual(cy * SIZE);
          expect((y as number) + (h as number)).toBeLessThanOrEqual((cy + 1) * SIZE + EPS);
        }
      }
    }
    // The hash gate is sparse, not empty: a 10×10 deep sweep must flock.
    expect(painted).toBeGreaterThan(3);
    expect(painted).toBeLessThan(60);
  });

  it("is deterministic call-for-call", () => {
    const a = createRecordingContext();
    const b = createRecordingContext();
    paintWaterDetail(asCtx(a.context), cellAt(3, 7), DASH, 5);
    paintWaterDetail(asCtx(b.context), cellAt(3, 7), DASH, 5);
    expect(a.calls).toEqual(b.calls);
  });

  it("every dash step advances along the region's shared heading", () => {
    const heading = dashHeadingFor(0, 0);
    // A single-dash cell in region (0,0): consecutive emitted steps must be
    // collinear with the region heading (clamp-skipped steps just stretch the
    // gap along the same line).
    let checked = 0;
    for (let cx = 0; cx < 6; cx += 1) {
      for (let cy = 0; cy < 6; cy += 1) {
        const { context, calls } = createRecordingContext();
        paintWaterDetail(asCtx(context), cellAt(cx, cy), DASH, 5);
        const r = rects(calls);
        if (r.length < 2) continue;
        for (let i = 1; i < r.length; i += 1) {
          const dx = (r[i]![1] as number) - (r[i - 1]![1] as number);
          const dy = (r[i]![2] as number) - (r[i - 1]![2] as number);
          const cross = dx * heading.dy - dy * heading.dx;
          // Collinear with the heading, or the jump to a second dash's start.
          const isStep = Math.abs(cross) < 1e-9 && dx * heading.dx + dy * heading.dy > 0;
          if (isStep) checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(3);
  });

  it("region headings are diagonal unit steps, stable per region", () => {
    for (let rx = -2; rx < 3; rx += 1) {
      for (let ry = -2; ry < 3; ry += 1) {
        const h = dashHeadingFor(rx, ry);
        expect(h).toEqual(dashHeadingFor(rx, ry));
        // 25°–65° quadrant: both components well away from axis-aligned.
        expect(Math.abs(h.dx)).toBeGreaterThan(0.4);
        expect(Math.abs(h.dy)).toBeGreaterThan(0.4);
        expect(Math.hypot(h.dx, h.dy)).toBeCloseTo(1, 9);
      }
    }
  });
});

describe("paintAlgaeTicks", () => {
  it("scatters olive ticks on some cells, clamped inside the cell", () => {
    let painted = 0;
    for (let cx = 0; cx < 6; cx += 1) {
      for (let cy = 0; cy < 6; cy += 1) {
        const { context, calls } = createRecordingContext();
        paintAlgaeTicks(asCtx(context), cellAt(cx, cy), "#6a7a34");
        if (calls.length === 0) continue;
        painted += 1;
        expect(calls[0]).toEqual(["set:fillStyle", "#6a7a34"]);
        for (const [, x, y, w, h] of rects(calls)) {
          expect(x as number).toBeGreaterThanOrEqual(cx * SIZE);
          expect((x as number) + (w as number)).toBeLessThanOrEqual((cx + 1) * SIZE + EPS);
          expect(y as number).toBeGreaterThanOrEqual(cy * SIZE);
          expect((y as number) + (h as number)).toBeLessThanOrEqual((cy + 1) * SIZE + EPS);
        }
      }
    }
    expect(painted).toBeGreaterThan(3);
    expect(ALGAE_MAX_DEPTH).toBeLessThan(DASH_MIN_DEPTH); // algae hugs land, dashes the deeps
  });
});

describe("dash-flock routing (the village water body)", () => {
  const GRID = { size: 16, offsetX: 0, offsetY: 0 };
  const poolLayer = (side: number): StructuredTerrainLayer => {
    const cells = [];
    for (let y = 0; y < side; y += 1) {
      for (let x = 0; x < side; x += 1) {
        cells.push({ x: x * GRID.size, y: y * GRID.size, size: GRID.size, cellX: x, cellY: y });
      }
    }
    return { assetId: "terrain:water", cells, edges: [] };
  };

  it("a deep pool grows dash flocks; a shallow pool does not", () => {
    const dash = VILLAGE_TERRAIN["terrain:water"]!.water!.dash;
    for (const [side, expected] of [
      [12, true],
      [3, false],
    ] as const) {
      const layer = poolLayer(side);
      const built = buildProceduralFieldConfig([layer], GRID, VILLAGE_TERRAIN)!;
      const field = createTerrainField(built.config);
      const { context, calls } = createRecordingContext();
      paintProceduralDetail(
        asCtx(context),
        [layer],
        VILLAGE_TERRAIN,
        field,
        built.config.familyAt,
        built.config.depthOf,
      );
      const sawDash = calls.some((c) => c[0] === "set:fillStyle" && c[1] === dash);
      expect(sawDash, `side ${side}`).toBe(expected);
    }
  });
});
