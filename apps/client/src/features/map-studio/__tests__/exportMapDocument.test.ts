import { afterEach, describe, expect, it, vi } from "vitest";
import { addMapElement, createMapDocument, paintTerrain } from "@herobyte/shared";
import {
  createMapDocumentSvgDataUrl,
  rasterizeMapDocument,
  renderMapDocumentSvg,
  serializeMapDocument,
} from "../exportMapDocument";

describe("Map Studio export", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates a lossless, readable JSON backup", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 10 });
    const exported = serializeMapDocument(document);

    expect(JSON.parse(exported)).toEqual(document);
    expect(exported).toContain('\n  "schemaVersion"');
  });

  it("renders visible geometry and escapes authored text in portable SVG", () => {
    let document = createMapDocument({ id: "map", name: "Keep & <Crypt>", timestamp: 10 });
    document = addMapElement(
      document,
      {
        id: "room",
        type: "shape",
        layerId: "terrain",
        locked: false,
        hidden: false,
        transform: { x: 50, y: 60, scaleX: 1, scaleY: 1, rotation: 15 },
        data: {
          shape: "rectangle",
          points: [
            { x: 0, y: 0 },
            { x: 200, y: 120 },
          ],
          fill: "#333333",
          stroke: "#ffffff",
          strokeWidth: 4,
          opacity: 1,
        },
      },
      20,
    );
    document = addMapElement(
      document,
      {
        id: "label",
        type: "text",
        layerId: "notes",
        locked: false,
        hidden: false,
        transform: { x: 10, y: 20, scaleX: 1, scaleY: 1, rotation: 0 },
        data: { text: "Treasure <here>", color: "#ffcc00", fontSize: 24, visibleToPlayers: true },
      },
      30,
    );

    const svg = renderMapDocumentSvg(document);
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="2048"');
    expect(svg).toContain("Keep &amp; &lt;Crypt&gt;");
    expect(svg).toContain('transform="translate(50 60) rotate(15) scale(1 1)"');
    expect(svg).toContain("Treasure &lt;here&gt;");
    expect(svg).not.toContain("Treasure <here>");
  });

  it("omits hidden elements and invisible layers", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 10 });
    document.elements.push({
      id: "secret",
      type: "text",
      layerId: "notes",
      locked: false,
      hidden: true,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      data: { text: "Do not export", color: "#fff", fontSize: 12, visibleToPlayers: false },
    });
    document.layers.find((layer) => layer.id === "terrain")!.visible = false;

    expect(renderMapDocumentSvg(document)).not.toContain("Do not export");
  });

  describe("terrain boundary autotiling", () => {
    function tile(id: string, x: number, y: number, assetId = "terrain:stone-floor") {
      return {
        id,
        type: "tile" as const,
        layerId: "terrain",
        locked: false,
        hidden: false,
        transform: { x, y, scaleX: 1, scaleY: 1, rotation: 0 },
        data: { assetId, columns: 1, rows: 1 },
      };
    }

    it("draws no border on the shared edge between same-terrain tiles", () => {
      let document = createMapDocument({ id: "map", name: "Keep", timestamp: 10 });
      document = addMapElement(document, tile("a", 0, 0), 20);
      document = addMapElement(document, tile("b", 50, 0), 21);

      const svg = renderMapDocumentSvg(document);

      // Tile "a" borders: top, bottom, left — but NOT its right edge (x=50).
      const tileA = svg.match(/<g transform="translate\(0 0\)[^>]*>.*?<\/g>/)?.[0] ?? "";
      expect(tileA).toContain("M 0 0 H 50"); // top
      expect(tileA).toContain("M 0 50 H 50"); // bottom
      expect(tileA).toContain("M 0 0 V 50"); // left
      expect(tileA).not.toContain("M 50 0 V 50"); // right edge fused
    });

    it("draws a border where terrains differ", () => {
      let document = createMapDocument({ id: "map", name: "Keep", timestamp: 10 });
      document = addMapElement(document, tile("a", 0, 0), 20);
      document = addMapElement(document, tile("b", 50, 0, "terrain:water"), 21);

      const svg = renderMapDocumentSvg(document);

      const tileA = svg.match(/<g transform="translate\(0 0\)[^>]*>.*?<\/g>/)?.[0] ?? "";
      expect(tileA).toContain("M 50 0 V 50"); // right edge shows against water
    });

    it("renders off-lattice tiles outlined instead of fusing across a gap", () => {
      // Snap-off repro: x=74 rounds to cell 1, but the tile really sits 24px
      // away from the tile at x=0 — neither edge may be suppressed.
      let document = createMapDocument({ id: "map", name: "Keep", timestamp: 10 });
      document = addMapElement(document, tile("anchored", 0, 0), 20);
      document = addMapElement(document, tile("floating", 74, 0), 21);

      const svg = renderMapDocumentSvg(document);

      const anchored = svg.match(/<g transform="translate\(0 0\)[^>]*>.*?<\/g>/)?.[0] ?? "";
      expect(anchored).toContain("M 50 0 V 50"); // right border kept — no false fuse
      const floating = svg.match(/<g transform="translate\(74 0\)[^>]*>.*?<\/g>/)?.[0] ?? "";
      expect(floating).toContain("stroke="); // outlined island, not boundary-fused
    });

    it("rotates tiles and stamps around their center in the export", () => {
      let document = createMapDocument({ id: "map", name: "Keep", timestamp: 10 });
      const rotated = tile("spun", 100, 100);
      rotated.transform.rotation = 90;
      document = addMapElement(document, rotated, 20);

      const svg = renderMapDocumentSvg(document);

      expect(svg).toContain('transform="translate(100 100) rotate(90 25 25) scale(1 1)"');
    });

    it("outlines an isolated tile on all four sides", () => {
      let document = createMapDocument({ id: "map", name: "Keep", timestamp: 10 });
      document = addMapElement(document, tile("lone", 100, 100), 20);

      const svg = renderMapDocumentSvg(document);
      const lone = svg.match(/<g transform="translate\(100 100\)[^>]*>.*?<\/g>/)?.[0] ?? "";
      expect(lone).toContain("M 0 0 H 50");
      expect(lone).toContain("M 0 50 H 50");
      expect(lone).toContain("M 0 0 V 50");
      expect(lone).toContain("M 50 0 V 50");
    });
  });

  describe("painted terrain export", () => {
    it("renders terrain beneath elements with per-family fill and fused boundaries", () => {
      let document = createMapDocument({ id: "map", name: "Keep", timestamp: 10 });
      document = paintTerrain(
        document,
        [
          { x: 0, y: 0, assetId: "terrain:stone-floor" },
          { x: 1, y: 0, assetId: "terrain:stone-floor" },
          { x: 2, y: 0, assetId: "terrain:water" },
        ],
        20,
      );
      document = addMapElement(
        document,
        {
          id: "crate",
          type: "stamp",
          layerId: "objects",
          locked: false,
          hidden: false,
          transform: { x: 10, y: 10, scaleX: 1, scaleY: 1, rotation: 0 },
          data: { assetId: "objects:crate", width: 50, height: 50 },
        },
        30,
      );

      const svg = renderMapDocumentSvg(document);

      const stone = svg.match(/<g[^>]*data-terrain="terrain:stone-floor".*?<\/g>/)?.[0] ?? "";
      expect(stone).toContain("M 0 0 h 50 v 50 h -50 Z");
      expect(stone).not.toContain("M 50 0 V 50"); // fused stone seam
      expect(stone).toContain("M 100 0 V 50"); // border against water
      // Terrain markup precedes element markup: ground renders underneath.
      expect(svg.indexOf("data-terrain")).toBeLessThan(svg.indexOf("data-asset-id"));
    });

    it("keeps terrain intact beneath elements on hidden layers", () => {
      let document = createMapDocument({ id: "map", name: "Keep", timestamp: 10 });
      document = paintTerrain(
        document,
        [
          { x: 0, y: 0, assetId: "terrain:grass" },
          { x: 1, y: 0, assetId: "terrain:grass" },
        ],
        20,
      );
      document = addMapElement(
        document,
        {
          id: "wall",
          type: "tile",
          layerId: "walls",
          locked: false,
          hidden: false,
          transform: { x: 50, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
          data: { assetId: "structures:stone-wall", columns: 1, rows: 1 },
        },
        30,
      );
      document.layers = document.layers.map((layer) =>
        layer.id === "walls" ? { ...layer, visible: false } : layer,
      );

      const svg = renderMapDocumentSvg(document);
      const grass = svg.match(/<g[^>]*data-terrain="terrain:grass".*?<\/g>/)?.[0] ?? "";

      // The invisible wall must not punch a hole at cell (1,0).
      expect(grass).toContain("M 50 0 h 50 v 50 h -50 Z");
      expect(svg).not.toContain("structures:stone-wall");
    });

    it("omits terrain when the terrain-kind layer is hidden", () => {
      let document = createMapDocument({ id: "map", name: "Keep", timestamp: 10 });
      document = paintTerrain(document, [{ x: 0, y: 0, assetId: "terrain:water" }], 20);
      document.layers = document.layers.map((layer) =>
        layer.kind === "terrain" ? { ...layer, visible: false } : layer,
      );

      expect(renderMapDocumentSvg(document)).not.toContain("data-terrain");
    });
  });

  it("creates an SVG data URL for publishing to the live scene", () => {
    const document = createMapDocument({ id: "map", name: "Keep & Crypt", timestamp: 10 });

    const dataUrl = createMapDocumentSvgDataUrl(document);

    expect(dataUrl).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(decodeURIComponent(dataUrl.split(",")[1]!)).toContain("Keep &amp; Crypt");
  });

  it("rasterizes a map document through canvas for PNG and WebP export", async () => {
    const document = createMapDocument({
      id: "map",
      name: "Keep",
      width: 320,
      height: 160,
      timestamp: 10,
    });
    const drawImage = vi.fn();
    const createObjectURL = vi.fn(() => "blob:map-svg");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
      this: HTMLCanvasElement,
      callback,
      type,
    ) {
      expect(this.width).toBe(320);
      expect(this.height).toBe(160);
      callback(new Blob(["raster"], { type: type ?? "image/png" }));
    });
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;

        set src(_value: string) {
          this.onload?.();
        }
      },
    );

    const png = await rasterizeMapDocument(document, "image/png");
    const webp = await rasterizeMapDocument(document, "image/webp");

    expect(png.type).toBe("image/png");
    expect(webp.type).toBe("image/webp");
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:map-svg");
  });
});
