import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedisRoomStore } from "../RedisRoomStore.js";
import { createEmptyRoomState } from "../../model.js";
import type { RoomState } from "../../model.js";

const createMockClient = () => {
  const client = {
    hget: vi.fn<Promise<string | null>, [string, string]>(),
    hset: vi.fn<Promise<number>, [string, string, string]>(),
    hdel: vi.fn<Promise<number>, [string, ...string[]]>(),
    hkeys: vi.fn<Promise<string[]>, [string]>(),
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
    store = new RedisRoomStore({ client });
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
