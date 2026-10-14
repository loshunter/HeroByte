/**
 * The auto backdrop rule and the four ways a picture comes in. Drop and paste
 * are tested here on their handlers (Playwright cannot hand a real clipboard
 * image to the page); the file pick runs for real in e2e.
 */

import { describe, expect, it, vi } from "vitest";
import {
  AUTO_FALLBACK,
  autoBackdropColor,
  cssBackground,
  defaultGradient,
  resolveBackdrop,
} from "../backdrop";
import {
  UnbakeableLinkError,
  loadPictureLink,
  pictureFileFrom,
  pictureLinkFrom,
  type LoadDeps,
} from "../pictureSources";

/** A w×h RGBA image filled by a function of (x, y). */
function pixels(
  w: number,
  h: number,
  at: (x: number, y: number) => [number, number, number, number],
) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) data.set(at(x, y), (y * w + x) * 4);
  }
  return data;
}

describe("auto backdrop", () => {
  it("an opaque picture gets its own edge colour", () => {
    const data = pixels(16, 16, (x, y) =>
      x === 0 || y === 0 || x === 15 || y === 15 ? [200, 100, 50, 255] : [0, 0, 0, 255],
    );
    expect(autoBackdropColor(data, 16, 16)).toBe("#c86432");
  });

  it("a cut-out reads the first ring where it is opaque", () => {
    // Transparent border two pixels deep, then a blue ring.
    const data = pixels(16, 16, (x, y) => {
      const ring = Math.min(x, y, 15 - x, 15 - y);
      return ring < 2 ? [255, 0, 0, 0] : ring === 2 ? [0, 0, 255, 255] : [255, 255, 255, 255];
    });
    expect(autoBackdropColor(data, 16, 16)).toBe("#0000ff");
  });

  it("a ring under 5% opaque does not count, even with 8+ opaque pixels", () => {
    // 64×64: ring 0 has 252 pixels; 9 opaque is 3.6%. Ring 1 is solid blue.
    const data = pixels(64, 64, (x, y) => {
      const ring = Math.min(x, y, 63 - x, 63 - y);
      if (ring === 0) return y === 0 && x < 9 ? [255, 0, 0, 255] : [0, 0, 0, 0];
      return ring === 1 ? [0, 0, 255, 255] : [255, 255, 255, 255];
    });
    expect(autoBackdropColor(data, 64, 64)).toBe("#0000ff");
  });

  it("ignores a few stray opaque pixels on a transparent edge", () => {
    const data = pixels(64, 64, (x, y) =>
      x === 0 && y < 3
        ? [255, 0, 0, 255]
        : x > 20 && x < 44 && y > 20 && y < 44
          ? [0, 255, 0, 255]
          : [0, 0, 0, 0],
    );
    // 3 opaque pixels on the outer ring is under 8: the rings go on to the figure... which is
    // deeper than a quarter of the way in, so nothing counts.
    expect(autoBackdropColor(data, 64, 64)).toBe(AUTO_FALLBACK);
  });

  it("resolves auto to a solid fill and writes CSS", () => {
    expect(resolveBackdrop({ kind: "auto" }, "#112233")).toEqual({
      kind: "solid",
      color: "#112233",
    });
    expect(cssBackground({ kind: "none" })).toBe("transparent");
    expect(cssBackground({ kind: "gradient", from: "#fff", to: "#000" })).toBe(
      "linear-gradient(180deg, #fff, #000)",
    );
    const gradient = defaultGradient("#808080");
    expect(gradient.from > "#808080").toBe(true);
    expect(gradient.to < "#808080").toBe(true);
  });
});

function file(type: string) {
  return new File(["x"], `f.${type.split("/")[1]}`, { type });
}

describe("drop and paste", () => {
  it("takes the first picture file from a drop", () => {
    const text = file("text/plain");
    const png = file("image/png");
    const files = [text, png];
    const transfer = { files: { length: 2, item: (i: number) => files[i] ?? null } };
    expect(pictureFileFrom(transfer)).toBe(png);
  });

  it("takes a pasted screenshot from the items list when files is empty", () => {
    const shot = file("image/png");
    const transfer = {
      files: { length: 0, item: () => null },
      items: { length: 1, 0: { kind: "file", type: "image/png", getAsFile: () => shot } },
    };
    expect(pictureFileFrom(transfer)).toBe(shot);
  });

  it("takes any image the browser may decode, and an unnamed file; refuses a non-image", () => {
    // The bake re-encodes, so the source format is the decoder's business.
    const tiff = file("image/tiff");
    expect(pictureFileFrom({ files: { length: 1, item: () => tiff } })).toBe(tiff);
    const unnamed = new File(["x"], "art.webp", { type: "" });
    expect(pictureFileFrom({ files: { length: 1, item: () => unnamed } })).toBe(unnamed);
    const text = file("text/plain");
    expect(pictureFileFrom({ files: { length: 1, item: () => text } })).toBeNull();
  });

  it("reads a dropped link from the uri list, skipping comments", () => {
    const data: Record<string, string> = {
      "text/uri-list": "# comment\r\nhttps://i.imgur.com/abc.png",
      "text/plain": "",
    };
    expect(pictureLinkFrom({ getData: (f) => data[f] ?? "" })).toBe("https://i.imgur.com/abc.png");
    expect(pictureLinkFrom({ getData: () => "not a link" })).toBeNull();
  });
});

function loadDeps(overrides: Partial<LoadDeps> = {}): LoadDeps {
  return {
    createObjectURL: vi.fn(() => "blob:x"),
    revokeObjectURL: vi.fn(),
    loadImage: vi.fn(async () => ({ naturalWidth: 10, naturalHeight: 20 }) as HTMLImageElement),
    readableSource: vi.fn(async (url: string) => url),
    normalizeLink: vi.fn(async (url: string) => url),
    ...overrides,
  };
}

describe("links", () => {
  it("loads the normalized link (an imgur page becomes its image)", async () => {
    const deps = loadDeps({ normalizeLink: vi.fn(async () => "https://i.imgur.com/abc.png") });
    const picture = await loadPictureLink("https://imgur.com/abc", deps);
    expect(deps.loadImage).toHaveBeenCalledWith("https://i.imgur.com/abc.png", true);
    expect(picture.link).toBe("https://i.imgur.com/abc.png");
  });

  it("loads a link with crossOrigin so it can bake", async () => {
    const deps = loadDeps();
    const picture = await loadPictureLink(" https://i.imgur.com/a.png ", deps);
    expect(deps.loadImage).toHaveBeenCalledWith("https://i.imgur.com/a.png", true);
    expect(picture).toMatchObject({
      link: "https://i.imgur.com/a.png",
      size: { width: 10, height: 20 },
    });
  });

  it("a site that shows its picture but refuses the copy is 'no-copy'", async () => {
    // The anonymous (CORS) load fails, a plain one works: the site refused the copy.
    const deps = loadDeps({
      loadImage: vi.fn(async (_src: string, cors: boolean) =>
        cors
          ? Promise.reject(new Error("cors"))
          : ({ naturalWidth: 1, naturalHeight: 1 } as HTMLImageElement),
      ),
    });
    const error = await loadPictureLink("https://media.discordapp.net/x.png", deps).catch((e) => e);
    expect(error).toBeInstanceOf(UnbakeableLinkError);
    expect(error).toMatchObject({ link: "https://media.discordapp.net/x.png", reason: "no-copy" });
  });

  it("a link that loads nothing at all is 'unreachable', not blamed on the site", async () => {
    const deps = loadDeps({ loadImage: vi.fn(async () => Promise.reject(new Error("404"))) });
    const error = await loadPictureLink("https://i.imgur.com/gone.png", deps).catch((e) => e);
    expect(error).toMatchObject({ link: "https://i.imgur.com/gone.png", reason: "unreachable" });
  });
});
