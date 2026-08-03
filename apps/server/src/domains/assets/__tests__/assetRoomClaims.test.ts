import { describe, expect, it } from "vitest";
import { planClaimCopy, planRoomReclaim, planRoomRelease } from "../assetRoomClaims.js";
import type { StoredAsset } from "../assetTypes.js";
import { collectAssetHashes } from "../assetReferences.js";

const H1 = "a".repeat(64);
const H2 = "b".repeat(64);
const H3 = "c".repeat(64);

function asset(hash: string, extra: Partial<StoredAsset> = {}): StoredAsset {
  return {
    hash,
    mime: "image/png",
    extension: "png",
    size: 100,
    createdAt: 1,
    ...extra,
  };
}

describe("planRoomReclaim", () => {
  it("marks a referenced claim so a later disappearance reads as replacement", () => {
    const plan = planRoomReclaim(
      { [H1]: asset(H1, { rooms: ["room-a"] }) },
      "room-a",
      new Set([H1]),
    );
    expect(plan.changed).toBe(true);
    expect(plan.assets[H1]!.referencedBy).toEqual(["room-a"]);
    expect(plan.orphaned).toEqual([]);
  });

  it("is a no-op when everything referenced is already marked", () => {
    const plan = planRoomReclaim(
      { [H1]: asset(H1, { rooms: ["room-a"], referencedBy: ["room-a"] }) },
      "room-a",
      new Set([H1]),
    );
    expect(plan.changed).toBe(false);
  });

  it("never touches a claim that was never observed referenced (palette stock, in-flight uploads)", () => {
    const plan = planRoomReclaim({ [H1]: asset(H1, { rooms: ["room-a"] }) }, "room-a", new Set());
    expect(plan.changed).toBe(false);
    expect(plan.assets[H1]!.rooms).toEqual(["room-a"]);
    expect(plan.orphaned).toEqual([]);
  });

  it("un-claims a marked asset that is no longer referenced — the replacement case", () => {
    const plan = planRoomReclaim(
      { [H1]: asset(H1, { rooms: ["room-a"], referencedBy: ["room-a"] }) },
      "room-a",
      new Set(),
    );
    expect(plan.changed).toBe(true);
    expect(plan.orphaned.map((a) => a.hash)).toEqual([H1]);
    expect(plan.freed).toBe(100);
    expect(plan.assets[H1]).toBeUndefined();
  });

  it("keeps the bytes when another room still claims them, and only strips this room", () => {
    const plan = planRoomReclaim(
      { [H1]: asset(H1, { rooms: ["room-a", "room-b"], referencedBy: ["room-a", "room-b"] }) },
      "room-a",
      new Set(),
    );
    expect(plan.orphaned).toEqual([]);
    expect(plan.freed).toBe(0);
    expect(plan.assets[H1]!.rooms).toEqual(["room-b"]);
    expect(plan.assets[H1]!.referencedBy).toEqual(["room-b"]);
  });

  it("leaves other rooms' claims and legacy unclaimed assets alone", () => {
    const plan = planRoomReclaim(
      {
        [H1]: asset(H1, { rooms: ["room-b"], referencedBy: ["room-b"] }),
        [H2]: asset(H2), // legacy: no rooms at all
      },
      "room-a",
      new Set(),
    );
    expect(plan.changed).toBe(false);
    expect(plan.assets[H1]).toEqual(asset(H1, { rooms: ["room-b"], referencedBy: ["room-b"] }));
    expect(plan.assets[H2]).toEqual(asset(H2));
  });

  it("handles mark and reclaim in one pass across distinct assets", () => {
    const plan = planRoomReclaim(
      {
        [H1]: asset(H1, { rooms: ["room-a"] }), // newly referenced → mark
        [H2]: asset(H2, { rooms: ["room-a"], referencedBy: ["room-a"] }), // replaced → reclaim
        [H3]: asset(H3, { rooms: ["room-a"] }), // never referenced → keep
      },
      "room-a",
      new Set([H1]),
    );
    expect(plan.assets[H1]!.referencedBy).toEqual(["room-a"]);
    expect(plan.assets[H2]).toBeUndefined();
    expect(plan.assets[H3]!.rooms).toEqual(["room-a"]);
    expect(plan.orphaned.map((a) => a.hash)).toEqual([H2]);
  });
});

describe("planClaimCopy carries the referenced-by mark", () => {
  it("copies the mark with the claim, so the fork's first replacement reclaims", () => {
    const { assets } = planClaimCopy(
      { [H1]: asset(H1, { rooms: ["default"], referencedBy: ["default"] }) },
      "default",
      "table-fork",
    );
    expect(assets[H1]!.rooms).toEqual(["default", "table-fork"]);
    expect(assets[H1]!.referencedBy).toEqual(["default", "table-fork"]);
  });

  it("does not invent a mark the source never had", () => {
    const { assets } = planClaimCopy(
      { [H1]: asset(H1, { rooms: ["default"] }) },
      "default",
      "table-fork",
    );
    expect(assets[H1]!.rooms).toEqual(["default", "table-fork"]);
    expect(assets[H1]!.referencedBy).toBeUndefined();
  });
});

describe("planRoomRelease strips the referenced-by mark", () => {
  it("removes the released room from referencedBy on surviving assets", () => {
    const plan = planRoomRelease(
      { [H1]: asset(H1, { rooms: ["default", "table-b"], referencedBy: ["default", "table-b"] }) },
      "default",
    );
    expect(plan.assets[H1]!.rooms).toEqual(["table-b"]);
    expect(plan.assets[H1]!.referencedBy).toEqual(["table-b"]);
  });
});

describe("collectAssetHashes", () => {
  it("finds both reference shapes anywhere in serialized state", () => {
    const state = JSON.stringify({
      mapBackground: `https://host.example/assets/${H1}`,
      props: [{ imageUrl: `/assets/${H2}` }],
      terrain: { palette: [`upload:${H3}`] },
    });
    expect(collectAssetHashes(state)).toEqual(new Set([H1, H2, H3]));
  });

  it("unions across blobs and ignores non-hash lookalikes", () => {
    const a = JSON.stringify({ x: `upload:${H1}` });
    const b = JSON.stringify({ y: "/assets/nothexnothexnothex", z: "upload:tooshort" });
    expect(collectAssetHashes(a, b)).toEqual(new Set([H1]));
  });
});
