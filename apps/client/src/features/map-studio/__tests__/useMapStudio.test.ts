import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMapDocument, type ClientMessage } from "@herobyte/shared";
import { useMapStudio } from "../useMapStudio";

describe("useMapStudio", () => {
  const sendMessage = vi.fn<(message: ClientMessage) => void>();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("threads room credentials into asset uploads", async () => {
    const body = {
      hash: "a".repeat(64),
      url: `/assets/${"a".repeat(64)}`,
      mime: "image/png",
      size: 4,
      deduplicated: false,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const { result } = renderHook(() =>
        useMapStudio(sendMessage, () => ({ secret: "hush", roomId: "room-1" })),
      );
      const file = new File([new Uint8Array(4)], "torch.png", { type: "image/png" });
      await expect(result.current.uploadAsset(file)).resolves.toEqual(body);
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.headers).toMatchObject({
        "x-herobyte-secret": "hush",
        "x-herobyte-room": "room-1",
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects uploads before authentication with no-credentials", async () => {
    const { result } = renderHook(() => useMapStudio(sendMessage));
    const file = new File([new Uint8Array(4)], "torch.png", { type: "image/png" });
    await expect(result.current.uploadAsset(file)).rejects.toMatchObject({
      code: "no-credentials",
    });
  });

  it("requests the room's map document list", () => {
    const { result } = renderHook(() => useMapStudio(sendMessage));
    act(() => result.current.refresh());

    expect(result.current.loading).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith({ t: "map-studio-list" });
  });

  it("creates and activates a new document from its server response", () => {
    const { result } = renderHook(() => useMapStudio(sendMessage));
    let id = "";
    act(() => {
      id = result.current.createDocument("Keep", 4096, 2048);
    });
    expect(sendMessage).toHaveBeenCalledWith({
      t: "map-studio-create",
      document: { id, name: "Keep", width: 4096, height: 2048 },
    });

    const document = createMapDocument({ id, name: "Keep", width: 4096, timestamp: 10 });
    act(() => result.current.handleServerMessage({ t: "map-studio-document", document }));

    expect(result.current.activeDocument?.id).toBe(id);
    expect(result.current.documents[0]).toMatchObject({ id, name: "Keep" });
    expect(result.current.loading).toBe(false);
  });

  it("loads summaries and opens a selected document", () => {
    const { result } = renderHook(() => useMapStudio(sendMessage));
    act(() =>
      result.current.handleServerMessage({
        t: "map-studio-documents",
        documents: [
          {
            id: "map",
            name: "Keep",
            width: 2048,
            height: 2048,
            revision: 2,
            createdAt: 1,
            updatedAt: 2,
          },
        ],
      }),
    );
    expect(result.current.documents).toHaveLength(1);

    act(() => result.current.openDocument("map"));
    expect(sendMessage).toHaveBeenLastCalledWith({ t: "map-studio-get", documentId: "map" });
    expect(result.current.loading).toBe(true);

    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    act(() => result.current.handleServerMessage({ t: "map-studio-document", document }));
    expect(result.current.activeDocument?.id).toBe("map");
  });

  it("publishes the active document with its rendered background", () => {
    const { result } = renderHook(() => useMapStudio(sendMessage));
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    act(() => result.current.handleServerMessage({ t: "map-studio-document", document }));

    let published = false;
    act(() => {
      published = result.current.publishDocument("data:image/svg+xml,render");
    });

    expect(published).toBe(true);
    expect(sendMessage).toHaveBeenLastCalledWith({
      t: "map-studio-publish",
      documentId: "map",
      background: "data:image/svg+xml,render",
    });
  });

  it("publishes with an explicit background mode when the caller supplies one", () => {
    const { result } = renderHook(() => useMapStudio(sendMessage));
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    act(() => result.current.handleServerMessage({ t: "map-studio-document", document }));

    act(() => {
      result.current.publishDocument("data:image/svg+xml,render", "map", "elements-only");
    });

    expect(sendMessage).toHaveBeenLastCalledWith({
      t: "map-studio-publish",
      documentId: "map",
      background: "data:image/svg+xml,render",
      backgroundMode: "elements-only",
    });
  });

  it("refuses to publish when no document is active", () => {
    const { result } = renderHook(() => useMapStudio(sendMessage));

    let published = true;
    act(() => {
      published = result.current.publishDocument("data:image/svg+xml,render");
    });

    expect(published).toBe(false);
    expect(sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ t: "map-studio-publish" }),
    );
  });

  it("imports a backup under a fresh id and activates the restored document", () => {
    const { result } = renderHook(() => useMapStudio(sendMessage));
    const backup = createMapDocument({ id: "old-id", name: "Backup Keep", timestamp: 1 });

    let importedId = "";
    act(() => {
      importedId = result.current.importDocument(backup);
    });

    expect(importedId).not.toBe("old-id");
    expect(result.current.loading).toBe(true);
    expect(sendMessage).toHaveBeenLastCalledWith({
      t: "map-studio-import",
      document: { ...backup, id: importedId },
    });

    const restored = { ...backup, id: importedId };
    act(() => result.current.handleServerMessage({ t: "map-studio-document", document: restored }));
    expect(result.current.activeDocument?.id).toBe(importedId);
    expect(result.current.loading).toBe(false);
  });

  it("does not replace the active document when another DM edits a different map", () => {
    const { result } = renderHook(() => useMapStudio(sendMessage));
    const active = createMapDocument({ id: "active", name: "Active", timestamp: 1 });
    act(() => result.current.handleServerMessage({ t: "map-studio-document", document: active }));

    const other = createMapDocument({ id: "other", name: "Other", timestamp: 2 });
    act(() => result.current.handleServerMessage({ t: "map-studio-document", document: other }));

    expect(result.current.activeDocument?.id).toBe("active");
    expect(result.current.documents.map((document) => document.id)).toEqual(["other", "active"]);
  });

  it("sequences rapid revision-aware edits using each server revision", () => {
    const { result } = renderHook(() => useMapStudio(sendMessage));
    const document = createMapDocument({ id: "map", name: "Map", timestamp: 1 });
    document.revision = 7;
    act(() => result.current.handleServerMessage({ t: "map-studio-document", document }));

    act(() => result.current.updateLayer("terrain", { opacity: 0.5 }));
    const updateMessage = sendMessage.mock.calls.at(-1)?.[0];
    expect(updateMessage).toMatchObject({
      t: "map-studio-command",
      command: {
        documentId: "map",
        baseRevision: 7,
        type: "update-layer",
        layerId: "terrain",
        update: { opacity: 0.5 },
      },
    });
    const firstCommandId =
      updateMessage?.t === "map-studio-command" ? updateMessage.command.commandId : "";

    act(() => result.current.moveLayer("terrain", 2));
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(result.current.saving).toBe(true);

    const revised = { ...document, revision: 8, updatedAt: 2 };
    act(() =>
      result.current.handleServerMessage({
        t: "map-studio-document",
        document: revised,
        appliedCommandId: firstCommandId,
      }),
    );
    expect(sendMessage.mock.calls.at(-1)?.[0]).toMatchObject({
      t: "map-studio-command",
      command: {
        documentId: "map",
        baseRevision: 8,
        type: "move-layer",
        layerId: "terrain",
        targetIndex: 2,
      },
    });
  });

  it("creates and removes map shapes through the command queue", () => {
    const { result } = renderHook(() => useMapStudio(sendMessage));
    const document = createMapDocument({ id: "map", name: "Map", timestamp: 1 });
    act(() => result.current.handleServerMessage({ t: "map-studio-document", document }));

    let shapeId: string | null = null;
    act(() => {
      shapeId = result.current.addShape({
        layerId: "terrain",
        shape: "ellipse",
        x: 64,
        y: 96,
        width: 256,
        height: 128,
        fill: "#111111",
        stroke: "#eeeeee",
      });
    });
    expect(shapeId).toBeTruthy();
    expect(sendMessage.mock.calls.at(-1)?.[0]).toMatchObject({
      t: "map-studio-command",
      command: {
        type: "add-element",
        element: {
          id: shapeId,
          type: "shape",
          layerId: "terrain",
          transform: { x: 64, y: 96 },
          data: {
            shape: "ellipse",
            points: [
              { x: 0, y: 0 },
              { x: 256, y: 128 },
            ],
          },
        },
      },
    });
  });

  it("creates tile elements through the command queue", () => {
    const { result } = renderHook(() => useMapStudio(sendMessage));
    const document = createMapDocument({ id: "map", name: "Map", timestamp: 1 });
    act(() => result.current.handleServerMessage({ t: "map-studio-document", document }));

    let tileId: string | null = null;
    act(() => {
      tileId = result.current.addTile({
        layerId: "terrain",
        assetId: "terrain:stone-floor",
        x: 100,
        y: 150,
        columns: 1,
        rows: 1,
      });
    });

    expect(tileId).toBeTruthy();
    expect(sendMessage.mock.calls.at(-1)?.[0]).toMatchObject({
      t: "map-studio-command",
      command: {
        type: "add-element",
        element: {
          id: tileId,
          type: "tile",
          layerId: "terrain",
          transform: { x: 100, y: 150 },
          data: {
            assetId: "terrain:stone-floor",
            columns: 1,
            rows: 1,
          },
        },
      },
    });
  });

  it("creates free-placed stamp elements through the command queue", () => {
    const { result } = renderHook(() => useMapStudio(sendMessage));
    const document = createMapDocument({ id: "map", name: "Map", timestamp: 1 });
    act(() => result.current.handleServerMessage({ t: "map-studio-document", document }));

    let stampId: string | null = null;
    act(() => {
      stampId = result.current.addStamp({
        layerId: "objects",
        assetId: "objects:crate",
        x: 48,
        y: 36,
        width: 50,
        height: 50,
      });
    });

    expect(stampId).toBeTruthy();
    expect(sendMessage.mock.calls.at(-1)?.[0]).toMatchObject({
      t: "map-studio-command",
      command: {
        type: "add-element",
        element: {
          id: stampId,
          type: "stamp",
          layerId: "objects",
          transform: { x: 48, y: 36, rotation: 0, scaleX: 1, scaleY: 1 },
          data: {
            assetId: "objects:crate",
            width: 50,
            height: 50,
          },
        },
      },
    });
  });

  it("paints terrain strokes through the command queue", () => {
    const { result } = renderHook(() => useMapStudio(sendMessage));
    const document = createMapDocument({ id: "map", name: "Map", timestamp: 1 });
    act(() => result.current.handleServerMessage({ t: "map-studio-document", document }));

    act(() => {
      result.current.paintTerrain([
        { x: 0, y: 0, assetId: "terrain:stone-floor" },
        { x: 1, y: 0, assetId: null },
      ]);
    });

    expect(sendMessage.mock.calls.at(-1)?.[0]).toMatchObject({
      t: "map-studio-command",
      command: {
        type: "paint-terrain",
        cells: [
          { x: 0, y: 0, assetId: "terrain:stone-floor" },
          { x: 1, y: 0, assetId: null },
        ],
      },
    });
  });

  it("creates a whole scatter of stamps as one undoable command", () => {
    const { result } = renderHook(() => useMapStudio(sendMessage));
    const document = createMapDocument({ id: "map", name: "Map", timestamp: 1 });
    act(() => result.current.handleServerMessage({ t: "map-studio-document", document }));

    let ids: string[] = [];
    act(() => {
      ids = result.current.addStamps([
        {
          layerId: "objects",
          assetId: "objects:crate",
          x: 10,
          y: 10,
          width: 50,
          height: 50,
          rotation: 45,
        },
        {
          layerId: "objects",
          assetId: "objects:crate",
          x: 90,
          y: 30,
          width: 50,
          height: 50,
          rotation: 300,
        },
      ]);
    });

    expect(ids).toHaveLength(2);
    expect(sendMessage.mock.calls.at(-1)?.[0]).toMatchObject({
      t: "map-studio-command",
      command: {
        type: "add-elements",
        elements: [
          expect.objectContaining({
            type: "stamp",
            transform: expect.objectContaining({ rotation: 45 }),
          }),
          expect.objectContaining({
            type: "stamp",
            transform: expect.objectContaining({ rotation: 300 }),
          }),
        ],
      },
    });
  });

  it("creates multiple tile elements through one revision-aware command", () => {
    const { result } = renderHook(() => useMapStudio(sendMessage));
    const document = createMapDocument({ id: "map", name: "Map", timestamp: 1 });
    act(() => result.current.handleServerMessage({ t: "map-studio-document", document }));

    let tileIds: string[] = [];
    act(() => {
      tileIds = result.current.addTiles([
        {
          layerId: "terrain",
          assetId: "terrain:stone-floor",
          x: 0,
          y: 0,
          columns: 1,
          rows: 1,
        },
        {
          layerId: "walls",
          assetId: "structures:stone-wall",
          x: 50,
          y: 0,
          columns: 1,
          rows: 1,
        },
      ]);
    });

    expect(tileIds).toHaveLength(2);
    expect(sendMessage.mock.calls.at(-1)?.[0]).toMatchObject({
      t: "map-studio-command",
      command: {
        type: "add-elements",
        elements: [
          {
            id: tileIds[0],
            type: "tile",
            layerId: "terrain",
            transform: { x: 0, y: 0 },
            data: { assetId: "terrain:stone-floor", columns: 1, rows: 1 },
          },
          {
            id: tileIds[1],
            type: "tile",
            layerId: "walls",
            transform: { x: 50, y: 0 },
            data: { assetId: "structures:stone-wall", columns: 1, rows: 1 },
          },
        ],
      },
    });
  });

  it("creates wall and door elements through revision-aware commands", () => {
    const { result } = renderHook(() => useMapStudio(sendMessage));
    const document = createMapDocument({ id: "map", name: "Map", timestamp: 1 });
    act(() => result.current.handleServerMessage({ t: "map-studio-document", document }));

    let wallId: string | null = null;
    act(() => {
      wallId = result.current.addWall({
        layerId: "walls",
        x1: 10,
        y1: 20,
        x2: 200,
        y2: 20,
        blocksMovement: true,
        blocksVision: true,
      });
    });
    expect(sendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        t: "map-studio-command",
        command: expect.objectContaining({
          type: "add-element",
          element: expect.objectContaining({
            id: wallId,
            type: "wall",
            layerId: "walls",
            data: expect.objectContaining({
              points: [
                { x: 10, y: 20 },
                { x: 200, y: 20 },
              ],
              blocksMovement: true,
              blocksVision: true,
            }),
          }),
        }),
      }),
    );

    const sent = sendMessage.mock.calls.at(-1)?.[0];
    const commandId = sent?.t === "map-studio-command" ? sent.command.commandId : "";
    act(() =>
      result.current.handleServerMessage({
        t: "map-studio-document",
        document: { ...document, revision: 1, updatedAt: 2 },
        appliedCommandId: commandId,
      }),
    );

    let doorId: string | null = null;
    act(() => {
      doorId = result.current.addDoor({
        layerId: "walls",
        x: 100,
        y: 20,
        width: 50,
        rotation: 90,
        state: "locked",
        blocksMovement: true,
        blocksVision: false,
      });
    });
    expect(sendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        t: "map-studio-command",
        command: expect.objectContaining({
          type: "add-element",
          baseRevision: 1,
          element: expect.objectContaining({
            id: doorId,
            type: "door",
            layerId: "walls",
            transform: expect.objectContaining({ x: 100, y: 20, rotation: 90 }),
            data: {
              width: 50,
              state: "locked",
              blocksMovement: true,
              blocksVision: false,
            },
          }),
        }),
      }),
    );
  });

  it("recovers from a revision conflict by reloading before the next queued edit", () => {
    const { result } = renderHook(() => useMapStudio(sendMessage));
    const document = createMapDocument({ id: "map", name: "Map", timestamp: 1 });
    act(() => result.current.handleServerMessage({ t: "map-studio-document", document }));
    act(() => result.current.updateLayer("terrain", { visible: false }));
    act(() => result.current.moveLayer("terrain", 2));
    const sent = sendMessage.mock.calls[0]?.[0];
    const commandId = sent?.t === "map-studio-command" ? sent.command.commandId : "";

    act(() =>
      result.current.handleServerMessage({
        t: "map-studio-error",
        commandId,
        documentId: "map",
        code: "revision-conflict",
        reason: "Map changed elsewhere",
        actualRevision: 1,
      }),
    );
    expect(result.current.error).toBe("Map changed elsewhere");
    expect(sendMessage).toHaveBeenLastCalledWith({ t: "map-studio-get", documentId: "map" });

    const current = { ...document, revision: 1, updatedAt: 2 };
    act(() => result.current.handleServerMessage({ t: "map-studio-document", document: current }));
    expect(sendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        t: "map-studio-command",
        command: expect.objectContaining({ type: "move-layer", baseRevision: 1 }),
      }),
    );
  });

  it("does not send editing commands without an active document", () => {
    const { result } = renderHook(() => useMapStudio(sendMessage));
    act(() => result.current.updateLayer("terrain", { visible: false }));
    act(() => result.current.moveLayer("terrain", 0));
    act(() => result.current.updateGrid({ size: 64 }));
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("sends document grid changes as revision-aware commands", () => {
    const { result } = renderHook(() => useMapStudio(sendMessage));
    const document = createMapDocument({ id: "map", name: "Map", timestamp: 1 });
    act(() => result.current.handleServerMessage({ t: "map-studio-document", document }));
    act(() => result.current.updateGrid({ type: "isometric", size: 80, snap: false }));

    expect(sendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        t: "map-studio-command",
        command: expect.objectContaining({
          documentId: "map",
          baseRevision: 0,
          type: "update-grid",
          update: { type: "isometric", size: 80, snap: false },
        }),
      }),
    );
  });

  it("updates an element transform through the revision queue", () => {
    const { result } = renderHook(() => useMapStudio(sendMessage));
    const document = createMapDocument({ id: "map", name: "Map", timestamp: 1 });
    act(() => result.current.handleServerMessage({ t: "map-studio-document", document }));
    const transform = { x: 120, y: 80, scaleX: 1.5, scaleY: 1, rotation: 30 };
    act(() => result.current.updateElement("shape", { transform, hidden: true }));

    expect(sendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        t: "map-studio-command",
        command: expect.objectContaining({
          type: "update-element",
          elementId: "shape",
          update: { transform, hidden: true },
        }),
      }),
    );
  });

  it("uses server-backed history state for undo and redo", () => {
    const { result } = renderHook(() => useMapStudio(sendMessage));
    const document = createMapDocument({ id: "map", name: "Map", timestamp: 1 });
    act(() =>
      result.current.handleServerMessage({
        t: "map-studio-document",
        document,
        history: { canUndo: true, canRedo: false },
      }),
    );
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => result.current.undo());
    expect(sendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        t: "map-studio-command",
        command: expect.objectContaining({ type: "undo", baseRevision: 0 }),
      }),
    );

    const command = sendMessage.mock.calls.at(-1)?.[0];
    const commandId = command?.t === "map-studio-command" ? command.command.commandId : "";
    act(() =>
      result.current.handleServerMessage({
        t: "map-studio-document",
        document: { ...document, revision: 1 },
        appliedCommandId: commandId,
        history: { canUndo: false, canRedo: true },
      }),
    );
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.redo());
    expect(sendMessage.mock.calls.at(-1)?.[0]).toMatchObject({
      t: "map-studio-command",
      command: { type: "redo", baseRevision: 1 },
    });
  });

  it("deletes documents and clears the active selection after confirmation response", () => {
    const { result } = renderHook(() => useMapStudio(sendMessage));
    const document = createMapDocument({ id: "map", name: "Map" });
    act(() => result.current.handleServerMessage({ t: "map-studio-document", document }));

    act(() => result.current.deleteDocument("map"));
    expect(sendMessage).toHaveBeenLastCalledWith({ t: "map-studio-delete", documentId: "map" });

    act(() => result.current.handleServerMessage({ t: "map-studio-deleted", documentId: "map" }));
    expect(result.current.activeDocument).toBeNull();
    expect(result.current.documents).toEqual([]);
  });
});
