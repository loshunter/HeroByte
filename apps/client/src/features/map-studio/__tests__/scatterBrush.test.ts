import { describe, expect, it } from "vitest";
import { createMapDocument } from "@herobyte/shared";
import { buildScatterDrafts } from "../scatterBrush";
import { getMapStudioTileAsset } from "../starterTiles";

const asset = getMapStudioTileAsset("objects:crate");

describe("buildScatterDrafts", () => {
  it("is deterministic: the same seed produces the identical scatter", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    const center = { x: 500, y: 500 };

    const first = buildScatterDrafts(document, asset, center, 42);
    const second = buildScatterDrafts(document, asset, center, 42);

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(1);
  });

  it("produces a different scatter for a different seed", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    const center = { x: 500, y: 500 };

    expect(buildScatterDrafts(document, asset, center, 1)).not.toEqual(
      buildScatterDrafts(document, asset, center, 2),
    );
  });

  it("keeps every stamp inside the document at whole-pixel positions", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    // Center at the corner: jitter must clamp, never escape.
    const drafts = buildScatterDrafts(document, asset, { x: 0, y: 0 }, 7);

    for (const draft of drafts) {
      expect(Number.isInteger(draft.x)).toBe(true);
      expect(Number.isInteger(draft.y)).toBe(true);
      expect(draft.x).toBeGreaterThanOrEqual(0);
      expect(draft.y).toBeGreaterThanOrEqual(0);
      expect(draft.x + draft.width).toBeLessThanOrEqual(document.width);
      expect(draft.y + draft.height).toBeLessThanOrEqual(document.height);
      expect(draft.rotation).toBeGreaterThanOrEqual(0);
      expect(draft.rotation).toBeLessThan(360);
    }
  });

  it("honors count and radius options", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    const center = { x: 1000, y: 1000 };

    const drafts = buildScatterDrafts(document, asset, center, 5, {
      count: 3,
      radiusCells: 0.5,
    });

    expect(drafts).toHaveLength(3);
    for (const draft of drafts) {
      // Stamp centers stay within half a cell (25px) of the brush center.
      const centerX = draft.x + draft.width / 2;
      const centerY = draft.y + draft.height / 2;
      const distance = Math.hypot(centerX - center.x, centerY - center.y);
      expect(distance).toBeLessThanOrEqual(25 + 1); // rounding slack
    }
  });

  it("returns nothing when no unlocked layer accepts the asset", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    document.layers = document.layers.map((layer) => ({ ...layer, locked: true }));

    expect(buildScatterDrafts(document, asset, { x: 100, y: 100 }, 9)).toEqual([]);
  });
});
