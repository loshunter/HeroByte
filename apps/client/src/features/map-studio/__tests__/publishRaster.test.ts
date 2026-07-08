import { describe, expect, it, vi } from "vitest";
import { createMapDocument } from "@herobyte/shared";
import { rasterizeMapDocument } from "../exportMapDocument";
import { AssetUploadError, uploadedAssetUrl, type UploadedAssetInfo } from "../uploads/assetUpload";
import { describePublishFailure, rasterizeAndUploadMapBackground } from "../publishRaster";

// rasterizeMapDocument drives a real <canvas>, which jsdom can't run — stub it.
vi.mock("../exportMapDocument", () => ({
  rasterizeMapDocument: vi.fn(),
}));

const HASH = "a".repeat(64);

function uploadInfo(): UploadedAssetInfo {
  return { hash: HASH, url: `/assets/${HASH}`, mime: "image/png", size: 3, deduplicated: false };
}

describe("rasterizeAndUploadMapBackground", () => {
  it("bakes the map to a PNG File, uploads it, and returns the servable asset URL", async () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    vi.mocked(rasterizeMapDocument).mockResolvedValue(blob);
    const uploadAsset = vi.fn((_file: File) => Promise.resolve(uploadInfo()));

    const url = await rasterizeAndUploadMapBackground(document, uploadAsset);

    expect(rasterizeMapDocument).toHaveBeenCalledWith(document, "image/png", { omitGrid: true });
    expect(uploadAsset).toHaveBeenCalledOnce();
    const file = uploadAsset.mock.calls[0]![0];
    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe("image/png");
    expect(file.name.endsWith(".png")).toBe(true);
    // The published reference is the same-origin /assets URL — not the raw bytes.
    expect(url).toBe(uploadedAssetUrl(HASH));
  });

  it("propagates upload errors so the caller can report them", async () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    vi.mocked(rasterizeMapDocument).mockResolvedValue(
      new Blob([new Uint8Array([1])], { type: "image/png" }),
    );
    const uploadAsset = vi.fn((_file: File) =>
      Promise.reject(new AssetUploadError("too-large", "That image is over the 5MB upload limit.")),
    );

    await expect(rasterizeAndUploadMapBackground(document, uploadAsset)).rejects.toBeInstanceOf(
      AssetUploadError,
    );
  });
});

describe("describePublishFailure", () => {
  it("surfaces the upload error message for an AssetUploadError", () => {
    const message = describePublishFailure(
      new AssetUploadError("no-credentials", "Join the room before uploading assets."),
    );
    expect(message).toContain("Join the room before uploading assets.");
  });

  it("gives a generic message for an unexpected failure", () => {
    expect(describePublishFailure(new Error("boom"))).toMatch(/^Publish failed/);
  });
});
