// TEMPORARY verification repro — delete after review.
import { describe, expect, it } from "vitest";
import { createMapDocument, importMapDocument, paintTerrain } from "../mapStudio.js";
import { applyMapDocumentCommand } from "../mapStudioCommands.js";
import type { MapDocument } from "../mapStudioTypes.js";

describe("chunk-cap round-trip verification", () => {
  it("two legal strokes exceed the import chunk cap and break the backup round-trip", () => {
    let doc: MapDocument = createMapDocument({ id: "map-1", name: "Cap", timestamp: 1 });

    // Stroke 1: 16384 cells, one per distinct chunk (x = 16*i keeps every cell
    // in its own chunk column; coords stay well inside +-65536 since 16*16383 = 262128... too big!)
    // Use 2D spread instead: chunk grid 128x129 => coords up to 16*129 = 2064, well within range.
    const stroke1 = [];
    const stroke2 = [];
    let count = 0;
    outer: for (let cy = 0; cy < 200; cy++) {
      for (let cx = 0; cx < 128; cx++) {
        const cell = { x: cx * 16, y: cy * 16, assetId: "grass" };
        if (count < 16384) stroke1.push(cell);
        else {
          stroke2.push(cell);
          break outer; // exactly one extra chunk => 16385 total
        }
        count++;
      }
    }
    expect(stroke1.length).toBe(16384);
    expect(stroke2.length).toBe(1);

    // Both strokes are legal per paintTerrain AND per the WS zod schema
    // (1..16384 cells, int coords within +-65536).
    doc = applyMapDocumentCommand(
      doc,
      {
        commandId: "c1",
        documentId: "map-1",
        baseRevision: 0,
        type: "paint-terrain",
        cells: stroke1,
      },
      2,
    ).document;
    doc = applyMapDocumentCommand(
      doc,
      {
        commandId: "c2",
        documentId: "map-1",
        baseRevision: 1,
        type: "paint-terrain",
        cells: stroke2,
      },
      3,
    ).document;

    expect(Object.keys(doc.terrain!.chunks).length).toBe(16385);

    // Serialize like a JSON backup and try to restore it.
    const backup = JSON.parse(JSON.stringify(doc)) as MapDocument;
    expect(() => importMapDocument({ ...backup, id: "map-restored" }, 10)).toThrow(
      "Terrain map has too many chunks",
    );

    // Sanity: paintTerrain itself never objected.
    expect(doc.revision).toBe(2);
  });

  it("control: 16384 chunks round-trips fine", () => {
    let doc: MapDocument = createMapDocument({ id: "map-2", name: "Ok", timestamp: 1 });
    const cells = [];
    for (let cy = 0; cy < 128; cy++) {
      for (let cx = 0; cx < 128; cx++) {
        cells.push({ x: cx * 16, y: cy * 16, assetId: "grass" });
      }
    }
    expect(cells.length).toBe(16384);
    doc = paintTerrain(doc, cells, 2);
    const backup = JSON.parse(JSON.stringify(doc)) as MapDocument;
    const restored = importMapDocument({ ...backup, id: "map-2b" }, 10);
    expect(Object.keys(restored.terrain!.chunks).length).toBe(16384);
  });
});
