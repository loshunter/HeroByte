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

  it("replies with a typed not-found error for a get of a missing document (dangling binding)", () => {
    // A maps-store reset under a room that kept its live binding: throwing
    // here only nacks the wire envelope, which the client retries and then
    // drops silently — the stuck-STARTING bug. A typed reply lets the client
    // drop the dangling binding and offer a fresh start.
    const result = handler.handle({ t: "map-studio-get", documentId: "gone" }, "dm", "room", true);

    expect(result).toEqual({ broadcast: false, save: false });
    expect(send).toHaveBeenCalledWith(
      "dm",
      expect.objectContaining({
        t: "map-studio-error",
        code: "not-found",
        documentId: "gone",
        reason: expect.stringContaining("not found"),
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

  describe("map-studio-import", () => {
    function serializedDocument(id = "restored") {
      const source = service.create("room", { id: "source", name: "Backup Keep", timestamp: 1 });
      return JSON.parse(JSON.stringify({ ...source, id })) as typeof source;
    }

    it("restores a serialized document and broadcasts it to DMs", () => {
      const document = serializedDocument();

      const result = handler.handle({ t: "map-studio-import", document }, "dm", "room", true);

      expect(result).toEqual({ broadcast: false, save: false });
      expect(service.get("room", "restored").name).toBe("Backup Keep");
      expect(broadcast).toHaveBeenCalledWith(
        "room",
        expect.objectContaining({
          t: "map-studio-document",
          document: expect.objectContaining({ id: "restored", createdAt: 100 }),
        }),
      );
    });

    it("rejects importing over an existing document id", () => {
      const document = serializedDocument("source");

      expect(() =>
        handler.handle({ t: "map-studio-import", document }, "dm", "room", true),
      ).toThrow("Map document already exists: source");
    });
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

    function paintWater(baseRevision: number): void {
      service.apply(
        "room",
        {
          commandId: `paint-${baseRevision}`,
          documentId: "map",
          baseRevision,
          type: "paint-terrain",
          cells: [
            { x: 0, y: 0, assetId: "terrain:water" },
            { x: 1, y: 0, assetId: "terrain:water" },
          ],
        },
        3,
      );
    }

    function publish(backgroundMode?: "full" | "elements-only"): void {
      handler.handle(
        {
          t: "map-studio-publish",
          documentId: "map",
          background: "data:image/svg+xml,live",
          backgroundMode,
        },
        "dm",
        "room",
        true,
      );
    }

    it("attaches point-in-time terrain when the background is elements-only", () => {
      createPublishedDocument();
      paintWater(1);

      publish("elements-only");

      const documentTerrain = service.get("room", "map").terrain;
      expect(roomState.mapTerrain?.grid).toEqual({ size: 50, offsetX: 0, offsetY: 0 });
      expect(roomState.mapTerrain?.terrain).toEqual(documentTerrain);
      expect(roomState.mapTerrain?.opacity).toBe(1);
      // Point-in-time copy: later document edits must not mutate the
      // published scene through a shared reference.
      expect(roomState.mapTerrain?.terrain).not.toBe(documentTerrain);
    });

    it("carries the terrain layer's fractional opacity so the table matches the baked render", () => {
      createPublishedDocument();
      paintWater(1);
      service.apply(
        "room",
        {
          commandId: "dim-terrain",
          documentId: "map",
          baseRevision: 2,
          type: "update-layer",
          layerId: "terrain",
          update: { opacity: 0.4 },
        },
        4,
      );

      publish("elements-only");

      expect(roomState.mapTerrain?.opacity).toBe(0.4);
    });

    it("clears previously published terrain when a legacy full background arrives", () => {
      createPublishedDocument();
      paintWater(1);
      publish("elements-only");
      expect(roomState.mapTerrain).toBeDefined();

      publish(undefined);

      // A full background has terrain baked in — attaching data terrain too
      // would draw it twice at the table.
      expect(roomState.mapTerrain).toBeUndefined();
    });

    it("publishes no terrain when the terrain-kind layer is hidden", () => {
      createPublishedDocument();
      paintWater(1);
      service.apply(
        "room",
        {
          commandId: "hide-terrain",
          documentId: "map",
          baseRevision: 2,
          type: "update-layer",
          layerId: "terrain",
          update: { visible: false },
        },
        4,
      );

      publish("elements-only");

      expect(roomState.mapTerrain).toBeUndefined();
    });

    it("publishes no terrain for a document with none painted", () => {
      createPublishedDocument();

      publish("elements-only");

      expect(roomState.mapTerrain).toBeUndefined();
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
