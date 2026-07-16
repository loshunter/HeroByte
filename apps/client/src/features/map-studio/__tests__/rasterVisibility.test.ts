// ============================================================================
// RASTER VISIBILITY — the decision table of the publish privacy gate
// ============================================================================
// visibleInRaster is the ONLY thing standing between GM-private authoring data
// and the published raster: the server stores the DM-supplied PNG verbatim (it
// has no rasterizer to re-derive it), so this filter is enforced in the DM's
// client and nowhere else — and it already regressed once (a GM Notes ring
// baked into player art). The SVG-level integration tests in
// exportMapDocument.test.ts pin the big cases end-to-end; this file pins the
// full decision table so every branch has a named owner.

import { describe, expect, it } from "vitest";
import type { MapElement, MapLayer } from "@herobyte/shared";
import { visibleInRaster } from "../rasterVisibility";

function layer(overrides: Partial<MapLayer> = {}): MapLayer {
  return {
    id: "objects",
    name: "Objects",
    kind: "objects",
    visible: true,
    locked: false,
    opacity: 1,
    zIndex: 10,
    ...overrides,
  };
}

function tile(overrides: Partial<Extract<MapElement, { type: "tile" }>> = {}): MapElement {
  return {
    id: "tile-1",
    type: "tile",
    layerId: "objects",
    locked: false,
    hidden: false,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: { assetId: "tile:crate", columns: 1, rows: 1 },
    ...overrides,
  };
}

function text(visibleToPlayers: boolean): MapElement {
  return {
    id: "text-1",
    type: "text",
    layerId: "objects",
    locked: false,
    hidden: false,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: { text: "Ambush!", color: "#fff", fontSize: 16, visibleToPlayers },
  };
}

function door(state: "closed" | "open" | "locked" | "secret"): MapElement {
  return {
    id: "door-1",
    type: "door",
    layerId: "walls",
    locked: false,
    hidden: false,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: { width: 50, state, blocksMovement: true, blocksVision: true },
  };
}

describe("visibleInRaster", () => {
  it("bakes an ordinary visible element", () => {
    expect(visibleInRaster(tile(), layer())).toBe(true);
  });

  it("drops EVERYTHING on a notes-kind layer, even player-visible text", () => {
    // The regression: only text had its own flag, so a shape on GM Notes baked
    // into the art every player saw. The layer kind outranks element flags.
    const notes = layer({ id: "notes", kind: "notes" });
    expect(visibleInRaster(tile({ layerId: "notes" }), notes)).toBe(false);
    expect(visibleInRaster({ ...text(true), layerId: "notes" }, notes)).toBe(false);
  });

  it("drops elements on an invisible layer", () => {
    expect(visibleInRaster(tile(), layer({ visible: false }))).toBe(false);
  });

  it("drops elements on a zero-opacity layer", () => {
    expect(visibleInRaster(tile(), layer({ opacity: 0 }))).toBe(false);
  });

  it("drops elements whose layer is missing entirely", () => {
    expect(visibleInRaster(tile(), undefined)).toBe(false);
  });

  it("drops hidden elements regardless of layer", () => {
    expect(visibleInRaster(tile({ hidden: true }), layer())).toBe(false);
  });

  it("bakes text only when visibleToPlayers", () => {
    expect(visibleInRaster(text(true), layer())).toBe(true);
    expect(visibleInRaster(text(false), layer())).toBe(false);
  });

  it("drops ordinary doors (live-only) but bakes secret ones as wall disguise", () => {
    const walls = layer({ id: "walls", kind: "walls" });
    expect(visibleInRaster(door("closed"), walls)).toBe(false);
    expect(visibleInRaster(door("open"), walls)).toBe(false);
    expect(visibleInRaster(door("locked"), walls)).toBe(false);
    expect(visibleInRaster(door("secret"), walls)).toBe(true);
  });
});
