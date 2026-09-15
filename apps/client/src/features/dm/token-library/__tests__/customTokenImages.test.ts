/**
 * The custom-token image pipeline. jsdom has no 2D canvas and no image
 * decoding, so the canvas/Image/upload road is injected here and proved for
 * real in e2e; what this suite pins is the RULES — which pictures are worked
 * on at all, and that every step is allowed to fail without losing the token.
 */

import { describe, expect, it, vi } from "vitest";
import {
  CUSTOM_MIRROR_MAX_SIDE,
  CUSTOM_THUMB_SIDE,
  classifyCustomImage,
  prepareCustomImage,
  type PrepareDeps,
} from "../customTokenImages";
import { AssetUploadError } from "../../../map-studio/uploads/assetUpload";

const HASH = "a".repeat(64);
const LINK = "https://i.imgur.com/abc123.png";
const image = { naturalWidth: 512, naturalHeight: 512 } as HTMLImageElement;
const MIRROR = { mirror: true };
const NO_MIRROR = { mirror: false };

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
  it("renders an 84px thumb for a link, from one load, and keeps the link", async () => {
    const d = deps();
    const result = await prepareCustomImage(LINK, NO_MIRROR, d);

    expect(result).toEqual({
      imageUrl: LINK,
      thumbUrl: `/assets/token-thumb.png-${HASH}`,
      mirrored: false,
    });
    expect(d.loadImage).toHaveBeenCalledTimes(1);
    expect(d.loadImage).toHaveBeenCalledWith(LINK);
    expect(d.toPngBlob).toHaveBeenCalledWith(image, CUSTOM_THUMB_SIDE);
  });

  it("with the copy on, the token's picture becomes this table's — from ONE load", async () => {
    const d = deps();
    const result = await prepareCustomImage(LINK, MIRROR, d);

    expect(result).toEqual({
      imageUrl: `/assets/token.png-${HASH}`,
      thumbUrl: `/assets/token-thumb.png-${HASH}`,
      mirrored: true,
    });
    // One decode, two renders: the copy at the pack's master size and the
    // thumbnail, in that order.
    expect(d.loadImage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(d.toPngBlob).mock.calls.map(([, side]) => side)).toEqual([
      CUSTOM_MIRROR_MAX_SIDE,
      CUSTOM_THUMB_SIDE,
    ]);
  });

  it("when the copy fails the LINK survives, and the thumbnail is still made", async () => {
    // Exactly the promise the checkbox's helper line makes.
    const upload = vi
      .fn()
      .mockRejectedValueOnce(new AssetUploadError("too-large", "That image is over the 5MB limit."))
      .mockResolvedValueOnce({ url: `/assets/token-thumb.png-${HASH}` });
    const result = await prepareCustomImage(LINK, MIRROR, deps({ upload }));

    expect(result.imageUrl).toBe(LINK);
    expect(result.mirrored).toBe(false);
    expect(result.thumbUrl).toBe(`/assets/token-thumb.png-${HASH}`);
    expect(result.note).toBe(
      "No copy was made, so the link stays: That image is over the 5MB limit.",
    );
  });

  it("thumbs an upload of ours too — a 4000px phone photo is the worst grid cell", async () => {
    const d = deps();
    const result = await prepareCustomImage(`http://localhost:8788/assets/${HASH}`, MIRROR, d);

    expect(result.thumbUrl).toBe(`/assets/token-thumb.png-${HASH}`);
    // Already ours: never re-uploaded, whatever the checkbox says.
    expect(result.imageUrl).toBe(`http://localhost:8788/assets/${HASH}`);
    expect(result.mirrored).toBe(false);
    expect(d.upload).toHaveBeenCalledTimes(1);
  });

  it("leaves pack art alone — it already ships an 84px tier", async () => {
    const d = deps();
    const src = "/tokens/NPC/Enemies/Goblins/goblinClub.png";
    expect(await prepareCustomImage(src, NO_MIRROR, d)).toEqual({ imageUrl: src, mirrored: false });
    expect(d.loadImage).not.toHaveBeenCalled();
    expect(d.upload).not.toHaveBeenCalled();
  });

  it("keeps the link when the image cannot be read at all", async () => {
    // What a host with no Access-Control-Allow-Origin actually does under
    // crossOrigin="anonymous": the load fails outright.
    const d = deps({ loadImage: vi.fn(async () => Promise.reject(new Error("blocked"))) });
    const result = await prepareCustomImage("https://media.discordapp.net/a/b/c.png", MIRROR, d);

    expect(result.imageUrl).toBe("https://media.discordapp.net/a/b/c.png");
    expect(result.thumbUrl).toBeUndefined();
    expect(result.note).toMatch(/could not be read/i);
    expect(d.upload).not.toHaveBeenCalled();
  });

  it("keeps the link when the canvas is tainted", async () => {
    const securityError = new Error("Tainted canvases may not be exported.");
    securityError.name = "SecurityError";
    const d = deps({ toPngBlob: vi.fn(async () => Promise.reject(securityError)) });
    const result = await prepareCustomImage(LINK, NO_MIRROR, d);

    expect(result).toEqual({
      imageUrl: LINK,
      mirrored: false,
      note: expect.stringMatching(/No thumbnail/i),
    });
  });

  it("keeps the link when the table's quota refuses the thumb, and says so", async () => {
    const d = deps({
      upload: vi.fn(async () =>
        Promise.reject(
          new AssetUploadError("quota-exceeded", "The table's asset storage is full."),
        ),
      ),
    });
    const result = await prepareCustomImage(LINK, NO_MIRROR, d);

    expect(result.imageUrl).toBe(LINK);
    expect(result.thumbUrl).toBeUndefined();
    expect(result.note).toBe("No thumbnail: The table's asset storage is full.");
    expect(result.mirrored).toBe(false);
  });

  it("never rejects: an empty image is simply handed back", async () => {
    await expect(prepareCustomImage("   ", MIRROR, deps())).resolves.toEqual({
      imageUrl: "",
      mirrored: false,
    });
  });
});
