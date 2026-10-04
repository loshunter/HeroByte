import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { ChatService } from "../../chat/service.js";
import { createEmptyRoomState, toSnapshot } from "../model.js";
import { RoomService } from "../service.js";
import { RedisRoomStore, type RedisRoomStoreOptions } from "../store/RedisRoomStore.js";
import { validateLoadSessionMessage } from "../../../middleware/validators/sessionValidators.js";

const rooms: RoomService[] = [];
const files: string[] = [];

function room(stateFile?: string): RoomService {
  const directory = path.join(process.cwd(), ".tmp");
  mkdirSync(directory, { recursive: true });
  const file = stateFile ?? path.join(directory, `chat-recipient-${randomUUID()}.json`);
  const service = new RoomService({ stateFile: file });
  rooms.push(service);
  files.push(file);
  return service;
}

function historyWithoutRecipient() {
  const state = createEmptyRoomState();
  state.players.push({ uid: "bob", name: "Bob at send time", isDM: false });
  new ChatService().addMessage(state, "alice", "Alice", "named", "bob", 1);
  state.chatLog.push({
    id: "legacy",
    authorUid: "alice",
    authorName: "Alice",
    text: "legacy",
    to: "bob",
    timestamp: 2,
  });
  state.players = [];
  return state;
}

afterEach(async () => {
  await Promise.all(rooms.splice(0).map((service) => service.awaitPendingWrites()));
  for (const file of new Set(files.splice(0))) {
    if (existsSync(file)) unlinkSync(file);
  }
});

describe("recipient name persistence compatibility", () => {
  it("survives a disk restart without the recipient roster and keeps legacy records", async () => {
    const original = room();
    const stateFile = files[0]!;
    original.setState(historyWithoutRecipient());
    original.saveState();
    await original.awaitPendingWrites();

    const restarted = room(stateFile);
    restarted.loadState();

    expect(restarted.getState().chatLog[0]).toMatchObject({
      to: "bob",
      toName: "Bob at send time",
    });
    expect(restarted.getState().chatLog[1]).toMatchObject({ text: "legacy", to: "bob" });
    expect(restarted.getState().chatLog[1]).not.toHaveProperty("toName");
    expect(restarted.getState().players).toEqual([]);
  });

  it("preserves named and legacy records through the existing import gate and loader", () => {
    const snapshot = {
      ...toSnapshot(historyWithoutRecipient(), false, "alice"),
      drawings: [],
    };
    expect(validateLoadSessionMessage({ t: "load-session", snapshot })).toEqual({ valid: true });

    const restored = room();
    restored.loadSnapshot(snapshot);

    expect(restored.getState().chatLog[0]).toHaveProperty("toName", "Bob at send time");
    expect(restored.getState().chatLog[1]).not.toHaveProperty("toName");
    expect(toSnapshot(restored.getState(), false, "bystander").chatLog).toEqual([]);
  });

  it("retains the optional name and legacy omission through Redis persistence and hydrate", async () => {
    const payloads = new Map<string, string>();
    const client = {
      hkeys: vi.fn(async () => [...payloads.keys()]),
      hget: vi.fn(async (_namespace: string, id: string) => payloads.get(id) ?? null),
      hset: vi.fn(async (_namespace: string, id: string, value: string) => {
        payloads.set(id, value);
        return 1;
      }),
      hdel: vi.fn(async () => 1),
    };
    const options = { client: client as unknown as RedisRoomStoreOptions["client"] };
    new RedisRoomStore(options).set("chat-room", historyWithoutRecipient());

    const restarted = new RedisRoomStore(options);
    await restarted.hydrate();

    expect(restarted.get("chat-room")?.chatLog[0]).toHaveProperty("toName", "Bob at send time");
    expect(restarted.get("chat-room")?.chatLog[1]).not.toHaveProperty("toName");
  });
});
