/**
 * The crop math is the one place the creator decides where a picture lands.
 * Orientation is read through mapSourcePoint, which applies a placement the
 * way the canvas does: if these pass, a turned or flipped bake is the picture
 * the player saw.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_CROP,
  ZOOM_MAX,
  clampCrop,
  cssPlacement,
  displaySize,
  flipHorizontal,
  mapSourcePoint,
  minZoom,
  panBy,
  placementFor,
  rotateClockwise,
  zoomAbout,
  type CropState,
  type Size,
} from "../cropMath";

const SQUARE: Size = { width: 200, height: 200 };
const PORTRAIT: Size = { width: 200, height: 400 };
const LANDSCAPE: Size = { width: 400, height: 200 };
const EDGE = 100;

function corner(crop: CropState, source: Size, point: { x: number; y: number }) {
  const at = mapSourcePoint(placementFor(crop, source, EDGE), source, point);
  return { x: Math.round(at.x), y: Math.round(at.y) };
}

describe("default framing", () => {
  it("covers the square with the picture centred", () => {
    const placement = placementFor(DEFAULT_CROP, PORTRAIT, EDGE);
    expect(placement).toMatchObject({ centerX: 50, centerY: 50, drawWidth: 100, drawHeight: 200 });
    // A portrait loses its top and bottom quarter, evenly.
    expect(corner(DEFAULT_CROP, PORTRAIT, { x: 0, y: 0 })).toEqual({ x: 0, y: -50 });
    expect(corner(DEFAULT_CROP, PORTRAIT, { x: 200, y: 400 })).toEqual({ x: 100, y: 150 });
  });
});

describe("rotate and flip", () => {
  it("a clockwise turn puts the top-left corner top-right", () => {
    const turned = rotateClockwise(DEFAULT_CROP, SQUARE);
    expect(turned.turn).toBe(1);
    expect(corner(turned, SQUARE, { x: 0, y: 0 })).toEqual({ x: 100, y: 0 });
    expect(corner(turned, SQUARE, { x: 200, y: 0 })).toEqual({ x: 100, y: 100 });
  });

  it("four turns come home", () => {
    let crop = DEFAULT_CROP;
    for (let i = 0; i < 4; i += 1) crop = rotateClockwise(crop, SQUARE);
    expect(crop).toEqual(DEFAULT_CROP);
  });

  it("flip mirrors left and right", () => {
    const flipped = flipHorizontal(DEFAULT_CROP, SQUARE);
    expect(corner(flipped, SQUARE, { x: 0, y: 0 })).toEqual({ x: 100, y: 0 });
    expect(corner(flipped, SQUARE, { x: 0, y: 200 })).toEqual({ x: 100, y: 100 });
  });

  it("flip after a turn still mirrors left and right on screen", () => {
    const turned = rotateClockwise(DEFAULT_CROP, SQUARE);
    const both = flipHorizontal(turned, SQUARE);
    // Turned: top-left went top-right. Mirrored: it comes back to top-left.
    expect(corner(both, SQUARE, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    // And the turned picture's bottom-left (source top-right... at bottom-right) mirrors left.
    expect(corner(turned, SQUARE, { x: 200, y: 0 })).toEqual({ x: 100, y: 100 });
    expect(corner(both, SQUARE, { x: 200, y: 0 })).toEqual({ x: 0, y: 100 });
  });

  it("while flipped, the rotate button still turns clockwise on screen", () => {
    const flipped = flipHorizontal(DEFAULT_CROP, SQUARE);
    const turned = rotateClockwise(flipped, SQUARE);
    // Flipped: source top-left sits top-right. Clockwise on screen: top-right → bottom-right.
    expect(corner(flipped, SQUARE, { x: 0, y: 0 })).toEqual({ x: 100, y: 0 });
    expect(corner(turned, SQUARE, { x: 0, y: 0 })).toEqual({ x: 100, y: 100 });
  });

  it("a turned portrait covers with its turned sides", () => {
    const turned = rotateClockwise(DEFAULT_CROP, PORTRAIT);
    expect(displaySize(PORTRAIT, turned)).toEqual({ width: 2, height: 1 });
  });

  it("an offset turns with the picture", () => {
    const moved = panBy(DEFAULT_CROP, LANDSCAPE, 0.5, 0);
    expect(moved.x).toBe(0.5);
    const turned = rotateClockwise(moved, LANDSCAPE);
    // (0.5, 0) clockwise is (0, 0.5): the picture is now tall and moved down.
    expect(turned.x).toBeCloseTo(0);
    expect(turned.y).toBeCloseTo(0.5);
  });
});

describe("zoom and pan limits", () => {
  it("zoom stops at the ceiling and at half the fit size", () => {
    expect(zoomAbout(DEFAULT_CROP, PORTRAIT, 100).zoom).toBe(ZOOM_MAX);
    // A 1:2 portrait fits whole at zoom 0.5, so the floor is 0.25.
    expect(minZoom(PORTRAIT)).toBe(0.25);
    expect(zoomAbout(DEFAULT_CROP, PORTRAIT, 0.001).zoom).toBe(0.25);
  });

  it("a covering picture cannot uncover the square", () => {
    // Landscape covers at 2 × 1 box edges: half a box of slack left and right, none up or down.
    const pushed = panBy(DEFAULT_CROP, LANDSCAPE, 5, 5);
    expect(pushed.x).toBe(0.5);
    expect(pushed.y).toBe(0);
  });

  it("a small picture cannot leave the square", () => {
    const small = clampCrop({ ...DEFAULT_CROP, zoom: 0.5, x: 9, y: -9 }, SQUARE);
    expect(small.x).toBe(0.25);
    expect(small.y).toBe(-0.25);
  });

  it("zooming about a point keeps that point still", () => {
    const start = { ...DEFAULT_CROP, zoom: 2 };
    const focus = { x: 0.25, y: 0.25 };
    const zoomed = zoomAbout(start, SQUARE, 1.5, focus);
    // The picture point under the focus before: (focus - offset) / zoom, in box edges.
    const before = (focus.x - start.x) / start.zoom;
    const after = (focus.x - zoomed.x) / zoomed.zoom;
    expect(after).toBeCloseTo(before);
  });
});

describe("css placement", () => {
  it("matches the canvas placement", () => {
    const crop = flipHorizontal(rotateClockwise({ ...DEFAULT_CROP, zoom: 2 }, PORTRAIT), PORTRAIT);
    const placement = placementFor(crop, PORTRAIT, 280);
    const css = cssPlacement(placement);
    expect(css.left + css.width / 2).toBeCloseTo(placement.centerX);
    expect(css.top + css.height / 2).toBeCloseTo(placement.centerY);
    expect(css.transform).toBe("scaleX(-1) rotate(90deg)");
  });
});
