import { afterEach, describe, expect, it, vi } from "vitest";
import { addMapElement, createMapDocument, paintTerrain, type MapDocument } from "@herobyte/shared";
import {
  MAX_PUBLISH_BACKGROUND_BYTES,
  backgroundExceedsPublishLimit,
  createMapDocumentSvgDataUrl,
  createMapDocumentSvgDataUrlWithAssets,
  rasterizeMapDocument,
  renderMapDocumentSvg,
  serializeMapDocument,
} from "../exportMapDocument";
import { createRecordingContext } from "../../render/__tests__/recordingContext";
import { __resetTileAtlasForTests } from "../../render/tileAtlas";

// The procedural field bake needs a real 2D canvas (putImageData); the raster
// tests mock it and assert the underlay blits whatever it returns. `result` is
// set per test — null means "the field declined to bake" (fall back to core).
const bakeHolder = vi.hoisted(() => ({
  result: null as null | {
    canvas: unknown;
    originX: number;
    originY: number;
    width: number;
    height: number;
  },
}));
vi.mock("../../render/proceduralTerrainSurface", () => ({
  bakeProceduralTerrain: () => bakeHolder.result,
}));

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

  it("omits secret doors so a hidden passage never bakes into the player-visible map", () => {
    let document = createMapDocument({ id: "map", name: "Keep", timestamp: 10 });
    document = addMapElement(
      document,
      {
        id: "front-door",
        type: "door",
        layerId: "walls",
        locked: false,
        hidden: false,
        transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0 },
        data: { width: 50, state: "closed", blocksMovement: true, blocksVision: true },
      },
      20,
    );
    document = addMapElement(
      document,
      {
        id: "hidden-passage",
        type: "door",
        layerId: "walls",
        locked: false,
        hidden: false,
        transform: { x: 300, y: 300, scaleX: 1, scaleY: 1, rotation: 0 },
        data: { width: 50, state: "secret", blocksMovement: true, blocksVision: true },
      },
      21,
    );

    const svg = renderMapDocumentSvg(document);
    // Ordinary doors bake in — players are meant to see them.
    expect(svg).toContain("translate(100 100)");
    // A secret door must NOT: its compiledScene counterpart is role-stripped for
    // players, but mapBackground is broadcast to everyone unfiltered.
    expect(svg).not.toContain("translate(300 300)");
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

    it("keeps terrain beneath uploaded image tiles (transparent uploads show ground, not void)", () => {
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
          id: "decal",
          type: "tile",
          layerId: "objects",
          locked: false,
          hidden: false,
          transform: { x: 50, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
          data: { assetId: `upload:${"e".repeat(64)}`, columns: 1, rows: 1 },
        },
        30,
      );

      const svg = renderMapDocumentSvg(document);
      const grass = svg.match(/<g[^>]*data-terrain="terrain:grass".*?<\/g>/)?.[0] ?? "";

      // The upload claims no autotile cell: terrain fills beneath it and the
      // two grass cells stay fused (no seam under the image's edge).
      expect(grass).toContain("M 50 0 h 50 v 50 h -50 Z");
      expect(grass).not.toContain("M 50 0 V 50");
      // The image itself still renders above the terrain.
      expect(svg).toContain("<image");
      expect(svg.indexOf("data-terrain")).toBeLessThan(svg.indexOf("<image"));
    });
  });

  describe("elements-only publish render (R5)", () => {
    function documentWithTerrainAndCrate() {
      let document = createMapDocument({ id: "map", name: "Keep", timestamp: 10 });
      document = paintTerrain(document, [{ x: 0, y: 0, assetId: "terrain:water" }], 20);
      return addMapElement(
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
    }

    it("omits background, grid, and terrain while keeping elements", () => {
      const svg = renderMapDocumentSvg(documentWithTerrainAndCrate(), undefined, {
        omitTerrain: true,
        omitGrid: true,
        transparentBackground: true,
      });

      expect(svg).not.toContain('fill="#24212b"');
      expect(svg).not.toContain("url(#grid)");
      expect(svg).not.toContain("data-terrain");
      expect(svg).toContain('data-asset-id="objects:crate"');
    });

    it("changes nothing when no options are passed (byte parity)", () => {
      const document = documentWithTerrainAndCrate();
      expect(renderMapDocumentSvg(document)).toBe(renderMapDocumentSvg(document, undefined, {}));
    });

    it("forwards render options through the publish data-URL path", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const dataUrl = await createMapDocumentSvgDataUrlWithAssets(documentWithTerrainAndCrate(), {
        omitTerrain: true,
        omitGrid: true,
        transparentBackground: true,
      });

      const svg = decodeURIComponent(dataUrl.split(",").slice(1).join(","));
      expect(svg).not.toContain("data-terrain");
      expect(svg).not.toContain('fill="#24212b"');
      expect(svg).toContain('data-asset-id="objects:crate"');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("uploaded image assets", () => {
    const HASH = "d".repeat(64);
    const UPLOAD_URL = `http://localhost:8787/assets/${HASH}`;

    function documentWithUploadStamp(): MapDocument {
      const document = createMapDocument({ id: "map", name: "Keep", timestamp: 10 });
      return addMapElement(
        document,
        {
          id: "torch",
          type: "stamp",
          layerId: "objects",
          locked: false,
          hidden: false,
          transform: { x: 100, y: 80, scaleX: 1, scaleY: 1, rotation: 0 },
          data: { assetId: `upload:${HASH}`, width: 100, height: 50 },
        },
        20,
      );
    }

    it("renders uploaded stamps as image references in portable SVG", () => {
      const svg = renderMapDocumentSvg(documentWithUploadStamp());
      expect(svg).toContain(`<image href="${UPLOAD_URL}" width="100" height="50"`);
    });

    it("inlines uploaded images as data URIs for the publish background", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const dataUrl = await createMapDocumentSvgDataUrlWithAssets(documentWithUploadStamp());

      expect(fetchMock).toHaveBeenCalledWith(UPLOAD_URL);
      const svg = decodeURIComponent(dataUrl.split(",").slice(1).join(","));
      expect(svg).toContain('href="data:image/png;base64,AQID"');
      expect(svg).not.toContain(`href="${UPLOAD_URL}"`);
    });

    it("clamps a surprising asset content-type to a safe image type", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const dataUrl = await createMapDocumentSvgDataUrlWithAssets(documentWithUploadStamp());

      const svg = decodeURIComponent(dataUrl.split(",").slice(1).join(","));
      expect(svg).toContain('href="data:image/png;base64,AQID"');
      expect(svg).not.toContain("text/html");
    });

    it("flags a publish whose inlined images exceed the 1MB message cap", async () => {
      const big = new Uint8Array(900 * 1024); // ~1.2MB once base64-encoded
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          new Response(big, { status: 200, headers: { "content-type": "image/png" } }),
        );
      vi.stubGlobal("fetch", fetchMock);

      const dataUrl = await createMapDocumentSvgDataUrlWithAssets(documentWithUploadStamp());
      expect(backgroundExceedsPublishLimit(dataUrl)).toBe(true);
    });

    it("falls back to the remote reference when an asset fetch fails", async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response("gone", { status: 404 }));
      vi.stubGlobal("fetch", fetchMock);

      const dataUrl = await createMapDocumentSvgDataUrlWithAssets(documentWithUploadStamp());

      const svg = decodeURIComponent(dataUrl.split(",").slice(1).join(","));
      expect(svg).toContain(`href="${UPLOAD_URL}"`);
    });

    it("does not fetch anything for documents without uploads", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const document = createMapDocument({ id: "map", name: "Keep", timestamp: 10 });

      await createMapDocumentSvgDataUrlWithAssets(document);

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("backgroundExceedsPublishLimit", () => {
    it("passes a small background and rejects one over the cap", () => {
      expect(backgroundExceedsPublishLimit("data:image/svg+xml,tiny")).toBe(false);
      expect(backgroundExceedsPublishLimit("x".repeat(MAX_PUBLISH_BACKGROUND_BYTES + 1))).toBe(
        true,
      );
    });

    it("stays safely under the server's 1MB inbound message cap", () => {
      expect(MAX_PUBLISH_BACKGROUND_BYTES).toBeLessThan(1024 * 1024);
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

describe("Map Studio raster composite (R4b)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    __resetTileAtlasForTests();
    bakeHolder.result = null;
  });

  // Stub the browser surface rasterizeMapDocument touches and record every
  // 2D-context call. The prototype getContext spy backs the export canvas AND
  // the offscreen fade canvas, so both draw into one ordered call log.
  function stubRasterEnv() {
    const recording = createRecordingContext();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:map-svg"),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        set src(_value: string) {
          this.onload?.();
        }
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      recording.context as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
      type?: string,
    ) {
      callback(new Blob(["raster"], { type: type ?? "image/png" }));
    });
    return recording.calls;
  }

  function grassMap(): MapDocument {
    const document = createMapDocument({
      id: "map",
      name: "Keep",
      width: 200,
      height: 200,
      timestamp: 10,
    });
    return paintTerrain(document, [{ x: 0, y: 0, assetId: "terrain:grass" }], 20);
  }

  it("composites the procedural field bake beneath the elements-only SVG", async () => {
    __resetTileAtlasForTests();
    // Grass/dirt/path now bake procedurally rather than texturing from the atlas
    // (Slice 3). The bake is mocked; assert the underlay blits its canvas, then
    // the elements-only SVG blits last, on top.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 404 })));
    // Non-zero world origin (the bake's 1-cell bleed margin can go negative) so
    // the blit's DEST coords are pinned, not just the source-canvas identity.
    const baked = {
      canvas: {} as HTMLCanvasElement,
      originX: -50,
      originY: -50,
      width: 300,
      height: 300,
    };
    bakeHolder.result = baked;
    const calls = stubRasterEnv();

    await rasterizeMapDocument(grassMap(), "image/png");

    // The baked field blits at its world origin: the full source canvas maps to
    // dest (originX, originY, width, height) on the identity-transform export canvas.
    const fieldBlit = calls.find((c) => c[0] === "drawImage" && c[1] === baked.canvas);
    expect(fieldBlit).toEqual(["drawImage", baked.canvas, 0, 0, 300, 300, -50, -50, 300, 300]);
    // Grass rides the field, not a flat core fill, when the bake succeeds (field
    // families are excluded from the core drawTerrain).
    expect(calls).not.toContainEqual(["set:fillStyle", "#386820"]);
    // Elements-only SVG blits last, on top: drawImage(image, 0, 0).
    const fieldBlitIndex = calls.findIndex((c) => c[0] === "drawImage" && c[1] === baked.canvas);
    const svgBlit = calls.findIndex(
      (c) => c[0] === "drawImage" && c.length === 4 && c[2] === 0 && c[3] === 0,
    );
    expect(fieldBlitIndex).toBeGreaterThanOrEqual(0);
    expect(svgBlit).toBeGreaterThan(fieldBlitIndex);
  });

  it("keeps the single-pass flat SVG raster for terrain-free maps", async () => {
    __resetTileAtlasForTests();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const calls = stubRasterEnv();
    const document = createMapDocument({
      id: "map",
      name: "Keep",
      width: 200,
      height: 200,
      timestamp: 10,
    });

    await rasterizeMapDocument(document, "image/png");

    // Behaves as before: the full SVG (background+grid+terrain baked in) is the
    // only draw — no canvas compositing, and the atlas is never fetched.
    const draws = calls.filter((c) => c[0] === "drawImage");
    expect(draws).toEqual([["drawImage", expect.anything(), 0, 0]]);
    expect(calls.some((c) => c[0] === "fillRect")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bakes no grid when omitGrid is set — the live table draws its own grid", async () => {
    __resetTileAtlasForTests();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 404 })));
    bakeHolder.result = {
      canvas: {} as HTMLCanvasElement,
      originX: 0,
      originY: 0,
      width: 200,
      height: 200,
    };
    const calls = stubRasterEnv();

    await rasterizeMapDocument(grassMap(), "image/png", { omitGrid: true });

    // drawGrid is the only thing that strokes the lattice colour; with omitGrid
    // the underlay never reaches it, so the published raster carries no grid.
    expect(calls).not.toContainEqual(["set:strokeStyle", "#ffffff"]);
  });

  it("still bakes the grid for the download path (no omitGrid)", async () => {
    __resetTileAtlasForTests();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 404 })));
    bakeHolder.result = {
      canvas: {} as HTMLCanvasElement,
      originX: 0,
      originY: 0,
      width: 200,
      height: 200,
    };
    const calls = stubRasterEnv();

    await rasterizeMapDocument(grassMap(), "image/png");

    expect(calls).toContainEqual(["set:strokeStyle", "#ffffff"]);
  });

  it("falls back to the flat core render when the field declines to bake", async () => {
    __resetTileAtlasForTests();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 404 })));
    bakeHolder.result = null; // e.g. no field families, or over the bake size cap
    const calls = stubRasterEnv();

    await rasterizeMapDocument(grassMap(), "image/png");

    // Bake declined → every family (grass included) renders through the core; the
    // atlas is null on 404, so grass paints its flat fill and the export succeeds.
    expect(calls).toContainEqual(["set:fillStyle", "#386820"]);
    expect(calls).toContainEqual(["fillRect", 0, 0, 50, 50]);
    const textureDraws = calls.filter((c) => c[0] === "drawImage" && c.length > 4);
    expect(textureDraws).toEqual([]);
  });

  it("composites translucent terrain via an offscreen group flatten-then-fade", async () => {
    __resetTileAtlasForTests();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 404 })));
    const baked = {
      canvas: {} as HTMLCanvasElement,
      originX: 0,
      originY: 0,
      width: 200,
      height: 200,
    };
    bakeHolder.result = baked;
    const calls = stubRasterEnv();
    const base = grassMap();
    const document: MapDocument = {
      ...base,
      layers: base.layers.map((layer) =>
        layer.kind === "terrain" ? { ...layer, opacity: 0.5 } : layer,
      ),
    };

    await rasterizeMapDocument(document, "image/png");

    // The whole terrain group flattens opaquely onto the offscreen (the field
    // blits at full alpha), THEN blits once at the layer alpha — never
    // per-primitive alpha, which would tint boundary strokes.
    const fieldBlit = calls.findIndex((c) => c[0] === "drawImage" && c[1] === baked.canvas);
    const alpha = calls.findIndex((c) => c[0] === "set:globalAlpha" && c[1] === 0.5);
    const fadeBlit = calls.findIndex(
      (c, index) =>
        index > alpha && c[0] === "drawImage" && c.length === 4 && c[2] === 0 && c[3] === 0,
    );
    expect(fieldBlit).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeGreaterThan(fieldBlit); // flatten opaquely, then fade
    expect(fadeBlit).toBeGreaterThan(alpha);
  });
});
