import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetJuiceSettingsForTests, setMotionLevel } from "../../juice/juiceSettings";
import { ANIMATION_STEP_MS, __resetAnimationClockForTests } from "../../render/animationClock";
import { MapStudioTerrainLayers } from "../components/MapStudioTerrainLayers";
import { getMapStudioTileAsset } from "../starterTiles";
import type { TerrainRenderLayer } from "../terrainRender";

const water = getMapStudioTileAsset("terrain:water");
const stone = getMapStudioTileAsset("terrain:stone-floor");

function layer(assetId: string): TerrainRenderLayer {
  return { assetId, fillPath: "M 0 0 h 50 v 50 h -50 Z", boundaryPath: "" };
}

function waterFill(container: HTMLElement): string | null {
  return container.querySelector('[data-terrain="terrain:water"] path')!.getAttribute("fill");
}

function renderLayers(layers: TerrainRenderLayer[], animated: boolean) {
  return render(
    <svg>
      <MapStudioTerrainLayers
        terrainLayers={layers}
        gridSize={50}
        opacity={1}
        animated={animated}
      />
    </svg>,
  );
}

describe("MapStudioTerrainLayers", () => {
  beforeEach(() => {
    __resetJuiceSettingsForTests({ motion: "full" });
    __resetAnimationClockForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    __resetAnimationClockForTests();
  });

  it("renders the base fill at frame 0 (matching the export)", () => {
    const { container } = renderLayers([layer("terrain:water")], true);
    expect(waterFill(container)).toBe(water.fill);
    expect(water.animFills?.[0]).toBe(water.fill);
  });

  it("cycles the water fill through its animation frames on the clock", () => {
    const { container } = renderLayers([layer("terrain:water")], true);

    act(() => vi.advanceTimersByTime(ANIMATION_STEP_MS));
    expect(waterFill(container)).toBe(water.animFills![1]);

    act(() => vi.advanceTimersByTime(ANIMATION_STEP_MS));
    expect(waterFill(container)).toBe(water.animFills![2]);
  });

  it("keeps a non-animated family static across ticks", () => {
    const { container } = renderLayers([layer("terrain:stone-floor")], false);
    const fillOf = () =>
      container.querySelector('[data-terrain="terrain:stone-floor"] path')!.getAttribute("fill");
    expect(fillOf()).toBe(stone.fill);
    act(() => vi.advanceTimersByTime(ANIMATION_STEP_MS * 3));
    expect(fillOf()).toBe(stone.fill);
  });

  it("freezes water at the base fill under reduced motion", () => {
    setMotionLevel("off");
    const { container } = renderLayers([layer("terrain:water")], true);
    act(() => vi.advanceTimersByTime(ANIMATION_STEP_MS * 3));
    expect(waterFill(container)).toBe(water.fill);
  });
});
