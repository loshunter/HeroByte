import { act, cleanup, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapStampElement } from "@herobyte/shared";

const hash = "d".repeat(64);
const otherHash = "e".repeat(64);
const stored = { hash, name: "Old torch", mime: "image/png", size: 1, addedAt: 1 };
const stamp: MapStampElement = {
  id: "session-upload",
  type: "stamp",
  layerId: "objects",
  hidden: false,
  locked: false,
  transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  data: { assetId: `upload:${hash}`, width: 50, height: 50 },
};

// Each case starts a new tab/module lifetime; remounts within a case must retain it.
beforeEach(() => vi.resetModules());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function setup(initiallyStored: boolean) {
  vi.stubGlobal("localStorage", {
    getItem: () => JSON.stringify(initiallyStored ? [stored] : []),
    setItem: () => {
      throw new Error("Storage blocked");
    },
  });
  vi.stubGlobal("URL", { createObjectURL: undefined });
  const { useMyStuffAssets } = await import("../../map-studio/uploads/useMyStuffAssets");
  const { ElementPropertiesSummary } = await import("../ElementPropertiesForm");
  const upload = vi.fn(async (file: File) => {
    const uploadedHash = file.name === "Lantern.png" ? otherHash : hash;
    return {
      hash: uploadedHash,
      url: `/assets/${uploadedHash}`,
      mime: "image/png",
      size: 1,
      deduplicated: false,
    };
  });
  const mount = () => renderHook(() => useMyStuffAssets(upload));
  const summary = () => render(<ElementPropertiesSummary element={stamp} layers={[]} />);
  return { mount, summary };
}

describe("U5 session uploads survive picker remounts", () => {
  it.each([false, true])(
    "retains an uploaded name and later uploads after reopening (persisted=%s)",
    async (initiallyStored) => {
      const h = await setup(initiallyStored);
      const first = h.mount();
      expect(first.result.current.assets).toEqual(initiallyStored ? [stored] : []);
      await act(() => first.result.current.uploadFiles([new File(["art"], "Amber torch.png")]));
      first.unmount();
      const reopened = h.mount();
      expect(reopened.result.current.assets.map(({ name }) => name)).toEqual(["Amber torch"]);
      expect(h.summary().container).toHaveTextContent(`Amber torch · ${hash.slice(0, 12)}`);
      await act(() => reopened.result.current.uploadFiles([new File(["other"], "Lantern.png")]));
      reopened.unmount();
      const again = h.mount();
      expect(again.result.current.assets.map(({ name }) => name)).toEqual([
        "Lantern",
        "Amber torch",
      ]);
      expect(h.summary().container).toHaveTextContent("Amber torch");
    },
  );

  it("keeps a removed upload absent after reopening despite stale persisted metadata", async () => {
    const h = await setup(true);
    const first = h.mount();
    act(() => first.result.current.removeAsset(hash));
    expect(first.result.current.assets).toEqual([]);
    first.unmount();
    expect(h.mount().result.current.assets).toEqual([]);
    const summary = h.summary();
    expect(summary.container).toHaveTextContent(`Uploaded image · ${hash.slice(0, 12)}`);
    expect(summary.container).not.toHaveTextContent("Old torch");
  });

  it("gives reopened consumers their own copied session entries", async () => {
    const h = await setup(false);
    const first = h.mount();
    await act(() => first.result.current.uploadFiles([new File(["art"], "Amber torch.png")]));
    first.unmount();
    const reopened = h.mount();
    expect(reopened.result.current.assets).toHaveLength(1);
    reopened.result.current.assets[0]!.name = "Mutated consumer copy";
    reopened.result.current.assets.length = 0;
    reopened.unmount();
    expect(h.mount().result.current.assets.map(({ name }) => name)).toEqual(["Amber torch"]);
    expect(h.summary().container).toHaveTextContent("Amber torch");
  });
});
