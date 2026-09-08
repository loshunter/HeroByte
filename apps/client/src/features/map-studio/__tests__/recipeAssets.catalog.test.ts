// The server paints and stamps with ids from a SHARED list; the catalog those
// ids must exist in lives here, on the client. Only this side can see both, so
// only this side can prove the server is not naming a tile that does not
// exist — a hand-copied list would fail silently, at generate time, on a DM's
// table.

import { describe, expect, it } from "vitest";
import { RECIPE_ASSET_IDS, RECIPE_OBJECT_ASSETS } from "@herobyte/shared";
import { MAP_STUDIO_TILE_ASSETS } from "../starterTiles";

describe("the recipes' asset vocabulary", () => {
  it("names only tiles the catalog actually has", () => {
    const catalog = new Set(MAP_STUDIO_TILE_ASSETS.map((asset) => asset.id));
    const missing = RECIPE_ASSET_IDS.filter((id) => !catalog.has(id));
    expect({ missing }).toEqual({ missing: [] });
    expect(RECIPE_ASSET_IDS.length).toBeGreaterThan(0);
  });

  it("records each object's footprint as the catalog does — a stamp sized wrong overlaps its neighbour", () => {
    for (const asset of Object.values(RECIPE_OBJECT_ASSETS)) {
      const entry = MAP_STUDIO_TILE_ASSETS.find((candidate) => candidate.id === asset.id);
      expect(entry, `${asset.id} is missing from the catalog`).toBeDefined();
      expect({ id: asset.id, columns: entry!.columns, rows: entry!.rows }).toEqual({
        id: asset.id,
        columns: asset.columns,
        rows: asset.rows,
      });
    }
  });
});
