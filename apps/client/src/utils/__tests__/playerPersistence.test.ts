/**
 * Round-trip tests for Save/Load Character.
 *
 * Written for S6, because widening `Drawing["type"]` with "template" exposed a
 * silent corruption: the import sanitiser rewrites any UNLISTED type to
 * "freehand" and the export never carried the template metadata, so saving and
 * reloading a character turned every area template into an unlabelled
 * scribble — and then pushed that back to the table.
 *
 * Source: apps/client/src/utils/playerPersistence.ts
 */

import { describe, it, expect, vi } from "vitest";
import type { Drawing, Player } from "@herobyte/shared";
import { savePlayerState, loadPlayerState } from "../playerPersistence";

const player: Player = {
  uid: "uid-1",
  name: "Aria",
  isDM: false,
  hp: 30,
  maxHp: 40,
  micLevel: 0,
  lastHeartbeat: 0,
} as Player;

const CONE: Drawing = {
  id: "draw-cone",
  owner: "uid-1",
  type: "template",
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 50 },
    { x: 100, y: -50 },
  ],
  color: "#ff8800",
  width: 3,
  opacity: 0.8,
  filled: true,
  template: { kind: "cone", sizeFeet: 15 },
};

/**
 * savePlayerState writes a file through the DOM; capture the JSON it would
 * have downloaded and feed it straight back to the loader.
 */
async function roundTrip(drawings: Drawing[]): Promise<Drawing[]> {
  let captured = "";
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = ((blob: Blob) => {
    // jsdom's Blob exposes text() as a promise; stash it synchronously via the
    // constructor argument instead by re-reading through FileReader-free means.
    void blob;
    return "blob:stub";
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL;

  const blobSpy = vi.spyOn(globalThis, "Blob").mockImplementation(((parts: BlobPart[]) => {
    captured = String(parts[0]);
    return new (Object.getPrototypeOf(Blob).constructor ?? Object)() as Blob;
  }) as never);
  const clickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => undefined);

  try {
    savePlayerState({ player, drawings });
  } finally {
    blobSpy.mockRestore();
    clickSpy.mockRestore();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }

  const file = { text: async () => captured } as unknown as File;
  const loaded = await loadPlayerState(file);
  return loaded.drawings ?? [];
}

describe("playerPersistence — area templates survive Save/Load Character", () => {
  it("keeps the template TYPE instead of rewriting it to freehand", async () => {
    // The sanitiser falls back to "freehand" for any type it does not know, so
    // a missing entry in DRAWING_TYPES silently turns a cone into a scribble —
    // with no warning. This is now the guard for the SHARED list, which the
    // sanitiser imports rather than copying; a subset copy used to compile,
    // lint and typecheck green while corrupting every imported cone.
    const [restored] = await roundTrip([CONE]);
    expect(restored.type).toBe("template");
  });

  it("keeps the metadata that names the area", async () => {
    const [restored] = await roundTrip([CONE]);
    expect(restored.template).toEqual({ kind: "cone", sizeFeet: 15 });
  });

  it("keeps the polygon exactly, so the area does not move or resize", async () => {
    const [restored] = await roundTrip([CONE]);
    expect(restored.points).toEqual(CONE.points);
  });

  it("drops a template payload that is not a real kind on the way OUT", async () => {
    const poisoned = {
      ...CONE,
      template: { kind: "hypercube", sizeFeet: 15 },
    } as unknown as Drawing;
    const [restored] = await roundTrip([poisoned]);
    expect(restored.template).toBeUndefined();
  });

  it("drops a hand-edited template payload on the way IN", async () => {
    // The file is a text file on the player's disk: it is edited, shared and
    // reloaded. Coercing only on export leaves the import trusting whatever
    // the file says — and the loaded set is broadcast to the whole table by
    // sync-player-drawings.
    const handEdited = JSON.stringify({
      name: "Aria",
      hp: 30,
      maxHp: 40,
      drawings: [
        { ...CONE, template: { kind: "hypercube", sizeFeet: 99 } },
        { ...CONE, id: "draw-2", template: { kind: "cone", sizeFeet: -5 } },
        { ...CONE, id: "draw-3", template: "not-an-object" },
      ],
    });
    const loaded = await loadPlayerState({ text: async () => handEdited } as unknown as File);

    expect(loaded.drawings).toHaveLength(3);
    for (const drawing of loaded.drawings ?? []) {
      expect(drawing.template).toBeUndefined();
    }
  });

  it("keeps a hand-edited template that IS well formed", async () => {
    // Guards the guard: a coercion that rejected everything would satisfy the
    // test above for the wrong reason.
    const handEdited = JSON.stringify({
      name: "Aria",
      hp: 30,
      maxHp: 40,
      drawings: [{ ...CONE, template: { kind: "circle", sizeFeet: 20 } }],
    });
    const loaded = await loadPlayerState({ text: async () => handEdited } as unknown as File);

    expect(loaded.drawings?.[0].template).toEqual({ kind: "circle", sizeFeet: 20 });
  });

  it("leaves ordinary drawings alone", async () => {
    const freehand: Drawing = {
      id: "draw-f",
      type: "freehand",
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
      ],
      color: "#ffffff",
      width: 2,
      opacity: 1,
    };
    const [restored] = await roundTrip([freehand]);
    expect(restored.type).toBe("freehand");
    expect(restored.template).toBeUndefined();
  });
});

describe("playerPersistence — Load character refuses the other two files by name", () => {
  // The same fake readable file the round trip above uses: this jsdom's File has no text().
  const fileOf = (value: unknown) =>
    ({ text: async () => JSON.stringify(value) }) as unknown as File;

  it("says a table backup is a table backup, and where it is restored", async () => {
    // It used to say "Player state is missing a valid name": true, and useless.
    const table = { schemaVersion: 1, savedAt: 1, snapshot: { tokens: [], players: [] } };
    await expect(loadPlayerState(fileOf(table))).rejects.toThrow(/table backup/i);
    await expect(loadPlayerState(fileOf(table))).rejects.toThrow(/DM Menu → Table → Backups/);
    await expect(loadPlayerState(fileOf(table))).rejects.not.toThrow(/missing a valid name/);
  });

  it("says an editable map is an editable map, and where it is imported", async () => {
    const map = { schemaVersion: 1, id: "doc-A", name: "Dungeon", layers: [], elements: [] };
    await expect(loadPlayerState(fileOf(map))).rejects.toThrow(/editable map/i);
    await expect(loadPlayerState(fileOf(map))).rejects.toThrow(/Map library/);
    await expect(loadPlayerState(fileOf(map))).rejects.not.toThrow(/missing a valid name/);
  });

  it("still loads a real character file, and still refuses one that is merely broken", async () => {
    const real = { name: "Aria", hp: 30, maxHp: 40 };
    await expect(loadPlayerState(fileOf(real))).resolves.toMatchObject({ name: "Aria", hp: 30 });
    await expect(loadPlayerState(fileOf({ hp: 30, maxHp: 40 }))).rejects.toThrow(
      /missing a valid name/,
    );
  });

  it("calls every refusal a character file, never 'player state' (the old name)", async () => {
    // These reach the person through an alert, in the words of the buttons they pressed.
    const refusals = [
      { text: async () => "not json" } as unknown as File,
      fileOf(["not", "an", "object"]),
      fileOf({ hp: 30, maxHp: 40 }),
      fileOf({ name: "Aria", maxHp: 40 }),
      fileOf({ name: "Aria", hp: 30 }),
      fileOf({ name: "Aria", hp: -1, maxHp: 40 }),
      fileOf({ name: "Aria", hp: 30, maxHp: 40, portrait: 7 }),
      fileOf({ name: "Aria", hp: 30, maxHp: 40, tokenImage: 7 }),
    ];
    for (const file of refusals) {
      const error = await loadPlayerState(file).then(
        () => null,
        (caught: Error) => caught,
      );
      expect(error, "refused").not.toBeNull();
      expect(error!.message).toMatch(/character file/i);
      expect(error!.message).not.toMatch(/player state/i);
    }
  });
});

describe("playerPersistence — a character file is named for what it is", () => {
  it("downloads as <name>-character-<time>.json, not -state-", () => {
    let downloaded = "";
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:captured");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloaded = this.download;
    });
    try {
      savePlayerState({ player });
    } finally {
      click.mockRestore();
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
    expect(downloaded).toMatch(/^Aria-character-\d{8}T\d{6}Z\.json$/);
  });
});
