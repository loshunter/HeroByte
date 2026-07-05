// TEMP repro for claim verification — delete after run.
import { describe, expect, it } from "vitest";
import { createMapDocument, importMapDocument, paintTerrain } from "../mapStudio.js";

describe("claim repro", () => {
  it("A: 128-char id + trailing space is rejected by importMapDocument (raw length check)", () => {
    const entry = "x".repeat(128) + " ";
    expect(entry.trim().length).toBe(128); // zod .trim().max(128) would pass this
    const source = createMapDocument({ id: "map", name: "Keep", timestamp: 10 });
    const doc = {
      ...source,
      terrain: {
        schemaVersion: 1 as const,
        palette: [entry],
        chunks: { "0,0": [1, 1, 255, 0] },
      },
    };
    expect(() => importMapDocument(doc, 30)).toThrow(/palette/i);
  });

  it("B: untrimmed imported palette entry survives sanitize, then painting the trimmed id duplicates it", () => {
    const source = createMapDocument({ id: "map", name: "Keep", timestamp: 10 });
    const doc = importMapDocument(
      {
        ...source,
        terrain: {
          schemaVersion: 1 as const,
          palette: [" stone "],
          chunks: { "0,0": [1, 1, 255, 0] },
        },
      },
      30,
    );
    // sanitizeTerrainMap kept the entry untrimmed
    expect(doc.terrain!.palette).toEqual([" stone "]);
    // paintTerrain trims via requireText, so the same logical id becomes a second entry
    const painted = paintTerrain(doc, [{ x: 1, y: 0, assetId: "stone" }], 40);
    expect(painted.terrain!.palette).toEqual([" stone ", "stone"]);
  });
});
