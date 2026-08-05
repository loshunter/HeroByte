// The accumulation half of explored fog. jsdom has no 2D context at all
// (`getContext("2d")` returns null), so these install a recording stub — which
// is also the only way to assert the one thing that matters geometrically:
// that document-space polygons are scaled into MASK space by 1/cell.

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ScenePoint } from "@herobyte/shared";
import { useExploredFog } from "../useExploredFog";
import {
  byteLengthFor,
  exploredFogKey,
  loadExploredMask,
  maskGeometryFor,
  saveExploredMask,
} from "../../exploredFogStore";

const SCENE = { sceneWidth: 800, sceneHeight: 600 };
const META = maskGeometryFor(SCENE.sceneWidth, SCENE.sceneHeight);
const KEY = exploredFogKey("table", "uid-1", "doc-1");

interface RecordedFill {
  transform: number[];
  points: ScenePoint[];
}

let fills: RecordedFill[];
let imageDataAlpha: Uint8ClampedArray;
let store: Record<string, string>;

function fakeContext() {
  let transform = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  let path: ScenePoint[] = [];
  return {
    fillStyle: "",
    save: vi.fn(() => stack.push([...transform])),
    restore: vi.fn(() => {
      transform = stack.pop() ?? transform;
    }),
    setTransform: vi.fn((a: number, b: number, c: number, d: number, e: number, f: number) => {
      transform = [a, b, c, d, e, f];
    }),
    beginPath: vi.fn(() => {
      path = [];
    }),
    moveTo: vi.fn((x: number, y: number) => path.push({ x, y })),
    lineTo: vi.fn((x: number, y: number) => path.push({ x, y })),
    closePath: vi.fn(),
    fill: vi.fn(() => fills.push({ transform: [...transform], points: [...path] })),
    createImageData: vi.fn((w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) })),
    putImageData: vi.fn((image: { data: Uint8ClampedArray }) => {
      imageDataAlpha = image.data;
    }),
    getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => {
      // Every fill so far marks the whole mask explored — enough to prove the
      // save path packs and persists something, without a rasteriser.
      const data = new Uint8ClampedArray(w * h * 4);
      if (fills.length > 0) {
        for (let i = 0; i < w * h; i += 1) data[i * 4 + 3] = 255;
      }
      return { data };
    }),
  };
}

describe("useExploredFog", () => {
  beforeEach(() => {
    fills = [];
    imageDataAlpha = new Uint8ClampedArray(0);
    store = {};
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete store[key];
        }),
      },
      writable: true,
      configurable: true,
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => fakeContext() as unknown as CanvasRenderingContext2D,
    );
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const square: ScenePoint[] = [
    { x: 0, y: 0 },
    { x: 80, y: 0 },
    { x: 80, y: 80 },
    { x: 0, y: 80 },
  ];

  function render(polygons: ScenePoint[][], storageKey: string | null = KEY) {
    return renderHook(
      (props: { polygons: ScenePoint[][]; storageKey: string | null }) =>
        useExploredFog({ ...SCENE, ...props }),
      { initialProps: { polygons, storageKey } },
    );
  }

  it("makes a canvas at MASK resolution, not scene resolution", () => {
    const { result } = render([square]);

    expect(result.current.canvas!.width).toBe(META.cols);
    expect(result.current.canvas!.height).toBe(META.rows);
    // 800x600 at cell 8 is 100x75 — three orders of magnitude less memory than
    // the scene, and never multiplied by the device pixel ratio.
    expect(META.cols).toBe(100);
    expect(META.rows).toBe(75);
  });

  // The unit trap, in miniature: polygons arrive in DOCUMENT pixels and the
  // canvas is in MASK cells.
  it("scales document-space polygons into mask space by 1/cell", () => {
    render([square]);

    expect(fills).toHaveLength(1);
    expect(fills[0]!.transform).toEqual([1 / META.cell, 0, 0, 1 / META.cell, 0, 0]);
    expect(fills[0]!.points).toEqual(square);
  });

  it("fills one path per viewer", () => {
    render([square, [...square].map((p) => ({ x: p.x + 200, y: p.y }))]);

    expect(fills).toHaveLength(2);
  });

  it("ignores a degenerate polygon (a blind viewer)", () => {
    render([[], [{ x: 1, y: 1 }]]);

    expect(fills).toHaveLength(0);
  });

  // The union is the canvas: nothing is ever cleared between updates, so
  // walking back through a cleared room keeps what was seen before.
  it("accumulates without clearing", () => {
    const { rerender } = render([square]);
    expect(fills).toHaveLength(1);

    rerender({ polygons: [[...square].map((p) => ({ x: p.x + 300, y: p.y }))], storageKey: KEY });

    expect(fills).toHaveLength(2);
    // Both regions are still described by the accumulated fills.
    expect(fills[0]!.points[1]!.x).toBe(80);
    expect(fills[1]!.points[1]!.x).toBe(380);
  });

  it("bumps a revision so react-konva repaints pixels that changed under it", () => {
    const { result, rerender } = render([square]);
    const first = result.current.revision;

    rerender({ polygons: [[...square].map((p) => ({ x: p.x + 10, y: p.y }))], storageKey: KEY });

    expect(result.current.revision).toBeGreaterThan(first);
    // The canvas ITSELF is stable — only its pixels moved, which is exactly
    // why the revision has to exist.
    expect(result.current.canvas).toBe(result.current.canvas);
  });

  // Reading the canvas back is a full getImageData; it must not happen per frame.
  it("debounces the write instead of saving on every update", () => {
    render([square]);

    expect(localStorage.setItem).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(localStorage.setItem).toHaveBeenCalled();
    expect(loadExploredMask(KEY, { ...META, ...SCENE })).not.toBeNull();
  });

  it("flushes on unmount, so closing the tab remembers the corridor", () => {
    const { unmount } = render([square]);
    expect(localStorage.setItem).not.toHaveBeenCalled();

    unmount();

    expect(loadExploredMask(KEY, { ...META, ...SCENE })).not.toBeNull();
  });

  it("restores a stored mask onto a fresh canvas", () => {
    const bits = new Uint8Array(byteLengthFor(META));
    bits[0] = 0b0000_0101; // cells 0 and 2
    saveExploredMask(KEY, { ...META, ...SCENE }, bits);

    render([]);

    expect(imageDataAlpha[3]).toBe(255); // cell 0
    expect(imageDataAlpha[7]).toBe(0); // cell 1
    expect(imageDataAlpha[11]).toBe(255); // cell 2
  });

  it("remembers nothing at all when given no key", () => {
    const { result } = render([square], null);

    expect(result.current.canvas).toBeNull();
    expect(fills).toHaveLength(0);
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  // A different table, player or map is a different memory — and starting from
  // the previous one would be the cross-table bleed the key scheme exists to
  // prevent.
  it("starts a fresh canvas when the key changes", () => {
    const { result, rerender } = render([square]);
    const first = result.current.canvas;

    rerender({ polygons: [square], storageKey: exploredFogKey("table", "uid-1", "doc-2") });

    expect(result.current.canvas).not.toBe(first);
  });
});
