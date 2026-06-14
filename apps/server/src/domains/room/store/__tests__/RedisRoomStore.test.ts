import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedisRoomStore, type RedisRoomStoreOptions } from "../RedisRoomStore.js";
import { createEmptyRoomState } from "../../model.js";
import type { RoomState } from "../../model.js";

const createMockClient = () => {
  const client = {
    hget: vi.fn<(key: string, field: string) => Promise<string | null>>(),
    hset: vi.fn<(key: string, field: string, value: string) => Promise<number>>(),
    hdel: vi.fn<(key: string, ...fields: string[]) => Promise<number>>(),
    hkeys: vi.fn<(key: string) => Promise<string[]>>(),
  };
  client.hset.mockResolvedValue(1);
  client.hdel.mockResolvedValue(1);
  client.hkeys.mockResolvedValue([]);
  return client;
};

describe("RedisRoomStore", () => {
  let client: ReturnType<typeof createMockClient>;
  let store: RedisRoomStore;

  beforeEach(() => {
    client = createMockClient();
    // The mock implements only the methods RedisRoomStore uses; cast through
    // the option's client type because ioredis' real method signatures are
    // heavily overloaded and not worth reproducing on the mock.
    store = new RedisRoomStore({
      client: client as unknown as RedisRoomStoreOptions["client"],
    });
  });

  it("hydrates cache from redis hash", async () => {
    const state = createEmptyRoomState();
    state.tokens.push({
      id: "token-1",
      owner: "u1",
      x: 1,
      y: 2,
      color: "#fff",
    } as RoomState["tokens"][number]);
    client.hkeys.mockResolvedValue(["room-a"]);
    client.hget.mockResolvedValue(JSON.stringify(state));

    await store.hydrate();

    const hydrated = store.get("room-a");
    expect(hydrated?.tokens[0]?.id).toBe("token-1");
  });

  it("persists state on set", async () => {
    const state = createEmptyRoomState();
    state.stateVersion = 42;

    store.set("room-b", state);

    expect(store.get("room-b")).toBe(state);
    expect(client.hset).toHaveBeenCalledWith("room:state", "room-b", JSON.stringify(state));
  });

  it("deletes state and removes redis entry", () => {
    const state = createEmptyRoomState();
    store.set("room-c", state);

    store.delete("room-c");

    expect(store.get("room-c")).toBeUndefined();
    expect(client.hdel).toHaveBeenCalledWith("room:state", "room-c");
  });

  it("lists cached room ids", () => {
    store.set("room-1", createEmptyRoomState());
    store.set("room-2", createEmptyRoomState());

    expect(store.listRoomIds()).toEqual(["room-1", "room-2"]);
  });
});
