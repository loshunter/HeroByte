// U10a — a file that is none of HeroByte's kinds is called that, in one sentence.
//
// The browser must never be STRICTER than the server (sessionPersistence.ts, and
// importBackup.ts say so): these messages replace only refusals the loaders
// already made. Every file below used to fall to a field message ("tokens must be
// an array", "missing a valid name") that read as a broken HeroByte file; a file
// that IS a table backup or a character with one bad field keeps its field-level
// message, because that one says what to fix.
import { describe, expect, it } from "vitest";
import type { RoomSnapshot } from "@herobyte/shared";
import { loadSession } from "../sessionPersistence";
import { loadPlayerState } from "../playerPersistence";

const sessionFile = (contents: unknown): File =>
  new File([JSON.stringify(contents)], "x.json", { type: "application/json" });
// This jsdom's File has no text(); loadPlayerState reads through it.
const characterFile = (contents: unknown): File =>
  ({ text: async () => JSON.stringify(contents) }) as unknown as File;

const NONE_OF_OURS = [
  { hello: "world" },
  {},
  [1, 2, 3],
  { items: [{ id: 1 }], total: 3 },
  "just a string",
  42,
  null,
];

describe("Restore table backup", () => {
  it.each(NONE_OF_OURS.map((v) => [v]))(
    "says %j is not a table backup, and where backups come from",
    async (v) => {
      const refusal = loadSession(sessionFile(v));
      await expect(refusal).rejects.toThrow(/not a table backup/i);
      await expect(refusal).rejects.toThrow(/Download table backup/);
      await expect(refusal).rejects.not.toThrow(/must be an array|Invalid session data/);
    },
  );

  it("keeps the field-level message for a file that IS a table backup with a bad field", async () => {
    const bad = { tokens: [], players: [], characters: [], gridSize: "wide" };
    await expect(loadSession(sessionFile(bad))).rejects.toThrow(/gridSize must be a number/);
    const half = { tokens: [], players: [] };
    await expect(loadSession(sessionFile(half))).rejects.toThrow(/characters must be an array/);
    await expect(loadSession(sessionFile({ snapshot: "no" }))).rejects.toThrow(
      /snapshot must be an object/,
    );
    // Half a table (a tokens array, no players) is a damaged backup, not another kind of file.
    await expect(loadSession(sessionFile({ tokens: ["abc"] }))).rejects.toThrow(
      /players must be an array/,
    );
    await expect(loadSession(sessionFile({ players: [] }))).rejects.toThrow(
      /tokens must be an array/,
    );
  });

  it("still loads an old bare snapshot and a current envelope: nothing got stricter", async () => {
    const old = {
      tokens: [],
      players: [],
      characters: [],
      gridSize: 50,
    } as unknown as RoomSnapshot;
    await expect(loadSession(sessionFile(old))).resolves.toMatchObject({ savedAt: 0 });
    const envelope = { schemaVersion: 1, savedAt: 9, snapshot: old, mapDocuments: [] };
    await expect(loadSession(sessionFile(envelope))).resolves.toMatchObject({ savedAt: 9 });
  });
});

describe("Load character", () => {
  it.each(NONE_OF_OURS.map((v) => [v]))(
    "says %j is not a character file, and where they come from",
    async (v) => {
      const refusal = loadPlayerState(characterFile(v));
      await expect(refusal).rejects.toThrow(/not a character file/i);
      await expect(refusal).rejects.toThrow(/Save character/);
      await expect(refusal).rejects.not.toThrow(/missing a valid/);
    },
  );

  it("keeps the field-level message for a file that looks like a character", async () => {
    await expect(loadPlayerState(characterFile({ name: "Aria" }))).rejects.toThrow(
      /missing a valid hp value/,
    );
    await expect(loadPlayerState(characterFile({ hp: 3, maxHp: 4 }))).rejects.toThrow(
      /missing a valid name/,
    );
    await expect(loadPlayerState(characterFile({ name: "A", hp: 3 }))).rejects.toThrow(
      /missing a valid maxHp value/,
    );
    // One field is enough to be read as a character with something missing.
    await expect(loadPlayerState(characterFile({ hp: 3 }))).rejects.toThrow(/missing a valid name/);
    await expect(loadPlayerState(characterFile({ maxHp: 4 }))).rejects.toThrow(
      /missing a valid name/,
    );
    // A package.json is not a character, but it does have a name: it keeps the field message.
    await expect(
      loadPlayerState(characterFile({ name: "left-pad", version: "1.0.0" })),
    ).rejects.toThrow(/missing a valid hp value/);
  });

  it("still loads a real character file", async () => {
    const real = { name: "Aria", hp: 30, maxHp: 40 };
    await expect(loadPlayerState(characterFile(real))).resolves.toMatchObject({ name: "Aria" });
  });
});
