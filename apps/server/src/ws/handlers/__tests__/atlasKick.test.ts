// The return door's placement rule, with hand-computed literals: the arrival
// rect's boundary cell on the side nearest the document's edge, in document
// px by the token convention ((cell + 0.5) × size + offset), never the center.

import { describe, expect, it } from "vitest";
import { createMapDocument } from "@herobyte/shared";
import { entranceAnchor } from "../atlasKick.js";

// 24×20 cells at 50 px, no offset.
const DOC = createMapDocument({ id: "d", name: "D", width: 1200, height: 1000, timestamp: 1 });

describe("entranceAnchor", () => {
  it("picks the WEST edge when the rect is nearest the left border — the middle of the left column", () => {
    // Cells 1..3 × 8..10: west gap 1, east gap 20, north gap 8, south gap 9.
    const anchor = entranceAnchor({ x: 2, y: 9, width: 3, height: 3, rotation: 0 }, DOC);
    expect(anchor).toEqual({ x: (1 + 0.5) * 50, y: (9 + 0.5) * 50 });
  });

  it("picks the SOUTH edge when the bottom border is nearest — the middle of the bottom row", () => {
    // Cells 10..13 × 16..18: south gap 1 beats west 10, east 10, north 16.
    const anchor = entranceAnchor({ x: 11.5, y: 17, width: 4, height: 3, rotation: 0 }, DOC);
    expect(anchor).toEqual({ x: (11.5 + 0.5) * 50, y: (18 + 0.5) * 50 });
  });

  it("never returns the zone's CENTER for a rect wider than one cell", () => {
    const zone = { x: 11.5, y: 9.5, width: 6, height: 4, rotation: 0 };
    expect(entranceAnchor(zone, DOC)).not.toEqual({ x: (11.5 + 0.5) * 50, y: (9.5 + 0.5) * 50 });
  });

  it("honours the document's grid offset", () => {
    const offset = createMapDocument({
      id: "o",
      name: "O",
      width: 1210,
      height: 1020,
      grid: {
        type: "square",
        size: 50,
        squareSize: 5,
        offsetX: 10,
        offsetY: 20,
        visible: true,
        snap: true,
      },
      timestamp: 1,
    });
    const anchor = entranceAnchor({ x: 2, y: 9, width: 3, height: 3, rotation: 0 }, offset);
    expect(anchor).toEqual({ x: (1 + 0.5) * 50 + 10, y: (9 + 0.5) * 50 + 20 });
  });

  it("falls back to the document's center when the node recorded no arrival", () => {
    expect(entranceAnchor(undefined, DOC)).toEqual({ x: 600, y: 500 });
  });
});
