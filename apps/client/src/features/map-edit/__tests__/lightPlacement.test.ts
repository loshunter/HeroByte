import { describe, expect, it, vi } from "vitest";
import type { MapDocument } from "@herobyte/shared";
import type { MapStudioController } from "../../map-studio/types";
import { lightDraftAt, placeLightAt } from "../lightPlacement";

function docWith(layers: MapDocument["layers"]): MapDocument {
  return {
    schemaVersion: 1,
    id: "live",
    name: "Live Map",
    width: 8192,
    height: 8192,
    grid: {
      type: "square",
      size: 50,
      squareSize: 5,
      offsetX: 10,
      offsetY: 20,
      visible: true,
      snap: true,
    },
    layers,
    elements: [],
    revision: 1,
    createdAt: 1,
    updatedAt: 1,
  };
}

const lightingLayer = {
  id: "lighting",
  name: "Lighting",
  kind: "lighting" as const,
  visible: true,
  locked: false,
  opacity: 1,
  zIndex: 40,
};

describe("lightDraftAt", () => {
  it("snaps the pool to the clicked cell's centre on the offset lattice", () => {
    // Click inside cell (2, 1) of the offset grid: x ∈ [110,160), y ∈ [70,120).
    const draft = lightDraftAt(docWith([lightingLayer]), { x: 143, y: 88 })!;
    expect(draft.layerId).toBe("lighting");
    expect(draft.x).toBe(10 + 2.5 * 50);
    expect(draft.y).toBe(20 + 1.5 * 50);
    expect(draft.radius).toBe(3.5 * 50);
  });

  it("returns null without a lighting layer", () => {
    expect(lightDraftAt(docWith([]), { x: 0, y: 0 })).toBeNull();
  });
});

describe("placeLightAt", () => {
  it("routes the draft through controller.addLight", () => {
    const addLight = vi.fn(() => "light-1");
    const controller = { addLight } as unknown as MapStudioController;
    const id = placeLightAt(controller, docWith([lightingLayer]), { x: 30, y: 30 });
    expect(id).toBe("light-1");
    expect(addLight).toHaveBeenCalledWith(
      expect.objectContaining({ layerId: "lighting", color: "#ffc06a", intensity: 1 }),
    );
  });
});
