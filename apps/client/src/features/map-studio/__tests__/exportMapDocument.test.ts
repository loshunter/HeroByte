import { afterEach, describe, expect, it, vi } from "vitest";
import { addMapElement, createMapDocument } from "@herobyte/shared";
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
