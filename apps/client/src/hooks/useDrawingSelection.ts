// ============================================================================
// DRAWING SELECTION HOOK
// ============================================================================
// Manages selection state and interaction for drawing objects
// Handles selection, deselection, and provides drag callbacks

import { useState, useCallback, useEffect } from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { ClientMessage, SceneObject } from "@shared";

export interface UseDrawingSelectionProps {
  selectMode: boolean;
  sendMessage: (msg: ClientMessage) => void;
  drawingObjects: (SceneObject & { type: "drawing" })[];
}

export function useDrawingSelection({
  selectMode,
  sendMessage,
  drawingObjects,
}: UseDrawingSelectionProps) {
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);

  /**
   * Select a drawing by ID
   */
  const selectDrawing = useCallback(
    (drawingId: string | null) => {
      if (drawingId) {
        if (drawingId === selectedDrawingId) {
          return;
        }
        sendMessage({ t: "select-drawing", id: drawingId });
        setSelectedDrawingId(drawingId);
      } else {
        if (selectedDrawingId !== null) {
          sendMessage({ t: "deselect-drawing" });
          setSelectedDrawingId(null);
        }
      }
    },
    [sendMessage, selectedDrawingId],
  );

  /**
   * Deselect when clicking empty space
   */
  const deselectIfEmpty = useCallback(
    (event: KonvaEventObject<Event>) => {
      const target = event.target as Konva.Node;
      if (selectMode && target === target.getStage()) {
        if (selectedDrawingId !== null) {
          sendMessage({ t: "deselect-drawing" });
          setSelectedDrawingId(null);
        }
      }
    },
    [selectMode, selectedDrawingId, sendMessage],
  );

  useEffect(() => {
    const ids = new Set(drawingObjects.map((object) => object.data.drawing.id));
    if (selectedDrawingId && !ids.has(selectedDrawingId)) {
      sendMessage({ t: "deselect-drawing" });
      setSelectedDrawingId(null);
    }
  }, [drawingObjects, selectedDrawingId, sendMessage]);

  return {
    selectedDrawingId,
    selectDrawing,
    deselectIfEmpty,
  };
}
