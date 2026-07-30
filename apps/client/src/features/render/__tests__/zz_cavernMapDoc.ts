// TEMPORARY benchmark fixture — assembles the lava-cavern-study MapDocument
// from zz_cavernMapGen's cell/stamp output. Import-schema-complete (all seven
// grid fields, default layer set) so the JSON round-trips through the server's
// importDocument validator and can be live-bound on the table.

import {
  createTerrainMap,
  setTerrainCells,
  type MapDocument,
  type MapElement,
  type TerrainCellWrite,
} from "@herobyte/shared";
import { buildCavernMap } from "./zz_cavernMapGen";

export const CAV_CELL_PX = 50;

const LAYERS = [
  { id: "background", name: "Background", kind: "background", zIndex: 0, locked: true },
  { id: "terrain", name: "Terrain", kind: "terrain", zIndex: 10, locked: false },
  { id: "objects", name: "Objects", kind: "objects", zIndex: 20, locked: false },
  { id: "walls", name: "Walls & Doors", kind: "walls", zIndex: 30, locked: false },
  { id: "lighting", name: "Lighting", kind: "lighting", zIndex: 40, locked: false },
  { id: "notes", name: "GM Notes", kind: "notes", zIndex: 50, locked: false },
] as const;

export function buildCavernDocument(): MapDocument {
  const cav = buildCavernMap();

  const writes: TerrainCellWrite[] = [];
  for (const [k, assetId] of cav.cells) {
    const [x, y] = k.split(",").map(Number) as [number, number];
    writes.push({ x, y, assetId });
  }
  const terrain = setTerrainCells(createTerrainMap(), writes);

  const px = CAV_CELL_PX;
  const elements: MapElement[] = cav.stamps.map((stamp, i) => {
    const wPx = stamp.cellsW * px;
    const hPx = stamp.cellsH * px;
    return {
      id: `cavern-stamp-${i + 1}`,
      layerId: "objects",
      type: "stamp",
      locked: false,
      hidden: false,
      transform: {
        x: stamp.centerX * px - wPx / 2,
        y: stamp.centerY * px - hPx / 2,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      },
      data: {
        assetId: stamp.assetId,
        width: wPx,
        height: hPx,
        ...(stamp.tint ? { tint: stamp.tint } : {}),
      },
    } as MapElement;
  });

  // Chain hoists slung between the forge platforms — the spline arc's sagged
  // spans are exactly the reference's rigging.
  const chains: [number, number, number, number][] = [
    [5, 15, 13, 24],
    [35, 15, 29, 24],
    [13, 24, 29, 24],
  ];
  chains.forEach(([x0, y0, x1, y1], i) => {
    elements.push({
      id: `cavern-chain-${i + 1}`,
      layerId: "objects",
      type: "spline",
      locked: false,
      hidden: false,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      data: {
        kind: "chain",
        points: [
          { x: x0 * px, y: y0 * px },
          { x: ((x0 + x1) / 2) * px, y: ((y0 + y1) / 2) * px },
          { x: x1 * px, y: y1 * px },
        ],
      },
    } as MapElement);
  });

  return {
    schemaVersion: 1,
    id: "benchmark-lava-cavern",
    name: "Benchmark — Lava Cavern Study",
    width: cav.width * px,
    height: cav.height * px,
    grid: {
      type: "square",
      size: px,
      squareSize: 5,
      offsetX: 0,
      offsetY: 0,
      visible: true,
      snap: true,
    },
    layers: LAYERS.map((layer) => ({
      id: layer.id,
      name: layer.name,
      kind: layer.kind,
      visible: true,
      locked: layer.locked,
      opacity: 1,
      zIndex: layer.zIndex,
    })),
    elements,
    terrain,
    revision: 0,
    createdAt: 0,
    updatedAt: 0,
  } as MapDocument;
}
