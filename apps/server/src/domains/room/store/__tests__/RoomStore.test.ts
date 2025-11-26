import { describe, expect, it } from "vitest";
import { InMemoryRoomStore } from "../RoomStore.js";
import { createEmptyRoomState } from "../../model.js";

describe("InMemoryRoomStore", () => {
  it("stores and retrieves room states", () => {
    const store = new InMemoryRoomStore();
    const state = createEmptyRoomState();
    state.users.push("player-1");

    store.set("room-1", state);

    expect(store.get("room-1")).toBe(state);
    expect(store.listRoomIds()).toContain("room-1");

    store.delete("room-1");
    expect(store.get("room-1")).toBeUndefined();
  });
});
