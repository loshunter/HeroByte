/**
 * The custom-token image pipeline. jsdom has no 2D canvas and no image
 * decoding, so the canvas/Image/upload road is injected here and proved for
 * real in e2e; what this suite pins is the RULES — which pictures are worked
 * on at all, and that every step is allowed to fail without losing the token.
 */

import { describe, expect, it, vi } from "vitest";
import {
  CUSTOM_THUMB_SIDE,
  classifyCustomImage,
  prepareCustomImage,
  type PrepareDeps,
} from "../customTokenImages";
import { AssetUploadError } from "../../../map-studio/uploads/assetUpload";

const HASH = "a".repeat(64);
const LINK = "https://i.imgur.com/abc123.png";
const image = { naturalWidth: 512, naturalHeight: 512 } as HTMLImageElement;

function deps(overrides: Partial<PrepareDeps> = {}) {
  return {
    loadImage: vi.fn(async () => image),
    toPngBlob: vi.fn(async () => new Blob(["png"], { type: "image/png" })),
    upload: vi.fn(async (_blob: Blob, name: string) => ({ url: `/assets/${name}-${HASH}` })),
    ...overrides,
  } satisfies PrepareDeps;
}

describe("classifyCustomImage", () => {
  it("knows pack art, this table's own uploads, and somebody else's link apart", () => {
    expect(classifyCustomImage("/tokens/NPC/Enemies/Goblins/goblinClub.png")).toBe("pack");
    expect(classifyCustomImage("https://herobyte.pages.dev/tokens/NPC/x.png")).toBe("pack");
    expect(classifyCustomImage(`/assets/${HASH}`)).toBe("ours");
    // An upload's real URL carries the SERVER's origin, which is not the
    // client's on any deployment — the content hash is what identifies it.
    expect(classifyCustomImage(`http://localhost:8788/assets/${HASH}`)).toBe("ours");
    expect(classifyCustomImage(`https://herobyte-server.onrender.com/assets/${HASH}`)).toBe("ours");
    expect(classifyCustomImage(LINK)).toBe("external");
    expect(classifyCustomImage("https://media.discordapp.net/attachments/1/2/x.png")).toBe(
      "external",
    );
  });
});

describe("prepareCustomImage", () => {
  it("renders an 84px thumb for a link, from one load", async () => {
    const d = deps();
    const result = await prepareCustomImage(LINK, d);

    expect(result).toEqual({ imageUrl: LINK, thumbUrl: `/assets/token-thumb.png-${HASH}` });
    expect(d.loadImage).toHaveBeenCalledTimes(1);
    expect(d.loadImage).toHaveBeenCalledWith(LINK);
    expect(d.toPngBlob).toHaveBeenCalledWith(image, CUSTOM_THUMB_SIDE);
  });

  it("thumbs an upload of ours too — a 4000px phone photo is the worst grid cell", async () => {
    const d = deps();
    const result = await prepareCustomImage(`http://localhost:8788/assets/${HASH}`, d);

    expect(result.thumbUrl).toBe(`/assets/token-thumb.png-${HASH}`);
    expect(result.imageUrl).toBe(`http://localhost:8788/assets/${HASH}`);
  });

  it("leaves pack art alone — it already ships an 84px tier", async () => {
    const d = deps();
    const src = "/tokens/NPC/Enemies/Goblins/goblinClub.png";
    expect(await prepareCustomImage(src, d)).toEqual({ imageUrl: src });
    expect(d.loadImage).not.toHaveBeenCalled();
    expect(d.upload).not.toHaveBeenCalled();
  });

  it("keeps the link when the image cannot be read at all", async () => {
    // What a host with no Access-Control-Allow-Origin actually does under
    // crossOrigin="anonymous": the load fails outright.
    const d = deps({ loadImage: vi.fn(async () => Promise.reject(new Error("blocked"))) });
    const result = await prepareCustomImage("https://media.discordapp.net/a/b/c.png", d);

    expect(result.imageUrl).toBe("https://media.discordapp.net/a/b/c.png");
    expect(result.thumbUrl).toBeUndefined();
    expect(result.note).toMatch(/could not be read/i);
    expect(d.upload).not.toHaveBeenCalled();
  });

  it("keeps the link when the canvas is tainted", async () => {
    const securityError = new Error("Tainted canvases may not be exported.");
    securityError.name = "SecurityError";
    const d = deps({ toPngBlob: vi.fn(async () => Promise.reject(securityError)) });
    const result = await prepareCustomImage(LINK, d);

    expect(result).toEqual({ imageUrl: LINK, note: expect.stringMatching(/could not be read/i) });
  });

  it("keeps the link when the table's quota refuses the thumb, and says so", async () => {
    const d = deps({
      upload: vi.fn(async () =>
        Promise.reject(
          new AssetUploadError("quota-exceeded", "The table's asset storage is full."),
        ),
      ),
    });
    const result = await prepareCustomImage(LINK, d);

    expect(result.imageUrl).toBe(LINK);
    expect(result.thumbUrl).toBeUndefined();
    expect(result.note).toBe("No thumbnail — The table's asset storage is full.");
  });

  it("never rejects: an empty image is simply handed back", async () => {
    await expect(prepareCustomImage("   ", deps())).resolves.toEqual({ imageUrl: "" });
  });
});
