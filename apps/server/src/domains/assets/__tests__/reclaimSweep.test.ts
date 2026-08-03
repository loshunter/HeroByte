import { describe, expect, it, vi } from "vitest";
import { AssetReclaimSweeper } from "../reclaimSweep.js";
import type { AssetService } from "../service.js";

const H1 = "a".repeat(64);
const H2 = "b".repeat(64);

function sweeper(overrides: {
  reclaimRoom?: ReturnType<typeof vi.fn>;
  rooms?: Partial<ConstructorParameters<typeof AssetReclaimSweeper>[0]["rooms"]>;
  documents?: unknown[];
  noAssetService?: boolean;
}) {
  const reclaimRoom = overrides.reclaimRoom ?? vi.fn().mockResolvedValue(0);
  const instance = new AssetReclaimSweeper({
    assetService: overrides.noAssetService
      ? undefined
      : ({ reclaimRoom } as unknown as AssetService),
    rooms: {
      listRooms: () => ["room-a"],
      has: () => true,
      get: () => ({ getState: () => ({ props: [{ imageUrl: `/assets/${H1}` }] }) }),
      ...overrides.rooms,
    },
    mapDocuments: { list: () => overrides.documents ?? [] },
  });
  return { instance, reclaimRoom };
}

describe("AssetReclaimSweeper", () => {
  it("hands reclaimRoom the hashes referenced by state AND map documents", async () => {
    const { instance, reclaimRoom } = sweeper({
      documents: [{ elements: [{ data: { assetId: `upload:${H2}` } }] }],
    });

    await instance.sweepLoadedRooms();

    expect(reclaimRoom).toHaveBeenCalledWith("room-a", new Set([H1, H2]));
  });

  it("skips rooms unloaded between listRooms and the visit — no resurrection", async () => {
    const get = vi.fn();
    const { instance, reclaimRoom } = sweeper({
      rooms: { listRooms: () => ["gone"], has: () => false, get },
    });

    await instance.sweepLoadedRooms();

    expect(get).not.toHaveBeenCalled();
    expect(reclaimRoom).not.toHaveBeenCalled();
  });

  it("keeps sweeping other rooms when one room's reclaim throws", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const reclaimRoom = vi
      .fn()
      .mockRejectedValueOnce(new Error("disk says no"))
      .mockResolvedValue(0);
    const { instance } = sweeper({
      reclaimRoom,
      rooms: { listRooms: () => ["room-a", "room-b"] },
    });

    await instance.sweepLoadedRooms();

    expect(reclaimRoom).toHaveBeenCalledTimes(2);
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });

  it("no-ops without an asset service", async () => {
    const { instance, reclaimRoom } = sweeper({ noAssetService: true });
    await instance.sweepLoadedRooms();
    await instance.sweepRoom("room-a", "{}");
    expect(reclaimRoom).not.toHaveBeenCalled();
  });
});
