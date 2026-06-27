import { describe, expect, it } from "vitest";
import { createMapDocument } from "@herobyte/shared";
import { InMemoryMapDocumentStore } from "../store.js";

describe("InMemoryMapDocumentStore", () => {
  it("isolates documents by room and returns defensive copies", () => {
    const store = new InMemoryMapDocumentStore();
    const first = createMapDocument({ id: "map", name: "Room A", timestamp: 1 });
    const second = createMapDocument({ id: "map", name: "Room B", timestamp: 2 });
    store.set("room-a", first);
    store.set("room-b", second);

    const loaded = store.get("room-a", "map")!;
    loaded.name = "Mutated";
    loaded.grid.size = 999;
    loaded.layers[0]!.name = "Mutated";

    expect(store.get("room-a", "map")).toMatchObject({ name: "Room A", grid: { size: 50 } });
    expect(store.get("room-a", "map")!.layers[0]!.name).toBe("Background");
    expect(store.get("room-b", "map")!.name).toBe("Room B");
  });

  it("deeply clones shape and wall points", () => {
    const store = new InMemoryMapDocumentStore();
    const document = createMapDocument({ id: "map", name: "Map", timestamp: 1 });
    document.elements.push({
      id: "wall",
      layerId: "walls",
      type: "wall",
      locked: false,
      hidden: false,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      data: {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        blocksMovement: true,
        blocksVision: true,
      },
    });
    store.set("room", document);

    const loaded = store.get("room", "map")!;
    const wall = loaded.elements[0]!;
    if (wall.type !== "wall") throw new Error("Expected wall");
    wall.data.points[0]!.x = 500;

    const reloaded = store.get("room", "map")!;
    const reloadedWall = reloaded.elements[0]!;
    if (reloadedWall.type !== "wall") throw new Error("Expected wall");
    expect(reloadedWall.data.points[0]!.x).toBe(0);
  });

  it("lists and deletes documents without affecting another room", () => {
    const store = new InMemoryMapDocumentStore();
    store.set("room-a", createMapDocument({ id: "one", name: "One" }));
    store.set("room-a", createMapDocument({ id: "two", name: "Two" }));
    store.set("room-b", createMapDocument({ id: "one", name: "Other" }));

    expect(store.list("room-a").map((document) => document.id)).toEqual(["one", "two"]);
    expect(store.delete("room-a", "one")).toBe(true);
    expect(store.delete("room-a", "one")).toBe(false);
    expect(store.delete("missing", "one")).toBe(false);
    expect(store.get("room-b", "one")!.name).toBe("Other");
  });
});
