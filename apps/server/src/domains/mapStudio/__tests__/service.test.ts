import { describe, expect, it } from "vitest";
import {
  MapDocumentRevisionConflictError,
  type MapDocumentCommand,
  type MapLayer,
} from "@herobyte/shared";
import {
  MapDocumentAlreadyExistsError,
  MapDocumentNotFoundError,
  MapStudioService,
} from "../service.js";

const weatherLayer: MapLayer = {
  id: "weather",
  name: "Weather",
  kind: "objects",
  visible: true,
  locked: false,
  opacity: 1,
  zIndex: 60,
};

function addLayerCommand(commandId = "add-weather", revision = 0): MapDocumentCommand {
  return {
    commandId,
    documentId: "map",
    baseRevision: revision,
    type: "add-layer",
    layer: weatherLayer,
  };
}

describe("MapStudioService", () => {
  it("creates, retrieves, and lists documents by recent activity", () => {
    const service = new MapStudioService();
    service.create("room", { id: "old", name: "Old", timestamp: 10 });
    service.create("room", { id: "new", name: "New", timestamp: 20 });

    expect(service.get("room", "old").name).toBe("Old");
    expect(service.list("room").map((document) => document.id)).toEqual(["new", "old"]);
    expect(service.list("other")).toEqual([]);
  });

  it("rejects duplicate and missing documents", () => {
    const service = new MapStudioService();
    service.create("room", { id: "map", name: "Map" });

    expect(() => service.create("room", { id: " map ", name: "Again" })).toThrow(
      MapDocumentAlreadyExistsError,
    );
    expect(() => service.get("room", "missing")).toThrow(MapDocumentNotFoundError);
    expect(() => service.delete("room", "missing")).toThrow(MapDocumentNotFoundError);
  });

  it("applies revision-aware commands and persists their results", () => {
    const service = new MapStudioService();
    service.create("room", { id: "map", name: "Map", timestamp: 1 });
    const result = service.apply("room", addLayerCommand(), 2);

    expect(result.revision).toBe(1);
    expect(service.get("room", "map").layers.at(-1)?.id).toBe("weather");
  });

  it("returns an idempotent result when a command is retried", () => {
    const service = new MapStudioService();
    service.create("room", { id: "map", name: "Map", timestamp: 1 });
    const first = service.apply("room", addLayerCommand(), 2);
    first.document.name = "Mutated response";
    const retry = service.apply("room", addLayerCommand(), 999);

    expect(retry.revision).toBe(1);
    expect(retry.document.name).toBe("Map");
    expect(retry.document.updatedAt).toBe(2);
  });

  it("rejects concurrent stale changes", () => {
    const service = new MapStudioService();
    service.create("room", { id: "map", name: "Map" });
    service.apply("room", addLayerCommand("first"));

    expect(() => service.apply("room", addLayerCommand("second"))).toThrow(
      MapDocumentRevisionConflictError,
    );
  });

  it("undoes and redoes edits while keeping revisions monotonic", () => {
    const service = new MapStudioService();
    service.create("room", { id: "map", name: "Map", timestamp: 1 });
    service.apply("room", addLayerCommand(), 2);
    expect(service.historyStatus("room", "map")).toEqual({ canUndo: true, canRedo: false });

    const undone = service.apply(
      "room",
      { commandId: "undo", documentId: "map", baseRevision: 1, type: "undo" },
      3,
    );
    expect(undone.document.layers.some((layer) => layer.id === "weather")).toBe(false);
    expect(undone.revision).toBe(2);
    expect(service.historyStatus("room", "map")).toEqual({ canUndo: false, canRedo: true });

    const redone = service.apply(
      "room",
      { commandId: "redo", documentId: "map", baseRevision: 2, type: "redo" },
      4,
    );
    expect(redone.document.layers.at(-1)?.id).toBe("weather");
    expect(redone.revision).toBe(3);
    expect(service.historyStatus("room", "map")).toEqual({ canUndo: true, canRedo: false });
  });

  it("clears redo history after a new edit and rejects stale history commands", () => {
    const service = new MapStudioService();
    service.create("room", { id: "map", name: "Map", timestamp: 1 });
    service.apply("room", addLayerCommand(), 2);
    service.apply(
      "room",
      { commandId: "undo", documentId: "map", baseRevision: 1, type: "undo" },
      3,
    );
    service.apply(
      "room",
      {
        commandId: "new-edit",
        documentId: "map",
        baseRevision: 2,
        type: "update-grid",
        update: { size: 64 },
      },
      4,
    );

    expect(service.historyStatus("room", "map")).toEqual({ canUndo: true, canRedo: false });
    expect(() =>
      service.apply("room", {
        commandId: "stale",
        documentId: "map",
        baseRevision: 1,
        type: "undo",
      }),
    ).toThrow(MapDocumentRevisionConflictError);
    expect(() =>
      service.apply("room", {
        commandId: "redo",
        documentId: "map",
        baseRevision: 3,
        type: "redo",
      }),
    ).toThrow("Nothing to redo");
  });

  it("returns the latest document when an old idempotent command is retried", () => {
    const service = new MapStudioService();
    service.create("room", { id: "map", name: "Map", timestamp: 1 });
    service.apply("room", addLayerCommand("first"), 2);
    service.apply(
      "room",
      {
        commandId: "second",
        documentId: "map",
        baseRevision: 1,
        type: "update-grid",
        update: { size: 64 },
      },
      3,
    );

    const retry = service.apply("room", addLayerCommand("first"), 99);
    expect(retry.document).toMatchObject({ revision: 2, grid: { size: 64 } });
  });

  it("keeps command idempotency and documents isolated by room", () => {
    const service = new MapStudioService();
    service.create("room-a", { id: "map", name: "A" });
    service.create("room-b", { id: "map", name: "B" });
    service.apply("room-a", addLayerCommand());
    service.apply("room-b", addLayerCommand());

    expect(service.get("room-a", "map").revision).toBe(1);
    expect(service.get("room-b", "map").revision).toBe(1);
  });

  it("deletes documents and their cached command results", () => {
    const service = new MapStudioService();
    service.create("room", { id: "map", name: "Map" });
    service.apply("room", addLayerCommand());
    service.delete("room", "map");
    service.create("room", { id: "map", name: "Replacement" });

    const applied = service.apply("room", addLayerCommand());
    expect(applied.document.name).toBe("Replacement");
  });

  it.each(["", "   "])("requires a room id for every operation", (roomId) => {
    const service = new MapStudioService();
    expect(() => service.create(roomId, { id: "map", name: "Map" })).toThrow("Room id is required");
    expect(() => service.get(roomId, "map")).toThrow("Room id is required");
    expect(() => service.list(roomId)).toThrow("Room id is required");
    expect(() => service.apply(roomId, addLayerCommand())).toThrow("Room id is required");
    expect(() => service.delete(roomId, "map")).toThrow("Room id is required");
  });
});
