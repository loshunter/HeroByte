// TEMP repro for claim verification — delete after run.
import { describe, expect, it } from "vitest";
import { validateMessage } from "../validation.js";

const base = {
  schemaVersion: 1,
  id: "map",
  name: "Keep",
  width: 2048,
  height: 2048,
  grid: {
    type: "square",
    size: 50,
    squareSize: 5,
    offsetX: 0,
    offsetY: 0,
    visible: true,
    snap: true,
  },
  layers: [
    {
      id: "terrain",
      name: "Terrain",
      kind: "terrain",
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: 10,
    },
  ],
  elements: [],
  revision: 0,
  createdAt: 1,
  updatedAt: 1,
};

describe("claim repro (boundary)", () => {
  it("A: zod accepts a palette entry of 128 chars + trailing space (trim-then-max semantics)", () => {
    const entry = "x".repeat(128) + " ";
    const terrain = { schemaVersion: 1, palette: [entry], chunks: { "0,0": [1, 1, 255, 0] } };
    const result = validateMessage({ t: "map-studio-import", document: { ...base, terrain } });
    expect(result.valid).toBe(true);
  });

  it("B: zod accepts a whitespace-padded palette entry ' stone '", () => {
    const terrain = { schemaVersion: 1, palette: [" stone "], chunks: { "0,0": [1, 1, 255, 0] } };
    const result = validateMessage({ t: "map-studio-import", document: { ...base, terrain } });
    expect(result.valid).toBe(true);
  });
});
