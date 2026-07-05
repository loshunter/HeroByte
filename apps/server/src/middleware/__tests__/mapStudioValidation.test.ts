import { describe, expect, it } from "vitest";
import { validateMessage } from "../validation.js";

const transform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };

describe("Map Studio message validation", () => {
  it.each([
    { t: "map-studio-list" },
    { t: "map-studio-get", documentId: "map" },
    { t: "map-studio-delete", documentId: "map" },
    {
      t: "map-studio-create",
      document: {
        id: "map",
        name: "Keep",
        width: 2048,
        height: 2048,
        grid: { type: "square", size: 50, squareSize: 5, snap: true },
      },
    },
    { t: "map-studio-publish", documentId: "map", background: "data:image/svg+xml,render" },
    {
      t: "map-studio-import",
      document: {
        schemaVersion: 1,
        id: "restored",
        name: "Backup Keep",
        width: 2048,
        height: 2048,
        grid: {
          type: "square",
          size: 50,
          squareSize: 5,
          offsetX: 0,
          offsetY: 0,
          visible: true,
          snap: true,
        },
        layers: [
          {
            id: "terrain",
            name: "Terrain",
            kind: "terrain",
            visible: true,
            locked: false,
            opacity: 1,
            zIndex: 10,
          },
        ],
        elements: [],
        revision: 4,
        createdAt: 1,
        updatedAt: 2,
      },
    },
  ])("accepts control message $t", (message) => {
    expect(validateMessage(message)).toEqual({ valid: true });
  });

  it.each([
    { t: "map-studio-import" },
    { t: "map-studio-import", document: { schemaVersion: 2 } },
    { t: "map-studio-import", document: { schemaVersion: 1, id: "x" } },
  ])("rejects malformed import payload %#", (message) => {
    expect(validateMessage(message).valid).toBe(false);
  });

  it.each([
    { cells: [] }, // empty stroke
    { cells: [{ x: 0.5, y: 0, assetId: "a" }] }, // fractional cell
    { cells: [{ x: 99999999, y: 0, assetId: "a" }] }, // out of range
    { cells: [{ x: 0, y: 0, assetId: "" }] }, // blank asset id
    { cells: [{ x: 0, y: 0 }] }, // missing assetId (null must be explicit)
    {
      cells: Array.from({ length: 16385 }, (_, index) => ({
        x: index % 128,
        y: Math.floor(index / 128),
        assetId: "a",
      })),
    }, // oversized stroke
  ])("rejects malformed paint-terrain payload %#", (payload) => {
    expect(
      validateMessage({
        t: "map-studio-command",
        command: {
          commandId: "command",
          documentId: "map",
          baseRevision: 0,
          type: "paint-terrain",
          ...payload,
        },
      }).valid,
    ).toBe(false);
  });

  it("accepts imported documents carrying a terrain map and rejects malformed ones", () => {
    const base = {
      schemaVersion: 1,
      id: "map",
      name: "Keep",
      width: 2048,
      height: 2048,
      grid: {
        type: "square",
        size: 50,
        squareSize: 5,
        offsetX: 0,
        offsetY: 0,
        visible: true,
        snap: true,
      },
      layers: [
        {
          id: "terrain",
          name: "Terrain",
          kind: "terrain",
          visible: true,
          locked: false,
          opacity: 1,
          zIndex: 10,
        },
      ],
      elements: [],
      revision: 0,
      createdAt: 1,
      updatedAt: 1,
    };
    const terrain = {
      schemaVersion: 1,
      palette: ["terrain:stone-floor"],
      chunks: { "0,0": [4, 1, 252, 0] },
    };

    expect(validateMessage({ t: "map-studio-import", document: { ...base, terrain } }).valid).toBe(
      true,
    );
    expect(
      validateMessage({
        t: "map-studio-import",
        document: { ...base, terrain: { ...terrain, chunks: { "evil key": [4, 1, 252, 0] } } },
      }).valid,
    ).toBe(false);
    expect(
      validateMessage({
        t: "map-studio-import",
        document: { ...base, terrain: { ...terrain, palette: [""] } },
      }).valid,
    ).toBe(false);
  });

  it.each([
    { t: "map-studio-publish", documentId: "", background: "data:image/svg+xml,render" },
    { t: "map-studio-publish", documentId: "map", background: "" },
    { t: "map-studio-publish", documentId: "map" },
  ])("rejects malformed publish payload %#", (message) => {
    expect(validateMessage(message).valid).toBe(false);
  });

  it.each([
    { type: "undo" },
    { type: "redo" },
    { type: "update-grid", update: { type: "hex-row", size: 64, snap: false } },
    {
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
    },
    { type: "update-layer", layerId: "terrain", update: { opacity: 0.5 } },
    { type: "move-layer", layerId: "terrain", targetIndex: 1 },
    { type: "remove-layer", layerId: "weather" },
    {
      type: "add-element",
      element: {
        id: "barrel",
        layerId: "objects",
        type: "stamp",
        locked: false,
        hidden: false,
        transform,
        data: { assetId: "barrel", width: 50, height: 50 },
      },
    },
    {
      type: "add-elements",
      elements: [
        {
          id: "floor-a",
          layerId: "terrain",
          type: "tile",
          locked: false,
          hidden: false,
          transform,
          data: { assetId: "terrain:stone-floor", columns: 1, rows: 1 },
        },
        {
          id: "floor-b",
          layerId: "terrain",
          type: "tile",
          locked: false,
          hidden: false,
          transform: { ...transform, x: 50 },
          data: { assetId: "terrain:stone-floor", columns: 1, rows: 1 },
        },
      ],
    },
    { type: "update-element", elementId: "barrel", update: { transform } },
    { type: "remove-element", elementId: "barrel" },
    {
      type: "paint-terrain",
      cells: [
        { x: 0, y: 0, assetId: "terrain:stone-floor" },
        { x: -3, y: 12, assetId: null },
      ],
    },
  ])("accepts $type commands", (payload) => {
    expect(
      validateMessage({
        t: "map-studio-command",
        command: { commandId: "command", documentId: "map", baseRevision: 0, ...payload },
      }),
    ).toEqual({ valid: true });
  });

  it.each([
    [{ t: "map-studio-get", documentId: "" }, "documentId"],
    [{ t: "map-studio-create", document: { id: "map", name: "", width: 20 } }, "name"],
    [
      {
        t: "map-studio-create",
        document: { id: "map", name: "Map", width: 40000 },
      },
      "width",
    ],
    [
      {
        t: "map-studio-command",
        command: {
          commandId: "command",
          documentId: "map",
          baseRevision: -1,
          type: "remove-element",
          elementId: "barrel",
        },
      },
      "baseRevision",
    ],
    [
      {
        t: "map-studio-command",
        command: {
          commandId: "command",
          documentId: "map",
          baseRevision: 0,
          type: "add-element",
          element: {
            id: "wall",
            layerId: "walls",
            type: "wall",
            locked: false,
            hidden: false,
            transform,
            data: {
              points: [{ x: 0, y: 0 }],
              blocksMovement: true,
              blocksVision: true,
            },
          },
        },
      },
      "points",
    ],
    [
      {
        t: "map-studio-command",
        command: {
          commandId: "command",
          documentId: "map",
          baseRevision: 0,
          type: "unknown",
        },
      },
      "type",
    ],
  ])("rejects invalid payload %#", (message, path) => {
    const result = validateMessage(message);
    expect(result.valid).toBe(false);
    expect(result.error).toContain(path as string);
  });
});
