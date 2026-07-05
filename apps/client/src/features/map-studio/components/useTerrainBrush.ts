import { useCallback, useRef, useState } from "react";
import type { MapDocument, TerrainPaintCell } from "@herobyte/shared";

const MAX_STROKE_CELLS = 16384;

interface UseTerrainBrushOptions {
  activeDocument?: MapDocument | null;
  paintTerrain: (cells: TerrainPaintCell[]) => void;
}

/**
 * Terrain stroke accumulator: cells collect (deduped) while the pointer is
 * down and commit as ONE paint-terrain command on release — one undo step
 * per stroke, per the Terrain Brush contract. strokeCells drives the live
 * in-progress preview on the canvas.
 */
export function useTerrainBrush({ activeDocument, paintTerrain }: UseTerrainBrushOptions) {
  const stroke = useRef(new Map<string, TerrainPaintCell>());
  const [strokeCells, setStrokeCells] = useState<TerrainPaintCell[]>([]);

  const addStrokePoint = useCallback(
    (point: { x: number; y: number }, assetId: string | null) => {
      if (!activeDocument || stroke.current.size >= MAX_STROKE_CELLS) return;
      const { size, offsetX, offsetY } = activeDocument.grid;
      const cellX = Math.floor((point.x - offsetX) / size);
      const cellY = Math.floor((point.y - offsetY) / size);
      // Only cells fully inside the document are paintable.
      const left = offsetX + cellX * size;
      const top = offsetY + cellY * size;
      if (left < 0 || top < 0 || left + size > activeDocument.width) return;
      if (top + size > activeDocument.height) return;
      const key = `${cellX},${cellY}`;
      if (stroke.current.has(key)) return;
      const cell = { x: cellX, y: cellY, assetId };
      stroke.current.set(key, cell);
      setStrokeCells((current) => [...current, cell]);
    },
    [activeDocument],
  );

  const flushStroke = useCallback(() => {
    const cells = [...stroke.current.values()];
    stroke.current = new Map();
    setStrokeCells([]);
    if (cells.length > 0) paintTerrain(cells);
  }, [paintTerrain]);

  return { addStrokePoint, flushStroke, strokeCells };
}
