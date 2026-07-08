import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMapDocument } from "@herobyte/shared";
import { AssetUploadError } from "../../uploads/assetUpload";
import { rasterizeAndUploadMapBackground } from "../../publishRaster";
import { useStudioPublish } from "../useStudioPublish";

vi.mock("../../publishRaster", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../publishRaster")>()),
  rasterizeAndUploadMapBackground: vi.fn(),
}));

const ASSET_URL = `http://localhost:8787/assets/${"b".repeat(64)}`;

beforeEach(() => {
  vi.mocked(rasterizeAndUploadMapBackground).mockReset();
});

describe("useStudioPublish", () => {
  it("bakes + uploads the map, then publishes the asset URL in full mode", async () => {
    vi.mocked(rasterizeAndUploadMapBackground).mockResolvedValue(ASSET_URL);
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    const publishDocument = vi.fn(() => true);
    const uploadAsset = vi.fn();
    const onPublishStatus = vi.fn();

    const { result } = renderHook(() =>
      useStudioPublish({ activeDocument: document, publishDocument, uploadAsset, onPublishStatus }),
    );

    act(() => {
      result.current.handlePublish();
    });

    await waitFor(() => expect(publishDocument).toHaveBeenCalledWith(ASSET_URL, "map", "full"));
    expect(rasterizeAndUploadMapBackground).toHaveBeenCalledWith(document, uploadAsset);
    expect(result.current.publishMessage).toBe('Published "Keep" to the live map.');
    expect(onPublishStatus).toHaveBeenCalledWith('Published "Keep" to the live map.');
  });

  it("reports an upload failure and does not publish", async () => {
    vi.mocked(rasterizeAndUploadMapBackground).mockRejectedValue(
      new AssetUploadError("too-large", "That image is over the 5MB upload limit."),
    );
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    const publishDocument = vi.fn(() => true);

    const { result } = renderHook(() =>
      useStudioPublish({
        activeDocument: document,
        publishDocument,
        uploadAsset: vi.fn(),
        onPublishStatus: vi.fn(),
      }),
    );

    act(() => {
      result.current.handlePublish();
    });

    await waitFor(() =>
      expect(result.current.publishMessage).toContain("over the 5MB upload limit"),
    );
    expect(publishDocument).not.toHaveBeenCalled();
  });
});
