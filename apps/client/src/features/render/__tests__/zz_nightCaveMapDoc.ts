// TEMPORARY benchmark fixture — assembles the night-flooded-cave MapDocument
// plus its BakeLighting from zz_nightCaveMapGen. Import-schema-complete so the
// JSON round-trips through the server's importDocument validator.

import {
  createTerrainMap,
  setTerrainCells,
  type MapDocument,
  type MapElement,
  type TerrainCellWrite,
} from "@herobyte/shared";
import type { BakeLighting } from "../terrainLighting";
import { buildNightCaveMap } from "./zz_nightCaveMapGen";

export const CAVE_CELL_PX = 50;

/** How dark the cave is. 0.32 puts the veil at ~0.53 and arms the night grade
 * at ~0.62 strength — deep blue dark with lantern pools still readable. */
export const CAVE_AMBIENT = 0.32;

const LAYERS = [
  { id: "background", name: "Background", kind: "background", zIndex: 0, locked: true },
  { id: "terrain", name: "Terrain", kind: "terrain", zIndex: 10, locked: false },
  { id: "objects", name: "Objects", kind: "objects", zIndex: 20, locked: false },
  { id: "walls", name: "Walls & Doors", kind: "walls", zIndex: 30, locked: false },
  { id: "lighting", name: "Lighting", kind: "lighting", zIndex: 40, locked: false },
  { id: "notes", name: "GM Notes", kind: "notes", zIndex: 50, locked: false },
] as const;

export function buildNightCaveDocument(): { doc: MapDocument; lighting: BakeLighting } {
  const cave = buildNightCaveMap();
  const px = CAVE_CELL_PX;

  const writes: TerrainCellWrite[] = [];
  for (const [k, assetId] of cave.cells) {
    const [x, y] = k.split(",").map(Number) as [number, number];
    writes.push({ x, y, assetId });
  }
  const terrain = setTerrainCells(createTerrainMap(), writes);

  const elements: MapElement[] = cave.stamps.map((stamp, i) => {
    const wPx = stamp.cellsW * px;
    const hPx = stamp.cellsH * px;
    return {
      id: `night-cave-stamp-${i + 1}`,
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

  // The lanterns as real LIGHT ELEMENTS on the lighting layer, not only as the
  // BakeLighting below. Without these the document imports to the live table as
  // plain daylight — the pools live in the bake input, which JSON has no home
  // for, so the fixture must carry its own light elements to round-trip.
  cave.lights.forEach((light, i) => {
    elements.push({
      id: `night-cave-light-${i + 1}`,
      layerId: "lighting",
      type: "light",
      locked: false,
      hidden: false,
      transform: {
        x: light.cellX * px,
        y: light.cellY * px,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      },
      data: {
        radius: light.radiusCells * px,
        color: light.color,
        intensity: light.intensity,
        castsShadows: false,
      },
    } as MapElement);
  });

  // Mooring ropes between the landings — the spline arc's sagged spans.
  const ropes: [number, number, number, number][] = [
    [17, 8, 21, 6],
    [26, 17, 31, 21],
    [13, 24, 8, 24],
  ];
  ropes.forEach(([x0, y0, x1, y1], i) => {
    elements.push({
      id: `night-cave-rope-${i + 1}`,
      layerId: "objects",
      type: "spline",
      locked: false,
      hidden: false,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      data: {
        kind: "rope",
        points: [
          { x: x0 * px, y: y0 * px },
          { x: ((x0 + x1) / 2) * px, y: ((y0 + y1) / 2) * px },
          { x: x1 * px, y: y1 * px },
        ],
      },
    } as MapElement);
  });

  const doc = {
    schemaVersion: 1,
    id: "benchmark-night-cave",
    name: "Benchmark — Night Flooded Cave Study",
    width: cave.width * px,
    height: cave.height * px,
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
      // The LIGHTING layer's opacity IS the ambient light level, so the pools
      // only show once it drops below 1 — dim it here or an imported night map
      // opens in broad daylight (lightPlacement.ts).
      opacity: layer.kind === "lighting" ? CAVE_AMBIENT : 1,
      zIndex: layer.zIndex,
    })),
    elements,
    terrain,
    revision: 0,
    createdAt: 0,
    updatedAt: 0,
  } as MapDocument;

  // Lantern positions are cell coords in the generator; BakeLight is world px.
  const lighting: BakeLighting = {
    ambient: CAVE_AMBIENT,
    lights: cave.lights.map((light) => ({
      x: light.cellX * px,
      y: light.cellY * px,
      radius: light.radiusCells * px,
      color: light.color,
      intensity: light.intensity,
      gain: light.gain,
    })),
  };

  return { doc, lighting };
}
