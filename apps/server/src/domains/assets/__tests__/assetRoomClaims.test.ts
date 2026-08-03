import { describe, expect, it } from "vitest";
import {
  planClaimCopy,
  planCondemnedExpiry,
  planRoomReclaim,
  planRoomRelease,
} from "../assetRoomClaims.js";
import type { StoredAsset } from "../assetTypes.js";
import { collectAssetHashes } from "../assetReferences.js";

const NOW = 1_000_000;
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
      NOW,
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
      NOW,
    );
    expect(plan.changed).toBe(false);
  });

  it("never touches a claim that was never observed referenced (palette stock, in-flight uploads)", () => {
    const plan = planRoomReclaim(
      { [H1]: asset(H1, { rooms: ["room-a"] }) },
      "room-a",
      new Set(),
      NOW,
    );
    expect(plan.changed).toBe(false);
    expect(plan.assets[H1]!.rooms).toEqual(["room-a"]);
    expect(plan.orphaned).toEqual([]);
  });

  it("condemns a marked asset that is no longer referenced — never deletes directly", () => {
    const plan = planRoomReclaim(
      { [H1]: asset(H1, { rooms: ["room-a"], referencedBy: ["room-a"] }) },
      "room-a",
      new Set(),
      NOW,
    );
    expect(plan.changed).toBe(true);
    // The entry SURVIVES un-claimed: it keeps serving through the grace
    // window so references no scan can see (My Stuff shelves, saved player
    // files) can come back. Deletion is planCondemnedExpiry's job.
    expect(plan.orphaned).toEqual([]);
    expect(plan.freed).toBe(0);
    expect(plan.assets[H1]).toMatchObject({ unreferencedAt: NOW });
    expect(plan.assets[H1]!.rooms).toBeUndefined();
    expect(plan.assets[H1]!.referencedBy).toBeUndefined();
  });

  it("resurrects a condemned asset a room references again (Undo, cross-table URLs)", () => {
    const plan = planRoomReclaim(
      { [H1]: asset(H1, { unreferencedAt: NOW - 1000 }) },
      "room-b",
      new Set([H1]),
      NOW,
    );
    expect(plan.changed).toBe(true);
    expect(plan.assets[H1]).toEqual(asset(H1, { rooms: ["room-b"], referencedBy: ["room-b"] }));
    expect(plan.assets[H1]!.unreferencedAt).toBeUndefined();
  });

  it("never adopts a LEGACY unclaimed asset, even when referenced", () => {
    // Pre-rooms-era assets have no claims and no condemnation stamp; charging
    // them to a room that may not have uploaded them would be a guess.
    const plan = planRoomReclaim({ [H1]: asset(H1) }, "room-a", new Set([H1]), NOW);
    expect(plan.changed).toBe(false);
    expect(plan.assets[H1]).toEqual(asset(H1));
  });

  it("keeps the bytes when another room still claims them, and only strips this room", () => {
    const plan = planRoomReclaim(
      { [H1]: asset(H1, { rooms: ["room-a", "room-b"], referencedBy: ["room-a", "room-b"] }) },
      "room-a",
      new Set(),
      NOW,
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
      NOW,
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
      NOW,
    );
    expect(plan.assets[H1]!.referencedBy).toEqual(["room-a"]);
    expect(plan.assets[H2]).toMatchObject({ unreferencedAt: NOW }); // condemned
    expect(plan.assets[H3]!.rooms).toEqual(["room-a"]);
    expect(plan.orphaned).toEqual([]);
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

describe("planCondemnedExpiry", () => {
  const GRACE = 7 * 24 * 60 * 60 * 1000;

  it("keeps a condemned asset inside the grace window", () => {
    const plan = planCondemnedExpiry(
      { [H1]: asset(H1, { unreferencedAt: NOW }) },
      NOW + GRACE - 1,
      GRACE,
    );
    expect(plan.changed).toBe(false);
    expect(plan.assets[H1]).toBeDefined();
  });

  it("deletes a condemned asset once the grace has passed", () => {
    const plan = planCondemnedExpiry(
      { [H1]: asset(H1, { unreferencedAt: NOW }) },
      NOW + GRACE,
      GRACE,
    );
    expect(plan.changed).toBe(true);
    expect(plan.orphaned.map((a) => a.hash)).toEqual([H1]);
    expect(plan.freed).toBe(100);
    expect(plan.assets[H1]).toBeUndefined();
  });

  it("never expires claimed assets or legacy unclaimed ones", () => {
    const plan = planCondemnedExpiry(
      {
        [H1]: asset(H1, { rooms: ["room-a"] }), // claimed
        [H2]: asset(H2), // legacy: no stamp, never condemned
      },
      NOW + GRACE * 10,
      GRACE,
    );
    expect(plan.changed).toBe(false);
    expect(plan.assets[H1]).toBeDefined();
    expect(plan.assets[H2]).toBeDefined();
  });
});
