// Magic-byte sniffing for uploaded assets. Only raster image formats the
// browser renders safely are admitted — SVG and anything script-capable is
// rejected by construction, regardless of the declared Content-Type.

export interface SniffedImage {
  mime: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  extension: "png" | "jpg" | "gif" | "webp";
}

export function sniffImageMime(bytes: Buffer): SniffedImage | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG_MAGIC)) {
    return { mime: "image/png", extension: "png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  if (bytes.length >= 6) {
    const header = bytes.subarray(0, 6).toString("latin1");
    if (header === "GIF87a" || header === "GIF89a") {
      return { mime: "image/gif", extension: "gif" };
    }
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
    bytes.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return { mime: "image/webp", extension: "webp" };
  }
  return null;
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
