import { describe, expect, it } from "vitest";
import { sniffImageMime } from "../mimeSniff.js";

function bytes(...values: Array<number | string>): Buffer {
  const parts = values.map((value) =>
    typeof value === "string" ? Buffer.from(value, "latin1") : Buffer.from([value]),
  );
  return Buffer.concat(parts);
}

describe("sniffImageMime", () => {
  it("recognizes PNG by magic bytes", () => {
    const png = bytes(0x89, "PNG\r\n", 0x1a, 0x0a, "rest-of-file");
    expect(sniffImageMime(png)).toEqual({ mime: "image/png", extension: "png" });
  });

  it("recognizes JPEG", () => {
    const jpeg = bytes(0xff, 0xd8, 0xff, 0xe0, "JFIF-data");
    expect(sniffImageMime(jpeg)).toEqual({ mime: "image/jpeg", extension: "jpg" });
  });

  it("recognizes GIF87a and GIF89a", () => {
    expect(sniffImageMime(bytes("GIF87a", "..."))).toEqual({ mime: "image/gif", extension: "gif" });
    expect(sniffImageMime(bytes("GIF89a", "..."))).toEqual({ mime: "image/gif", extension: "gif" });
  });

  it("recognizes WebP (RIFF....WEBP)", () => {
    const webp = bytes("RIFF", 0x10, 0x00, 0x00, 0x00, "WEBP", "VP8 data");
    expect(sniffImageMime(webp)).toEqual({ mime: "image/webp", extension: "webp" });
  });

  it("rejects SVG, HTML, and other non-raster content regardless of declared type", () => {
    expect(sniffImageMime(Buffer.from("<svg xmlns='...'></svg>"))).toBeNull();
    expect(sniffImageMime(Buffer.from("<!doctype html><script>alert(1)</script>"))).toBeNull();
    expect(sniffImageMime(Buffer.from("GIF12x junk"))).toBeNull();
    expect(sniffImageMime(Buffer.from("RIFFxxxxWAVE"))).toBeNull();
    expect(sniffImageMime(Buffer.alloc(0))).toBeNull();
    expect(sniffImageMime(Buffer.from([0x89, 0x50]))).toBeNull(); // truncated PNG magic
  });
});
