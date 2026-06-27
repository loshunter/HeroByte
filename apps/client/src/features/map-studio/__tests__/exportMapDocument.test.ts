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
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (callback, type) {
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
