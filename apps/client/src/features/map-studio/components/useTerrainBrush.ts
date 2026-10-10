import { useCallback, useMemo, useRef, useState } from "react";
import type { MapDocument, TerrainPaintCell } from "@herobyte/shared";
import {
  MAX_TERRAIN_STROKE_CELLS,
  terrainBrushFootprint,
  terrainBrushPath,
  type TerrainBrushSize,
} from "../terrainBrushGeometry";

interface UseTerrainBrushOptions {
  activeDocument?: MapDocument | null;
  paintTerrain: (cells: TerrainPaintCell[]) => void;
  brushSize?: TerrainBrushSize;
}

/**
 * Terrain stroke accumulator: cells collect (deduped) while the pointer is
 * down and commit as ONE paint-terrain command on release — one undo step
 * per stroke, per the Terrain Brush contract. strokeCells drives the live
 * in-progress preview on the canvas.
 */
export function useTerrainBrush({
  activeDocument,
  paintTerrain,
  brushSize = 1,
}: UseTerrainBrushOptions) {
  const stroke = useRef(new Map<string, TerrainPaintCell>());
  const previous = useRef<{ x: number; y: number } | null>(null);
  const [strokeCells, setStrokeCells] = useState<TerrainPaintCell[]>([]);
  const [cursor, setCursor] = useState<{
    point: { x: number; y: number };
    assetId: string | null;
  } | null>(null);
  const updateCursor = useCallback(
    (point: { x: number; y: number }, assetId: string | null) => setCursor({ point, assetId }),
    [],
  );
  const clearCursor = useCallback(() => setCursor(null), []);
  const brushPreviewCells = useMemo(
    () =>
      activeDocument && cursor
        ? terrainBrushFootprint(activeDocument, cursor.point, brushSize)
            .filter(
              (cell) =>
                stroke.current.size < MAX_TERRAIN_STROKE_CELLS ||
                stroke.current.has(`${cell.x},${cell.y}`),
            )
            .map((cell) => ({ ...cell, assetId: cursor.assetId }))
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- strokeCells is the render signal for the stroke ref this memo reads
    [activeDocument, cursor, brushSize, strokeCells],
  );

  const addStrokePoint = useCallback(
    (point: { x: number; y: number }, assetId: string | null) => {
      if (!activeDocument || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
      updateCursor(point, assetId);
      const from = previous.current ?? point;
      previous.current = point;
      if (stroke.current.size >= MAX_TERRAIN_STROKE_CELLS) return;
      let changed = false;
      for (const cell of terrainBrushPath(activeDocument, from, point, brushSize)) {
        const key = `${cell.x},${cell.y}`;
        if (stroke.current.has(key)) continue;
        stroke.current.set(key, { ...cell, assetId });
        changed = true;
        if (stroke.current.size >= MAX_TERRAIN_STROKE_CELLS) break;
      }
      if (changed) setStrokeCells([...stroke.current.values()]);
    },
    [activeDocument, brushSize, updateCursor],
  );

  const flushStroke = useCallback(() => {
    const cells = [...stroke.current.values()];
    stroke.current = new Map();
    previous.current = null;
    setStrokeCells([]);
    if (cells.length > 0) paintTerrain(cells);
  }, [paintTerrain]);

  // Throw the stroke away instead of painting it. On touch a second finger
  // means "I want to zoom", not "commit what I have so far" — and without a
  // discard the abandoned cells would simply ride along on the next flush.
  const discardStroke = useCallback(() => {
    stroke.current = new Map();
    previous.current = null;
    setCursor(null);
    setStrokeCells([]);
  }, []);

  return {
    addStrokePoint,
    flushStroke,
    discardStroke,
    strokeCells,
    updateCursor,
    clearCursor,
    brushPreviewCells,
  };
}
