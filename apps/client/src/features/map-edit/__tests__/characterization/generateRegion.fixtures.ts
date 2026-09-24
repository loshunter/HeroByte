// Run the baseline describe independently before extracting its private helpers.
import { vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { MapDocument } from "@herobyte/shared";
import type { MapStudioController } from "../../../map-studio/types";
import { useGenerate } from "../../useGenerate";

export function document(grid: Partial<MapDocument["grid"]> = {}): MapDocument {
  return {
    schemaVersion: 1,
    id: "region-document",
    name: "Region test",
    width: 20000,
    height: 20000,
    grid: {
      type: "square",
      size: 64,
      squareSize: 5,
      offsetX: 13,
      offsetY: 7,
      snap: true,
      visible: true,
      ...grid,
    },
    layers: [],
    elements: [],
    revision: 0,
    createdAt: 0,
    updatedAt: 0,
  };
}

export function setup(doc = document()) {
  const generate = vi.fn();
  const controller = {
    activeDocument: doc,
    saving: false,
    generate,
  } as unknown as MapStudioController;
  const hook = renderHook(({ c }) => useGenerate(c, true, "generate", true), {
    initialProps: { c: controller },
  });
  return { ...hook, generate, controller };
}
