import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MapElement, MapLayer } from "@herobyte/shared";
import { MapStudioElementPreview } from "../components/MapStudioElementPreview";
import { getMapStudioTileAsset } from "../starterTiles";

type TileElement = Extract<MapElement, { type: "tile" }>;

const layer: MapLayer = {
  id: "terrain",
  name: "Terrain",
  kind: "terrain",
  visible: true,
  locked: false,
  opacity: 1,
  zIndex: 0,
};

function tile(
  id: string,
  x: number,
  y: number,
  overrides: { assetId?: string; rotation?: number } = {},
): TileElement {
  return {
    id,
    type: "tile",
    layerId: "terrain",
    locked: false,
    hidden: false,
    transform: { x, y, scaleX: 1, scaleY: 1, rotation: overrides.rotation ?? 0 },
    data: { assetId: overrides.assetId ?? "terrain:stone-floor", columns: 1, rows: 1 },
  };
}

const GRID = { size: 50, offsetX: 0, offsetY: 0 };

function renderPreview(element: MapElement, occupancy?: Map<string, string>) {
  return render(
    <svg>
      <MapStudioElementPreview
        element={element}
        layer={layer}
        gridSize={50}
        autotile={occupancy ? { occupancy, grid: GRID } : undefined}
      />
    </svg>,
  );
}

describe("MapStudioElementPreview uploaded images", () => {
  const HASH = "d".repeat(64);

  function uploadStamp(tint?: string): Extract<MapElement, { type: "stamp" }> {
    return {
      id: "stamp-1",
      type: "stamp",
      layerId: "terrain",
      locked: false,
      hidden: false,
      transform: { x: 10, y: 20, scaleX: 1, scaleY: 1, rotation: 0 },
      data: { assetId: `upload:${HASH}`, width: 100, height: 50, ...(tint ? { tint } : {}) },
    };
  }

  it("renders uploaded stamps as images sized to the stamp footprint", () => {
    const { container } = renderPreview(uploadStamp());
    const image = container.querySelector("image");
    expect(image).not.toBeNull();
    expect(image!.getAttribute("href")).toBe(`http://localhost:8787/assets/${HASH}`);
    expect(image!.getAttribute("width")).toBe("100");
    expect(image!.getAttribute("height")).toBe("50");
    expect(container.querySelector("rect")).toBeNull();
  });

  it("overlays the tint on uploaded stamps", () => {
    const { container } = renderPreview(uploadStamp("#ff0000"));
    const overlay = container.querySelector("rect");
    expect(overlay).not.toBeNull();
    expect(overlay!.getAttribute("fill")).toBe("#ff0000");
  });

  it("renders on-grid uploaded tiles as images, never fused terrain", () => {
    const element: TileElement = {
      ...tile("uploaded", 0, 0, { assetId: `upload:${HASH}` }),
    };
    const occupancy = new Map([
      ["0,0", `upload:${HASH}`],
      ["1,0", `upload:${HASH}`],
    ]);
    const { container } = renderPreview(element, occupancy);
    expect(container.querySelector("image")).not.toBeNull();
    expect(container.querySelector("path")).toBeNull();
  });
});

describe("MapStudioElementPreview autotiling", () => {
  it("renders fused terrain with boundary-only borders when occupancy is provided", () => {
    const left = tile("left", 0, 0);
    const occupancy = new Map([
      ["0,0", "terrain:stone-floor"],
      ["1,0", "terrain:stone-floor"],
    ]);

    const { container } = renderPreview(left, occupancy);

    const rect = container.querySelector("rect");
    expect(rect).not.toBeNull();
    expect(rect!.getAttribute("stroke")).toBeNull();

    const boundary = container.querySelector("path");
    expect(boundary).not.toBeNull();
    const d = boundary!.getAttribute("d")!;
    expect(d).toContain("M 0 0 H 50"); // top border against empty space
    expect(d).not.toContain("M 50 0 V 50"); // right edge fused with neighbor
    expect(boundary!.getAttribute("stroke")).toBe(
      getMapStudioTileAsset("terrain:stone-floor").stroke,
    );
  });

  it("renders no boundary path for a fully surrounded tile", () => {
    const center = tile("center", 50, 50);
    const occupancy = new Map([
      ["1,1", "terrain:stone-floor"],
      ["1,0", "terrain:stone-floor"],
      ["1,2", "terrain:stone-floor"],
      ["0,1", "terrain:stone-floor"],
      ["2,1", "terrain:stone-floor"],
    ]);

    const { container } = renderPreview(center, occupancy);

    expect(container.querySelector("rect")).not.toBeNull();
    expect(container.querySelector("path")).toBeNull();
  });

  it("keeps the outlined per-tile look when no occupancy is provided", () => {
    const { container } = renderPreview(tile("lone", 0, 0));

    const rect = container.querySelector("rect");
    expect(rect!.getAttribute("stroke")).toBe(getMapStudioTileAsset("terrain:stone-floor").stroke);
  });

  it("keeps the outlined look for transformed tiles that cannot autotile", () => {
    const rotated = tile("rotated", 0, 0, { rotation: 90 });
    const occupancy = new Map([["0,0", "terrain:stone-floor"]]);

    const { container } = renderPreview(rotated, occupancy);

    const rect = container.querySelector("rect");
    expect(rect!.getAttribute("stroke")).toBe(getMapStudioTileAsset("terrain:stone-floor").stroke);
  });

  it("rotates footprint elements around their visual center", () => {
    const stamp: MapElement = {
      id: "crate",
      type: "stamp",
      layerId: "objects",
      locked: false,
      hidden: false,
      transform: { x: 40, y: 40, scaleX: 1, scaleY: 1, rotation: 15 },
      data: { assetId: "objects:crate", width: 50, height: 50 },
    };

    const { container } = renderPreview(stamp);

    expect(container.querySelector("g")?.getAttribute("transform")).toBe(
      "translate(40 40) rotate(15 25 25) scale(1 1)",
    );
  });

  it("keeps the outlined look for off-lattice tiles instead of re-binning them", () => {
    const floating = tile("floating", 74, 0);
    const occupancy = new Map([["0,0", "terrain:stone-floor"]]);

    const { container } = renderPreview(floating, occupancy);

    const rect = container.querySelector("rect");
    expect(rect!.getAttribute("stroke")).toBe(getMapStudioTileAsset("terrain:stone-floor").stroke);
  });
});
