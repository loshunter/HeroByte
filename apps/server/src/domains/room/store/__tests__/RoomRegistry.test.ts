import { describe, it, expect } from "vitest";
import { RoomRegistry } from "../../RoomRegistry.js";
import { InMemoryRoomStore } from "../RoomStore.js";

describe("RoomRegistry", () => {
  it("returns the same RoomService instance per room", () => {
    const registry = new RoomRegistry({ store: new InMemoryRoomStore() });
    const first = registry.get("alpha");
    const second = registry.get("alpha");

    expect(first).toBe(second);
  });

  it("isolates state between rooms", () => {
    const registry = new RoomRegistry({ store: new InMemoryRoomStore() });
    const alpha = registry.get("alpha");
    const beta = registry.get("beta");

    alpha.setState({ tokens: [{ id: "token-1", owner: "u1", x: 1, y: 1, color: "#fff" }] });
    beta.setState({ tokens: [{ id: "token-2", owner: "u2", x: 5, y: 5, color: "#0ff" }] });

    expect(alpha.getState().tokens).toHaveLength(1);
    expect(beta.getState().tokens).toHaveLength(1);
    expect(alpha.getState().tokens[0]?.id).toBe("token-1");
    expect(beta.getState().tokens[0]?.id).toBe("token-2");
  });

  it("tracks registered room ids", () => {
    const registry = new RoomRegistry({ store: new InMemoryRoomStore() });
    registry.get("alpha");
    registry.get("beta");

    expect(registry.listRooms().sort()).toEqual(["alpha", "beta"]);
  });
});
