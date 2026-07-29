// TEMPORARY benchmark fixture — assembles the island-grammar-study MapDocument
// from zz_benchmarkMapGen's cell/stamp output. Import-schema-complete (all
// seven grid fields, default layer set) so the JSON round-trips through the
// server's importDocument validator and the session-file restore path.

import {
  createTerrainMap,
  setTerrainCells,
  type MapDocument,
  type MapElement,
  type TerrainCellWrite,
} from "@herobyte/shared";
import { buildBenchmarkMap } from "./zz_benchmarkMapGen";

export const BENCH_CELL_PX = 50;

export function buildBenchmarkDocument(): MapDocument {
  const bench = buildBenchmarkMap();

  const writes: TerrainCellWrite[] = [];
  for (const [k, assetId] of bench.cells) {
    const [x, y] = k.split(",").map(Number) as [number, number];
    writes.push({ x, y, assetId });
  }
  const terrain = setTerrainCells(createTerrainMap(), writes);

  const elements: MapElement[] = bench.stamps.map((stamp, i) => {
    const wPx = stamp.cellsW * BENCH_CELL_PX;
    const hPx = stamp.cellsH * BENCH_CELL_PX;
    return {
      id: `bench-stamp-${i + 1}`,
      layerId: "objects",
      type: "stamp",
      locked: false,
      hidden: false,
      transform: {
        x: stamp.centerX * BENCH_CELL_PX - wPx / 2,
        y: stamp.centerY * BENCH_CELL_PX - hPx / 2,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      },
      data: { assetId: stamp.assetId, width: wPx, height: hPx },
    } as MapElement;
  });

  // Spline arc set dressing: gold filigree sweeping the causeway, a stone
  // ribbon on the dais approach, a rope line at the SE island landing.
  const px = BENCH_CELL_PX;
  const splines: MapElement[] = [
    {
      id: "bench-spline-filigree",
      layerId: "objects",
      type: "spline",
      locked: false,
      hidden: false,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      data: {
        kind: "filigree",
        points: [
          { x: 18.2 * px, y: 50 * px },
          { x: 22.5 * px, y: 49.7 * px },
          { x: 26.8 * px, y: 50 * px },
        ],
      },
    } as MapElement,
    {
      id: "bench-spline-ribbon",
      layerId: "objects",
      type: "spline",
      locked: false,
      hidden: false,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      data: {
        kind: "ribbon",
        points: [
          { x: 21.2 * px, y: 16 * px },
          { x: 21.8 * px, y: 20 * px },
          { x: 22.5 * px, y: 23 * px },
        ],
      },
    } as MapElement,
    {
      id: "bench-spline-rope",
      layerId: "objects",
      type: "spline",
      locked: false,
      hidden: false,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      data: {
        kind: "rope",
        points: [
          { x: 30 * px, y: 40.6 * px },
          { x: 31.5 * px, y: 41.3 * px },
          { x: 33 * px, y: 41 * px },
        ],
      },
    } as MapElement,
  ];
  elements.push(...splines);

  return {
    schemaVersion: 1,
    id: "benchmark-island-study",
    name: "Benchmark — Island Grammar Study",
    width: bench.width * BENCH_CELL_PX,
    height: bench.height * BENCH_CELL_PX,
    grid: {
      type: "square",
      size: BENCH_CELL_PX,
      squareSize: 5,
      offsetX: 0,
      offsetY: 0,
      visible: true,
      snap: true,
    },
    layers: [
      {
        id: "background",
        name: "Background",
        kind: "background",
        visible: true,
        locked: true,
        opacity: 1,
        zIndex: 0,
      },
      {
        id: "terrain",
        name: "Terrain",
        kind: "terrain",
        visible: true,
        locked: false,
        opacity: 1,
        zIndex: 10,
      },
      {
        id: "objects",
        name: "Objects",
        kind: "objects",
        visible: true,
        locked: false,
        opacity: 1,
        zIndex: 20,
      },
      {
        id: "walls",
        name: "Walls & Doors",
        kind: "walls",
        visible: true,
        locked: false,
        opacity: 1,
        zIndex: 30,
      },
      {
        id: "lighting",
        name: "Lighting",
        kind: "lighting",
        visible: true,
        locked: false,
        opacity: 1,
        zIndex: 40,
      },
      {
        id: "notes",
        name: "GM Notes",
        kind: "notes",
        visible: true,
        locked: false,
        opacity: 1,
        zIndex: 50,
      },
    ],
    elements,
    terrain,
    revision: 0,
    createdAt: 0,
    updatedAt: 0,
  };
}
