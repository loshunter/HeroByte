import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetUploadError, type UploadedAssetInfo } from "../assetUpload";
import { useMyStuffAssets } from "../useMyStuffAssets";

const HASH = "b".repeat(64);

function info(overrides: Partial<UploadedAssetInfo> = {}): UploadedAssetInfo {
  return {
    hash: HASH,
    url: `/assets/${HASH}`,
    mime: "image/png",
    size: 64,
    deduplicated: false,
    ...overrides,
  };
}

let backing: Map<string, string>;
beforeEach(() => {
  backing = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => void backing.set(key, value),
      removeItem: (key: string) => void backing.delete(key),
      clear: () => backing.clear(),
    },
    writable: true,
    configurable: true,
  });
});

describe("useMyStuffAssets", () => {
  it("hydrates from the stored shelf", () => {
    const stored = {
      hash: HASH,
      name: "Torch",
      mime: "image/png",
      size: 64,
      addedAt: 5,
    };
    backing.set("herobyte-my-stuff", JSON.stringify([stored]));
    const { result } = renderHook(() => useMyStuffAssets(vi.fn()));
    expect(result.current.assets).toEqual([stored]);
  });

  it("uploads a file and adds it to the shelf with a cleaned name", async () => {
    const uploadAsset = vi.fn().mockResolvedValue(info());
    const { result } = renderHook(() => useMyStuffAssets(uploadAsset));

    const file = new File([new Uint8Array(64)], "Flaming Torch.PNG", { type: "image/png" });
    await act(() => result.current.uploadFiles([file]));

    expect(uploadAsset).toHaveBeenCalledWith(file);
    expect(result.current.assets).toHaveLength(1);
    expect(result.current.assets[0]).toMatchObject({
      hash: HASH,
      name: "Flaming Torch",
      mime: "image/png",
      size: 64,
    });
    expect(result.current.error).toBeNull();
    expect(result.current.busy).toBe(false);
  });

  it("surfaces upload errors and keeps the shelf unchanged", async () => {
    const uploadAsset = vi
      .fn()
      .mockRejectedValue(
        new AssetUploadError("quota-exceeded", "The room's asset storage is full."),
      );
    const { result } = renderHook(() => useMyStuffAssets(uploadAsset));

    const file = new File([new Uint8Array(4)], "big.png", { type: "image/png" });
    await act(() => result.current.uploadFiles([file]));

    expect(result.current.assets).toEqual([]);
    expect(result.current.error).toBe("The room's asset storage is full.");
    expect(result.current.busy).toBe(false);
  });

  it("keeps uploading the rest of a batch after one failure", async () => {
    const okHash = "c".repeat(64);
    const uploadAsset = vi
      .fn()
      .mockRejectedValueOnce(new AssetUploadError("unsupported-type", "nope"))
      .mockResolvedValueOnce(info({ hash: okHash }));
    const { result } = renderHook(() => useMyStuffAssets(uploadAsset));

    await act(() =>
      result.current.uploadFiles([
        new File([""], "bad.txt", { type: "text/plain" }),
        new File([new Uint8Array(4)], "good.png", { type: "image/png" }),
      ]),
    );

    expect(result.current.assets.map((asset) => asset.hash)).toEqual([okHash]);
    expect(result.current.error).toBe("nope");
  });

  it("reports busy while an upload is in flight", async () => {
    let release: (value: UploadedAssetInfo) => void = () => {};
    const uploadAsset = vi.fn().mockReturnValue(
      new Promise<UploadedAssetInfo>((resolve) => {
        release = resolve;
      }),
    );
    const { result } = renderHook(() => useMyStuffAssets(uploadAsset));

    let done: Promise<void>;
    act(() => {
      done = result.current.uploadFiles([
        new File([new Uint8Array(4)], "slow.png", { type: "image/png" }),
      ]);
    });
    await waitFor(() => expect(result.current.busy).toBe(true));

    await act(async () => {
      release(info());
      await done;
    });
    expect(result.current.busy).toBe(false);
  });

  it("removes an asset from the shelf", async () => {
    const uploadAsset = vi.fn().mockResolvedValue(info());
    const { result } = renderHook(() => useMyStuffAssets(uploadAsset));
    await act(() =>
      result.current.uploadFiles([new File([new Uint8Array(4)], "t.png", { type: "image/png" })]),
    );
    expect(result.current.assets).toHaveLength(1);

    act(() => result.current.removeAsset(HASH));
    expect(result.current.assets).toEqual([]);
  });
});
