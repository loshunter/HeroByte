// Own-recipient drawing history and applicable-operation regression contract.
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createEmptyRoomState, toSnapshot } from "../../../room/model.js";
import { StatePersistence } from "../../../room/persistence/StatePersistence.js";
import { StagingZoneManager } from "../../../room/staging/StagingZoneManager.js";
import { RedisRoomStore, type RedisRoomStoreOptions } from "../../../room/store/RedisRoomStore.js";
import { ALICE, DM, mixedHistoryFixture } from "./history.fixtures.js";

describe("drawing history persistence reset capabilities", () => {
  it("disk saves drawings without history; a restart rejects injected stacks and metadata", async () => {
    const { service, state } = mixedHistoryFixture();
    expect(state.drawingUndoStacks[DM]).toHaveLength(1);
    expect(state.drawingRedoStacks[ALICE]).toHaveLength(1);
    expect(toSnapshot(state, true, DM).drawingHistory).toEqual({ canUndo: true, canRedo: false });
    expect(toSnapshot(state, false, ALICE).drawingHistory).toEqual({
      canUndo: false,
      canRedo: true,
    });
    const directory = mkdtempSync(join(tmpdir(), "herobyte-u2-history-"));
    const stateFile = join(directory, "state.json");
    const writer = new StatePersistence(
      () => state,
      () => {
        throw new Error("Save must not replace current room state");
      },
      new StagingZoneManager(state),
      undefined,
      stateFile,
    );
    try {
      writer.saveToDisk();
      await writer.awaitPendingWrites();
      const persisted = JSON.parse(readFileSync(stateFile, "utf8"));
      expect(persisted.drawings.map((entry: { id: string }) => entry.id)).toEqual(["dm-kept"]);
      expect(persisted).not.toHaveProperty("drawingUndoStacks");
      expect(persisted).not.toHaveProperty("drawingRedoStacks");
      expect(persisted).not.toHaveProperty("drawingHistory");
      writeFileSync(
        stateFile,
        JSON.stringify({
          ...persisted,
          drawingUndoStacks: state.drawingUndoStacks,
          drawingRedoStacks: state.drawingRedoStacks,
          drawingHistory: { canUndo: true, canRedo: true },
        }),
      );
      let restarted = createEmptyRoomState();
      const reader = new StatePersistence(
        () => restarted,
        (loaded) => {
          restarted = loaded;
        },
        new StagingZoneManager(restarted),
        undefined,
        stateFile,
      );

      reader.loadFromDisk();

      expect(restarted.drawings).toEqual(state.drawings);
      expect(restarted.drawingUndoStacks).toEqual({});
      expect(restarted.drawingRedoStacks).toEqual({});
      expect(restarted).not.toHaveProperty("drawingHistory");
      expect(toSnapshot(restarted, true, DM).drawingHistory).toEqual({
        canUndo: false,
        canRedo: false,
      });
      expect(toSnapshot(restarted, false, ALICE).drawingHistory).toEqual({
        canUndo: false,
        canRedo: false,
      });
      expect(service.undoDrawing(restarted, DM)).toBe(false);
      expect(service.redoDrawing(restarted, ALICE)).toBe(false);
    } finally {
      await writer.awaitPendingWrites();
      if (existsSync(stateFile)) unlinkSync(stateFile);
      // Only remove our unique empty scratch directory, never recurse.
      rmdirSync(directory);
    }
  });

  it("Redis keeps live cached history but hydration clears persisted runtime stacks", async () => {
    const { service, state } = mixedHistoryFixture();
    expect(state.drawingUndoStacks[DM]).toHaveLength(1);
    expect(state.drawingRedoStacks[ALICE]).toHaveLength(1);
    expect(toSnapshot(state, true, DM).drawingHistory).toEqual({ canUndo: true, canRedo: false });
    expect(toSnapshot(state, false, ALICE).drawingHistory).toEqual({
      canUndo: false,
      canRedo: true,
    });
    const client = {
      hkeys: vi.fn<(key: string) => Promise<string[]>>().mockResolvedValue(["table"]),
      hget: vi.fn<(key: string, field: string) => Promise<string | null>>(),
      hset: vi
        .fn<(key: string, field: string, value: string) => Promise<number>>()
        .mockResolvedValue(1),
      hdel: vi.fn<(key: string, ...fields: string[]) => Promise<number>>().mockResolvedValue(1),
    };
    const options = { client: client as unknown as RedisRoomStoreOptions["client"] };
    const live = new RedisRoomStore(options);

    live.set("table", state);
    live.evict("table");

    // Existing deliberate cache semantics: service unload/reuse is not restart.
    expect(live.get("table")).toBe(state);
    expect(live.get("table")?.drawingRedoStacks[ALICE]).toHaveLength(1);
    expect(client.hset).toHaveBeenCalledOnce();
    const serialized = client.hset.mock.calls[0]![2];
    const persisted = JSON.parse(serialized);
    // Unlike disk, Redis currently serializes the WHOLE RoomState. Do not
    // rewrite this characterization to claim the raw stacks never persist.
    expect(persisted.drawingUndoStacks[DM]).toHaveLength(1);
    expect(persisted.drawingRedoStacks[ALICE]).toHaveLength(1);
    expect(persisted).not.toHaveProperty("drawingHistory");
    client.hget.mockResolvedValue(
      JSON.stringify({
        ...persisted,
        drawingHistory: { canUndo: true, canRedo: true },
      }),
    );
    const restarted = new RedisRoomStore(options);

    await restarted.hydrate();

    const hydrated = restarted.get("table");
    expect(hydrated).toBeDefined();
    expect(hydrated!.drawings).toEqual(state.drawings);
    expect(hydrated!.drawingUndoStacks).toEqual({});
    expect(hydrated!.drawingRedoStacks).toEqual({});
    expect(hydrated).not.toHaveProperty("drawingHistory");
    expect(toSnapshot(hydrated!, true, DM).drawingHistory).toEqual({
      canUndo: false,
      canRedo: false,
    });
    expect(toSnapshot(hydrated!, false, ALICE).drawingHistory).toEqual({
      canUndo: false,
      canRedo: false,
    });
    expect(service.undoDrawing(hydrated!, DM)).toBe(false);
    expect(service.redoDrawing(hydrated!, ALICE)).toBe(false);
  });
});
