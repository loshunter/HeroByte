import { describe, expect, it } from "vitest";
import { act } from "@testing-library/react";
import { document, setup } from "./characterization/generateRegion.fixtures";
describe("Generate document containment", () => {
  it("blocks an imported grid's pixel-contained target outside the paintable cell range", () => {
    const original = document();
    const doc = {
      ...original,
      width: 1000,
      height: 600,
      grid: { ...original.grid, size: 1, offsetX: -65536, offsetY: 0 },
    };
    const { result, generate } = setup(doc);
    act(() => result.current.onRegionDragged({ x: 0, y: 0, width: 20, height: 20 }));
    expect(result.current.preview?.rectangle).toEqual({ x: 0, y: 0, width: 20, height: 20 });
    expect(result.current.canGenerate).toBe(false);
    expect(result.current.hint).toMatch(/terrain range/);
    act(() => result.current.onGenerate());
    expect(generate).not.toHaveBeenCalled();
  });
  it("refuses a locally well-sized region whose normalized right edge exceeds the document", () => {
    const doc = { ...document(), width: 1612, height: 1671 };
    const { result, generate } = setup(doc);
    act(() => result.current.onRegionDragged({ x: 205, y: 327, width: 1408, height: 1344 }));
    expect(result.current.canGenerate).toBe(false);
    expect(result.current.hint).toMatch(/inside the map document/);
    act(() => result.current.onGenerate());
    expect(generate).not.toHaveBeenCalled();
  });

  it("revalidates the same aim when this document shrinks, and recovers after correction", () => {
    const doc = { ...document(), width: 1613, height: 1671 };
    const { result, rerender, generate, controller } = setup(doc);
    act(() => result.current.onRegionDragged({ x: 205, y: 327, width: 1408, height: 1344 }));
    expect(result.current.canGenerate).toBe(true);
    const smaller = { ...controller, activeDocument: { ...doc, height: 1670 } };
    rerender({ c: smaller });
    expect(result.current.canGenerate).toBe(false);
    expect(result.current.hint).toMatch(/inside the map document/);
    act(() => result.current.onGenerate());
    expect(generate).not.toHaveBeenCalled();
    act(() => result.current.onRegionDragged({ x: 205, y: 263, width: 1408, height: 1344 }));
    expect(result.current.canGenerate).toBe(true);
    expect(result.current.hint).toBeNull();
  });
});
