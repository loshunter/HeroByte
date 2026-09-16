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

  it("hydrates through the same whitelist as the disk loader — it is a load door", async () => {
    // This store spread its payload verbatim, so every coercion the disk
    // loader applies was bypassed by a Redis-backed table: the third load
    // door, found in round 3 after a comment had said "TWO" for a round.
    // Dark today (ROOM_STORE unset); VISION.md makes it the production
    // default. Literal junk in, literal outcomes out — nothing compared with
    // itself.
    const hash = "a".repeat(64);
    const payload = {
      ...createEmptyRoomState(),
      characters: [
        { id: "npc-1", type: "npc", name: "Ogre", hp: 1, maxHp: 1, disposition: "banana" },
        { id: "npc-2", type: "npc", name: "Baker", hp: 1, maxHp: 1, disposition: "neutral" },
      ],
      customTokens: [
        {
          id: "bad",
          name: "X",
          imageUrl: "data:text/html,<script>alert(1)</script>",
          tags: [],
          size: "colossal",
          addedBy: "",
          addedAt: 0,
        },
        {
          id: "good",
          name: "Marta",
          imageUrl: `http://localhost:8788/assets/${hash}`,
          tags: ["npc"],
          size: "small",
          addedBy: "dm",
          addedAt: 1,
        },
      ],
      selectionState: {}, // what a Map becomes on the way through Redis
      pointers: [{ uid: "u1", x: 1, y: 1 }],
    };
    client.hkeys.mockResolvedValue(["room-a"]);
    client.hget.mockResolvedValue(JSON.stringify(payload));

    await store.hydrate();
    const state = store.get("room-a")!;

    // A stance off the list is dropped, not kept and not repaired.
    expect("disposition" in state.characters[0]!).toBe(false);
    expect(state.characters[1]?.disposition).toBe("neutral");
    // A custom token the wire would refuse never reaches the shelf; a good one does, size repaired.
    expect(state.customTokens.map((t) => t.id)).toEqual(["good"]);
    expect(state.customTokens[0]?.size).toBe("small");
    // The ephemera reset the disk loader does.
    expect(state.selectionState).toBeInstanceOf(Map);
    expect(state.pointers).toEqual([]);
  });

  it("hydrates FIELD FOR FIELD with the disk loader — the fields the first repair missed", async () => {
    // The first repair mirrored six fields and called it "the same field set".
    // A line-by-line found the rest, and two of them matter MORE here than at
    // the disk door: persist() writes the whole RoomState, so a Redis payload
    // carries users and undo stacks the disk writer never records. Literal
    // junk in, literal outcomes out.
    const payload = {
      ...createEmptyRoomState(),
      users: ["stale-uid-from-last-boot"],
      players: [{ uid: "p1", name: "P", hp: 1, maxHp: 1, statusEffects: "poisoned" }],
      diceRolls: { not: "an array" },
      chatLog: "not an array either",
      drawingUndoStacks: { someone: [1, 2, 3] },
      drawingRedoStacks: { someone: [4] },
      playerStagingZone: { x: "not-a-number", y: 1, width: 1, height: 1 },
      defaultVisionRadius: 999999,
    };
    client.hkeys.mockResolvedValue(["room-a"]);
    client.hget.mockResolvedValue(JSON.stringify(payload));

    await store.hydrate();
    const state = store.get("room-a")!;

    // Ephemera the disk loader resets; a stale uid here is read by the
    // heartbeat timeout manager on the next tick.
    expect(state.users).toEqual([]);
    expect(state.drawingUndoStacks).toEqual({});
    expect(state.drawingRedoStacks).toEqual({});
    // The array guards whose own comment says a poisoned non-array kills the
    // process on every restart.
    expect(state.diceRolls).toEqual([]);
    expect(state.chatLog).toEqual([]);
    // The players map: isDM defaulted, a non-array statusEffects emptied.
    expect(state.players[0]).toMatchObject({ uid: "p1", isDM: false, statusEffects: [] });
    // The staging-zone whitelist, now a shared function.
    expect(state.playerStagingZone).toBeUndefined();
    // The vision clamp applied at both other doors.
    expect(typeof state.defaultVisionRadius).toBe("number");
    expect(state.defaultVisionRadius).toBeLessThan(999999);
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
