// ============================================================================
// DRAWING SELECTION HOOK
// ============================================================================
// Manages selection state and interaction for drawing objects
// Handles selection, deselection, and provides drag callbacks

import { useState, useCallback, useEffect, useRef } from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { ClientMessage, Drawing } from "@shared";

export interface UseDrawingSelectionProps {
  selectMode: boolean;
  sendMessage: (msg: ClientMessage) => void;
  drawings: Drawing[];
}

export function useDrawingSelection({
  selectMode,
  sendMessage,
  drawings,
}: UseDrawingSelectionProps) {
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [localOffsets, setLocalOffsets] = useState<Record<string, { dx: number; dy: number }>>({});
  const drawingsRef = useRef<Drawing[]>(drawings);
  const pendingTargetsRef = useRef<Record<string, { points: { x: number; y: number }[] }>>({});
  const localOffsetsRef = useRef<Record<string, { dx: number; dy: number }>>({});

  useEffect(() => {
    drawingsRef.current = drawings;
  }, [drawings]);

  useEffect(() => {
    localOffsetsRef.current = localOffsets;
  }, [localOffsets]);

  /**
   * Select a drawing by ID
   */
  const selectDrawing = useCallback(
    (drawingId: string | null) => {
      if (drawingId) {
        sendMessage({ t: "select-drawing", id: drawingId });
        setSelectedDrawingId(drawingId);
      } else {
        sendMessage({ t: "deselect-drawing" });
        setSelectedDrawingId(null);
      }
    },
    [sendMessage],
  );

  /**
   * Deselect when clicking empty space
   */
  const deselectIfEmpty = useCallback(
    (event: KonvaEventObject<Event>) => {
      const target = event.target as Konva.Node;
      if (selectMode && target === target.getStage()) {
        selectDrawing(null);
      }
    },
    [selectMode, selectDrawing],
  );

  /**
   * Handle drag end - send final position to server
   */
  const onDrawingDragEnd = useCallback(
    (drawingId: string, event: KonvaEventObject<DragEvent>) => {
      const node = event.target as Konva.Node;
      const absoluteScale = node.getAbsoluteScale();
      const dxStage = node.x();
      const dyStage = node.y();

      const dx = absoluteScale.x !== 0 ? dxStage / absoluteScale.x : dxStage;
      const dy = absoluteScale.y !== 0 ? dyStage / absoluteScale.y : dyStage;

      if (dx !== 0 || dy !== 0) {
        const drawing = drawingsRef.current.find((d) => d.id === drawingId);
        if (drawing) {
          const pendingTarget = pendingTargetsRef.current[drawingId];
          const basePoints = pendingTarget ? pendingTarget.points : drawing.points;
          const targetPoints = basePoints.map((p) => ({ x: p.x + dx, y: p.y + dy }));
          pendingTargetsRef.current[drawingId] = { points: targetPoints };

          setLocalOffsets((prev) => {
            const previous = prev[drawingId];
            const nextOffset = {
              dx: (previous?.dx ?? 0) + dx,
              dy: (previous?.dy ?? 0) + dy,
            };
            return { ...prev, [drawingId]: nextOffset };
          });
        }

        sendMessage({
          t: "move-drawing",
          id: drawingId,
          dx,
          dy,
        });
      }

      node.position({ x: 0, y: 0 });
    },
    [sendMessage],
  );

  // Clear local offsets once the server state matches our pending move targets
  useEffect(() => {
    const pendingIds = Object.keys(pendingTargetsRef.current);
    if (pendingIds.length === 0) return;

    const nextOffsets = { ...localOffsetsRef.current };
    let changed = false;

    for (const drawingId of pendingIds) {
      const target = pendingTargetsRef.current[drawingId];
      const drawing = drawings.find((d) => d.id === drawingId);

      if (!drawing) {
        delete pendingTargetsRef.current[drawingId];
        if (nextOffsets[drawingId]) {
          delete nextOffsets[drawingId];
          changed = true;
        }
        continue;
      }

      const matchesTarget =
        drawing.points.length === target.points.length &&
        drawing.points.every((p, index) => {
          const expected = target.points[index];
          return Math.abs(p.x - expected.x) < 0.1 && Math.abs(p.y - expected.y) < 0.1;
        });

      if (matchesTarget) {
        delete pendingTargetsRef.current[drawingId];
        if (nextOffsets[drawingId]) {
          delete nextOffsets[drawingId];
          changed = true;
        }
      }
    }

    if (changed) {
      setLocalOffsets(nextOffsets);
    }
  }, [drawings]);

  return {
    selectedDrawingId,
    selectDrawing,
    deselectIfEmpty,
    onDrawingDragEnd,
    localOffsets,
  };
}
