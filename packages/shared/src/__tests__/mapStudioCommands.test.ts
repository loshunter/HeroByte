import { describe, expect, it } from "vitest";
import {
  MapDocumentRevisionConflictError,
  applyMapDocumentCommand,
  createMapDocument,
  type MapDocument,
  type MapDocumentCommand,
  type MapStampElement,
  type MapTileElement,
} from "../index.js";

function document(): MapDocument {
  return createMapDocument({ id: "map-1", name: "Keep", timestamp: 1 });
}

function command(
  update: Omit<
    Extract<MapDocumentCommand, { type: "update-layer" }>,
    "commandId" | "documentId" | "baseRevision"
  >,
): MapDocumentCommand {
  return {
    commandId: "command-1",
    documentId: "map-1",
    baseRevision: 0,
    ...update,
  };
}

function stamp(): MapStampElement {
  return {
    id: "barrel",
    layerId: "objects",
    type: "stamp",
    locked: false,
    hidden: false,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: { assetId: "asset:barrel", width: 50, height: 50 },
  };
}

function tile(id: string, x: number, y: number): MapTileElement {
  return {
    id,
    layerId: "terrain",
    type: "tile",
    locked: false,
    hidden: false,
    transform: { x, y, scaleX: 1, scaleY: 1, rotation: 0 },
    data: { assetId: "terrain:stone-floor", columns: 1, rows: 1 },
  };
}

describe("applyMapDocumentCommand", () => {
  it("applies a command and returns revision metadata", () => {
    const result = applyMapDocumentCommand(
      document(),
      command({ type: "update-layer", layerId: "terrain", update: { name: "Ground" } }),
      10,
    );

    expect(result).toMatchObject({
      commandId: "command-1",
      documentId: "map-1",
      previousRevision: 0,
      revision: 1,
    });
    expect(result.document.layers.find((layer) => layer.id === "terrain")?.name).toBe("Ground");
  });

  it("trims the command id in the acknowledgement", () => {
    const result = applyMapDocumentCommand(document(), {
      ...command({ type: "update-layer", layerId: "terrain", update: {} }),
      commandId: " command ",
    });
    expect(result.commandId).toBe("command");
  });

  it("rejects stale revisions with structured conflict details", () => {
    const first = applyMapDocumentCommand(
      document(),
      command({ type: "update-layer", layerId: "terrain", update: { name: "Ground" } }),
    );

    expect(() =>
      applyMapDocumentCommand(
        first.document,
        command({ type: "update-layer", layerId: "terrain", update: { name: "Floor" } }),
      ),
    ).toThrow(MapDocumentRevisionConflictError);

    try {
      applyMapDocumentCommand(
        first.document,
        command({ type: "update-layer", layerId: "terrain", update: {} }),
      );
    } catch (error) {
      expect(error).toMatchObject({ expectedRevision: 0, actualRevision: 1 });
    }
  });

  it.each([
    [
      { ...command({ type: "update-layer", layerId: "terrain", update: {} }), commandId: " " },
      "Map command id is required",
    ],
    [
      {
        ...command({ type: "update-layer", layerId: "terrain", update: {} }),
        documentId: "other",
      },
      "Map command document mismatch",
    ],
    [
      {
        ...command({ type: "update-layer", layerId: "terrain", update: {} }),
        baseRevision: -1,
      },
      "non-negative integer",
    ],
    [
      {
        ...command({ type: "update-layer", layerId: "terrain", update: {} }),
        baseRevision: 0.5,
      },
      "non-negative integer",
    ],
  ])("rejects malformed command %#", (input, message) => {
    expect(() => applyMapDocumentCommand(document(), input as MapDocumentCommand)).toThrow(message);
  });

  it("supports the complete editing command set", () => {
    let current = document();

    const commands: ((revision: number) => MapDocumentCommand)[] = [
      (baseRevision) => ({
        commandId: "update-grid",
        documentId: "map-1",
        baseRevision,
        type: "update-grid",
        update: { size: 64, snap: false },
      }),
      (baseRevision) => ({
        commandId: "add-layer",
        documentId: "map-1",
        baseRevision,
        type: "add-layer",
        layer: {
          id: "weather",
          name: "Weather",
          kind: "objects",
          visible: true,
          locked: false,
          opacity: 1,
          zIndex: 60,
        },
      }),
      (baseRevision) => ({
        commandId: "move-layer",
        documentId: "map-1",
        baseRevision,
        type: "move-layer",
        layerId: "weather",
        targetIndex: 1,
      }),
      (baseRevision) => ({
        commandId: "add-element",
        documentId: "map-1",
        baseRevision,
        type: "add-element",
        element: stamp(),
      }),
      (baseRevision) => ({
        commandId: "add-elements",
        documentId: "map-1",
        baseRevision,
        type: "add-elements",
        elements: [tile("floor-a", 0, 0), tile("floor-b", 50, 0)],
      }),
      (baseRevision) => ({
        commandId: "update-element",
        documentId: "map-1",
        baseRevision,
        type: "update-element",
        elementId: "barrel",
        update: { hidden: true },
      }),
      (baseRevision) => ({
        commandId: "remove-element",
        documentId: "map-1",
        baseRevision,
        type: "remove-element",
        elementId: "barrel",
      }),
      (baseRevision) => ({
        commandId: "remove-layer",
        documentId: "map-1",
        baseRevision,
        type: "remove-layer",
        layerId: "weather",
      }),
    ];

    commands.forEach((buildCommand, index) => {
      current = applyMapDocumentCommand(
        current,
        buildCommand(current.revision),
        10 + index,
      ).document;
    });

    expect(current.revision).toBe(8);
    expect(current.grid).toMatchObject({ size: 64, snap: false });
    expect(current.layers.some((layer) => layer.id === "weather")).toBe(false);
    expect(current.elements.map((element) => element.id)).toEqual(["floor-a", "floor-b"]);
  });

  it("adds multiple elements in one revision", () => {
    const result = applyMapDocumentCommand(
      document(),
      {
        commandId: "batch",
        documentId: "map-1",
        baseRevision: 0,
        type: "add-elements",
        elements: [tile("floor-a", 0, 0), tile("floor-b", 50, 0)],
      },
      20,
    );

    expect(result.revision).toBe(1);
    expect(result.document.elements.map((element) => element.id)).toEqual(["floor-a", "floor-b"]);
  });
});
