// ============================================================================
// DRAWING SELECTION HOOK
// ============================================================================
// Manages selection state and interaction for drawing objects
// Handles selection, deselection, and provides drag callbacks

import { useState, useCallback } from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { ClientMessage } from "@shared";

export interface UseDrawingSelectionProps {
  selectMode: boolean;
  sendMessage: (msg: ClientMessage) => void;
}

export function useDrawingSelection({ selectMode, sendMessage }: UseDrawingSelectionProps) {
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);

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
      const dx = node.x();
      const dy = node.y();

      // Send movement to server
      if (dx !== 0 || dy !== 0) {
        sendMessage({
          t: "move-drawing",
          id: drawingId,
          dx,
          dy,
        });
      }

      // Reset position (server will broadcast the updated drawing)
      node.position({ x: 0, y: 0 });
    },
    [sendMessage],
  );

  return {
    selectedDrawingId,
    selectDrawing,
    deselectIfEmpty,
    onDrawingDragEnd,
  };
}
