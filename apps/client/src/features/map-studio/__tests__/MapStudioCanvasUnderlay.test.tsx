import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetJuiceSettingsForTests, setMotionLevel } from "../../juice/juiceSettings";
import { ANIMATION_STEP_MS, __resetAnimationClockForTests } from "../../render/animationClock";
import { createRecordingContext, type RecordedCall } from "../../render/__tests__/recordingContext";
import type { TileAtlas } from "../../render/tileAtlas";
import type { StructuredTerrainLayer } from "../../render/tileRenderCore";
import { MapStudioCanvasUnderlay } from "../components/MapStudioCanvasUnderlay";

const atlasHolder = vi.hoisted(() => ({ atlas: null as unknown }));
vi.mock("../../render/tileAtlas", () => ({
  useTileAtlas: () => atlasHolder.atlas,
}));

// The procedural field bake needs a real 2D canvas; unit tests mock it and
// assert the underlay blits whatever it returns. Non-field-family tests leave
// `result` null, so the bake is a no-op there (matching real behaviour).
const bakeHolder = vi.hoisted(() => ({
  result: null as null | {
    canvas: unknown;
    originX: number;
    originY: number;
    width: number;
    height: number;
  },
}));
vi.mock("../../render/proceduralTerrainSurface", () => ({
  bakeProceduralTerrain: () => bakeHolder.result,
}));

const GRID = { size: 50, offsetX: 0, offsetY: 0, visible: true };
const VIEW = { x: 0, y: 0, width: 200, height: 200 };

function stoneLayers(): StructuredTerrainLayer[] {
  return [
    {
      assetId: "terrain:stone-floor",
      cells: [{ x: 0, y: 0, size: 50, cellX: 0, cellY: 0 }],
      edges: [{ orientation: "h", x1: 0, y1: 0, x2: 50, y2: 0 }],
    },
  ];
}

function waterLayers(): StructuredTerrainLayer[] {
  return [
    { assetId: "terrain:water", cells: [{ x: 0, y: 0, size: 50, cellX: 0, cellY: 0 }], edges: [] },
  ];
}

function grassAndWaterLayers(): StructuredTerrainLayer[] {
  return [
    { assetId: "terrain:grass", cells: [{ x: 0, y: 0, size: 50, cellX: 0, cellY: 0 }], edges: [] },
    { assetId: "terrain:water", cells: [{ x: 50, y: 0, size: 50, cellX: 1, cellY: 0 }], edges: [] },
  ];
}

function canvasRect(width: number, height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

function renderUnderlay(overrides: Partial<Parameters<typeof MapStudioCanvasUnderlay>[0]> = {}) {
  return render(
    <MapStudioCanvasUnderlay
      documentWidth={200}
      documentHeight={200}
      grid={GRID}
      terrainLayers={stoneLayers()}
      terrainOpacity={1}
      animated={false}
      viewBox={VIEW}
      {...overrides}
    />,
  );
}

function indexOfCall(calls: RecordedCall[], call: RecordedCall): number {
  return calls.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(call));
}

describe("MapStudioCanvasUnderlay", () => {
  let calls: RecordedCall[];

  beforeEach(() => {
    __resetJuiceSettingsForTests({ motion: "full" });
    __resetAnimationClockForTests();
    vi.useFakeTimers();
    const recording = createRecordingContext();
    calls = recording.calls;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      recording.context as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue(
      canvasRect(400, 400),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    __resetAnimationClockForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    atlasHolder.atlas = null;
    bakeHolder.result = null;
  });

  it("draws backdrop, document, grid, then terrain under the camera transform", () => {
    renderUnderlay();

    // Backdrop fills the raw device pixels, then the camera transform maps
    // world to screen: 400px box over a 200px viewBox = scale 2.
    expect(calls[0]).toEqual(["setTransform", 1, 0, 0, 1, 0, 0]);
    expect(calls).toContainEqual(["setTransform", 2, 0, 0, 2, 0, 0]);
    const backdrop = indexOfCall(calls, ["fillRect", 0, 0, 400, 400]);
    const documentFill = indexOfCall(calls, ["fillRect", 0, 0, 200, 200]);
    const clip = indexOfCall(calls, ["clip"]);
    const gridStroke = indexOfCall(calls, ["set:strokeStyle", "rgba(127,214,255,0.22)"]);
    const terrainFill = indexOfCall(calls, ["fillRect", 0, 0, 50, 50]);
    expect(backdrop).toBeGreaterThanOrEqual(0);
    expect(documentFill).toBeGreaterThan(backdrop);
    expect(clip).toBeGreaterThan(documentFill);
    expect(gridStroke).toBeGreaterThan(clip);
    expect(terrainFill).toBeGreaterThan(gridStroke);
    // Terrain boundary drawn at the editor's width: max(2, 50 * 0.04) = 2.
    expect(calls).toContainEqual(["moveTo", 0, 0]);
    expect(calls).toContainEqual(["lineTo", 50, 0]);
  });

  it("letterboxes like preserveAspectRatio='xMidYMid meet'", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue(
      canvasRect(400, 300),
    );

    renderUnderlay();

    // 400x300 box, square viewBox: rendered viewport is 300x300 at offsetX 50.
    expect(calls).toContainEqual(["setTransform", 1.5, 0, 0, 1.5, 50, 0]);
  });

  it("advances water fills on the shared animation clock", () => {
    renderUnderlay({ terrainLayers: waterLayers(), animated: true });

    expect(calls).toContainEqual(["set:fillStyle", "#24516b"]);
    expect(calls).not.toContainEqual(["set:fillStyle", "#295a76"]);

    act(() => {
      vi.advanceTimersByTime(ANIMATION_STEP_MS);
    });

    expect(calls).toContainEqual(["set:fillStyle", "#295a76"]);
  });

  it("freezes water at the base fill under reduced motion", () => {
    setMotionLevel("off");
    renderUnderlay({ terrainLayers: waterLayers(), animated: true });

    act(() => {
      vi.advanceTimersByTime(ANIMATION_STEP_MS * 3);
    });

    expect(calls).toContainEqual(["set:fillStyle", "#24516b"]);
    expect(calls).not.toContainEqual(["set:fillStyle", "#295a76"]);
  });

  it("skips the grid when hidden", () => {
    renderUnderlay({ grid: { ...GRID, visible: false } });

    expect(indexOfCall(calls, ["set:strokeStyle", "rgba(127,214,255,0.22)"])).toBe(-1);
  });

  it("skips terrain when the terrain layer is hidden", () => {
    renderUnderlay({ terrainOpacity: 0 });

    expect(indexOfCall(calls, ["fillRect", 0, 0, 50, 50])).toBe(-1);
    expect(indexOfCall(calls, ["set:fillStyle", "#4d5361"])).toBe(-1);
  });

  it("composites translucent terrain like SVG group opacity (offscreen blit)", () => {
    renderUnderlay({ terrainOpacity: 0.5 });

    // The family flattens opaquely offscreen, then blits once at the layer
    // alpha — never per-primitive alpha, which would tint strokes with the
    // fill beneath them.
    const clear = indexOfCall(calls, ["clearRect", 0, 0, 400, 400]);
    const terrainFill = indexOfCall(calls, ["fillRect", 0, 0, 50, 50]);
    const alpha = indexOfCall(calls, ["set:globalAlpha", 0.5]);
    const blit = calls.findIndex(([op]) => op === "drawImage");
    expect(clear).toBeGreaterThanOrEqual(0);
    expect(terrainFill).toBeGreaterThan(clear);
    expect(alpha).toBeGreaterThan(terrainFill);
    expect(blit).toBeGreaterThan(alpha);
  });

  it("keeps drawing into letterbox bands that sit inside the document", () => {
    // 400x200 canvas over a square viewBox: 100px bands each side. With the
    // camera at (110,50), the band covers world x 60..110 — inside the
    // document, outside the viewBox. The cell at 50..100 must still draw.
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue(
      canvasRect(400, 200),
    );

    renderUnderlay({
      documentWidth: 300,
      documentHeight: 300,
      viewBox: { x: 110, y: 50, width: 100, height: 100 },
      terrainLayers: [
        {
          assetId: "terrain:stone-floor",
          cells: [{ x: 50, y: 50, size: 50, cellX: 1, cellY: 1 }],
          edges: [],
        },
      ],
    });

    expect(calls).toContainEqual(["fillRect", 50, 50, 50, 50]);
  });

  it("textures terrain from the tile atlas once it loads", () => {
    const atlasImage = {} as CanvasImageSource;
    atlasHolder.atlas = {
      image: atlasImage,
      tileForCell: () => ({ x: 128, y: 384, size: 128 }),
      // No blob47 art → whole-tile path (the quarter path stays inert).
      quarterRectsForCell: () => null,
    } satisfies TileAtlas;

    renderUnderlay();

    expect(calls).toContainEqual(["drawImage", atlasImage, 128, 384, 128, 128, 0, 0, 50, 50]);
    // The boundary stroke still draws on top of the texture.
    expect(calls).toContainEqual(["moveTo", 0, 0]);
  });

  it("redraws when the device pixel ratio changes without a resize", () => {
    let dprListener: (() => void) | null = null;
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        addEventListener: (_event: string, listener: () => void) => {
          dprListener = listener;
        },
        removeEventListener: vi.fn(),
      })),
    );

    renderUnderlay();
    const drawsBefore = calls.length;

    act(() => {
      dprListener?.();
    });

    expect(calls.length).toBeGreaterThan(drawsBefore);
  });

  it("blits the procedural field bake and keeps other families on the core", () => {
    const bakedCanvas = {} as HTMLCanvasElement;
    bakeHolder.result = { canvas: bakedCanvas, originX: 0, originY: 0, width: 100, height: 100 };

    renderUnderlay({ terrainLayers: grassAndWaterLayers(), animated: true });

    // The baked field canvas is blitted under the camera transform.
    expect(calls.some((call) => call[0] === "drawImage" && call[1] === bakedCanvas)).toBe(true);
    // Water (a non-field family) still renders through the shared core.
    expect(calls).toContainEqual(["set:fillStyle", "#24516b"]);
    // Grass is NOT flat-filled by the core — it lives in the procedural field.
    expect(calls).not.toContainEqual(["set:fillStyle", "#386820"]);
  });

  it("draws nothing into a zero-sized canvas", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue(
      canvasRect(0, 0),
    );

    renderUnderlay();

    expect(calls).toEqual([]);
  });
});
