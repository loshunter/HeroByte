import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMapDocument } from "@herobyte/shared";
import { FileMapDocumentStore } from "../fileStore.js";

const directories: string[] = [];

function temporaryFile(): string {
  const directory = mkdtempSync(join(tmpdir(), "herobyte-map-studio-"));
  directories.push(directory);
  return join(directory, "maps.json");
}

afterEach(() => {
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

describe("FileMapDocumentStore", () => {
  it("persists the latest document revision atomically and reloads it", async () => {
    const filePath = temporaryFile();
    const store = new FileMapDocumentStore({ filePath });
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    store.set("room", document);
    document.revision = 2;
    document.updatedAt = 3;
    store.set("room", document);
    await store.flush();

    const persisted = JSON.parse(readFileSync(filePath, "utf8"));
    expect(persisted).toMatchObject({
      schemaVersion: 1,
      rooms: { room: [{ id: "map", revision: 2, updatedAt: 3 }] },
    });

    const reloaded = new FileMapDocumentStore({ filePath });
    expect(reloaded.get("room", "map")).toMatchObject({ name: "Keep", revision: 2 });
  });

  it("persists document and room deletion", async () => {
    const filePath = temporaryFile();
    const store = new FileMapDocumentStore({ filePath });
    store.set("room", createMapDocument({ id: "one", name: "One" }));
    store.set("room", createMapDocument({ id: "two", name: "Two" }));
    expect(store.delete("room", "missing")).toBe(false);
    expect(store.delete("room", "one")).toBe(true);
    store.deleteRoom("room");
    await store.flush();

    expect(new FileMapDocumentStore({ filePath }).list("room")).toEqual([]);
  });

  it("reports corrupt stores without crashing startup", () => {
    const filePath = temporaryFile();
    writeFileSync(filePath, "not-json", "utf8");
    const onError = vi.fn();

    const store = new FileMapDocumentStore({ filePath, onError });

    expect(store.list("room")).toEqual([]);
    expect(onError).toHaveBeenCalledWith(
      "[MapStudio] Failed to load map documents",
      expect.any(Error),
    );
  });

  it("ignores invalid room entries and invalid documents", () => {
    const filePath = temporaryFile();
    writeFileSync(
      filePath,
      JSON.stringify({
        schemaVersion: 1,
        rooms: {
          invalidRoom: "not-an-array",
          mixed: [{ id: "bad" }, createMapDocument({ id: "good", name: "Good" })],
        },
      }),
      "utf8",
    );

    const store = new FileMapDocumentStore({ filePath });
    expect(store.list("invalidRoom")).toEqual([]);
    expect(store.list("mixed").map((document) => document.id)).toEqual(["good"]);
  });
});
