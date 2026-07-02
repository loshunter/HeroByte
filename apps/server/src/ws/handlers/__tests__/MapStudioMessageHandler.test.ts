import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ClientMessage,
  MapDocumentCommand,
  MapWallElement,
  MapDoorElement,
  ServerMessage,
} from "@herobyte/shared";
import { MapStudioService } from "../../../domains/mapStudio/service.js";
import { createEmptyRoomState, type RoomState } from "../../../domains/room/model.js";
import { MapStudioMessageHandler } from "../MapStudioMessageHandler.js";

describe("MapStudioMessageHandler", () => {
  const send = vi.fn<(targetUid: string, message: ServerMessage) => void>();
  const broadcast = vi.fn<(roomId: string, message: ServerMessage) => void>();
  let service: MapStudioService;
  let roomState: RoomState;
  let handler: MapStudioMessageHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MapStudioService();
    roomState = createEmptyRoomState();
    handler = new MapStudioMessageHandler(
      service,
      send,
      broadcast,
      () => roomState,
      () => 100,
    );
  });

  it("ignores messages outside the Map Studio namespace", () => {
    expect(handler.handle({ t: "heartbeat" }, "dm", "room", true)).toBeNull();
  });

  it("rejects every Map Studio action from a non-DM", () => {
    expect(() => handler.handle({ t: "map-studio-list" }, "player", "room", false)).toThrow(
      "require DM permission",
    );
    expect(send).not.toHaveBeenCalled();
    expect(broadcast).not.toHaveBeenCalled();
  });

  it("creates a document using the server timestamp and broadcasts it to DMs", () => {
    const result = handler.handle(
      { t: "map-studio-create", document: { id: "map", name: "Keep", timestamp: 1 } },
      "dm",
      "room",
      true,
    );

    expect(result).toEqual({ broadcast: false, save: false });
    expect(broadcast).toHaveBeenCalledWith(
      "room",
      expect.objectContaining({
        t: "map-studio-document",
        document: expect.objectContaining({ id: "map", createdAt: 100, updatedAt: 100 }),
      }),
    );
  });

  it("lists summaries without sending full authoring elements", () => {
    service.create("room", { id: "map", name: "Keep", timestamp: 1 });
    handler.handle({ t: "map-studio-list" }, "dm", "room", true);

    expect(send).toHaveBeenCalledWith("dm", {
      t: "map-studio-documents",
      documents: [
        {
          id: "map",
          name: "Keep",
          width: 2048,
          height: 2048,
          revision: 0,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
  });

  it("retrieves one document directly to the requesting DM", () => {
    service.create("room", { id: "map", name: "Keep", timestamp: 1 });
    handler.handle({ t: "map-studio-get", documentId: "map" }, "dm", "room", true);

    expect(send).toHaveBeenCalledWith(
      "dm",
      expect.objectContaining({
        t: "map-studio-document",
        document: expect.objectContaining({ id: "map" }),
      }),
    );
  });

  it("applies an editing command and broadcasts its command id", () => {
    service.create("room", { id: "map", name: "Keep", timestamp: 1 });
    const command: MapDocumentCommand = {
      commandId: "edit-1",
      documentId: "map",
      baseRevision: 0,
      type: "update-layer",
      layerId: "terrain",
      update: { name: "Ground" },
    };
    handler.handle({ t: "map-studio-command", command }, "dm", "room", true);

    expect(broadcast).toHaveBeenCalledWith(
      "room",
      expect.objectContaining({
        t: "map-studio-document",
        appliedCommandId: "edit-1",
        document: expect.objectContaining({ revision: 1, updatedAt: 100 }),
      }),
    );
  });

  it("returns a structured conflict without dropping subsequent messages", () => {
    service.create("room", { id: "map", name: "Keep", timestamp: 1 });
    const command: MapDocumentCommand = {
      commandId: "stale-edit",
      documentId: "map",
      baseRevision: 4,
      type: "update-layer",
      layerId: "terrain",
      update: { visible: false },
    };

    expect(() =>
      handler.handle({ t: "map-studio-command", command }, "dm", "room", true),
    ).not.toThrow();
    expect(send).toHaveBeenCalledWith("dm", {
      t: "map-studio-error",
      commandId: "stale-edit",
      documentId: "map",
      code: "revision-conflict",
      reason: "Map document revision conflict: expected 4, actual 0",
      actualRevision: 0,
    });
    expect(broadcast).not.toHaveBeenCalled();
  });

  it("deletes a document and broadcasts its identifier", () => {
    service.create("room", { id: "map", name: "Keep" });
    handler.handle({ t: "map-studio-delete", documentId: "map" }, "dm", "room", true);

    expect(broadcast).toHaveBeenCalledWith("room", {
      t: "map-studio-deleted",
      documentId: "map",
    });
    expect(service.list("room")).toEqual([]);
  });

  describe("map-studio-publish", () => {
    const wall: MapWallElement = {
      id: "wall-1",
      layerId: "walls",
      type: "wall",
      locked: false,
      hidden: false,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      data: {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        blocksMovement: true,
        blocksVision: true,
      },
    };
    const door: MapDoorElement = {
      id: "door-1",
      layerId: "walls",
      type: "door",
      locked: false,
      hidden: false,
      transform: { x: 100, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      data: { width: 50, state: "closed", blocksMovement: true, blocksVision: true },
    };

    function createPublishedDocument(): void {
      service.create("room", { id: "map", name: "Keep", timestamp: 1 });
      service.apply(
        "room",
        {
          commandId: "seed-1",
          documentId: "map",
          baseRevision: 0,
          type: "add-elements",
          elements: [wall, door],
        },
        2,
      );
    }

    it("compiles the document into room state and requests broadcast + save", () => {
      createPublishedDocument();

      const result = handler.handle(
        { t: "map-studio-publish", documentId: "map", background: "data:image/svg+xml,live" },
        "dm",
        "room",
        true,
      );

      expect(result).toEqual({ broadcast: true, save: true });
      expect(roomState.mapBackground).toBe("data:image/svg+xml,live");
      expect(roomState.gridSize).toBe(50);
      expect(roomState.gridSquareSize).toBe(5);
      expect(roomState.compiledScene).toMatchObject({
        sourceDocumentId: "map",
        sourceRevision: 1,
        compiledAt: 100,
        walls: [expect.objectContaining({ id: "wall-1#0" })],
        doors: [expect.objectContaining({ id: "door-1", state: "closed" })],
      });
    });

    it("recompiles on republish so the live scene follows the document", () => {
      createPublishedDocument();
      handler.handle(
        { t: "map-studio-publish", documentId: "map", background: "data:image/svg+xml,v1" },
        "dm",
        "room",
        true,
      );
      service.apply(
        "room",
        {
          commandId: "seed-2",
          documentId: "map",
          baseRevision: 1,
          type: "remove-element",
          elementId: "door-1",
        },
        3,
      );

      handler.handle(
        { t: "map-studio-publish", documentId: "map", background: "data:image/svg+xml,v2" },
        "dm",
        "room",
        true,
      );

      expect(roomState.mapBackground).toBe("data:image/svg+xml,v2");
      expect(roomState.compiledScene?.sourceRevision).toBe(2);
      expect(roomState.compiledScene?.doors).toEqual([]);
    });

    it("rejects publishing a document that does not exist", () => {
      expect(() =>
        handler.handle(
          { t: "map-studio-publish", documentId: "missing", background: "data:image/svg+xml,x" },
          "dm",
          "room",
          true,
        ),
      ).toThrow("Map document not found");
      expect(roomState.compiledScene).toBeUndefined();
      expect(roomState.mapBackground).toBeUndefined();
    });
  });

  it.each([
    { t: "map-studio-list" },
    { t: "map-studio-get", documentId: "missing" },
  ] as ClientMessage[])("always returns a handled result for $t when successful", (message) => {
    if (message.t === "map-studio-get") {
      service.create("room", { id: "missing", name: "Found" });
    }
    expect(handler.handle(message, "dm", "room", true)).toEqual({
      broadcast: false,
      save: false,
    });
  });
});
