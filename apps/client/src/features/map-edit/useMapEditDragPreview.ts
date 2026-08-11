// ============================================================================
// MAP-EDIT DRAG PREVIEW
// ============================================================================
// The in-flight drag and the rAF-throttled preview it paints, lifted out of
// useMapEditTool so that hook has room to grow. Pure mechanism with no map-edit
// knowledge: a start point, a moving end point, and one setState per animation
// frame rather than one per pointer move.
//
// The REF is the source of truth and the state is only what renders. Every
// commit path re-reads `current()` rather than the rendered value, which is
// what lets a cancel arriving mid-gesture take effect: clearing the ref makes
// the release commit nothing.

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomDrag } from "../map-studio/components/MapStudioWorkspace.types";

interface Point {
  x: number;
  y: number;
}

export interface MapEditDragPreview {
  /** What renders. Trails `current()` by at most one animation frame. */
  previewDrag: RoomDrag | null;
  /** The live drag, or null between gestures. Stable identity. */
  current: () => RoomDrag | null;
  /** Start a drag at `point` (paints immediately — a press should show). */
  begin: (point: Point) => void;
  /** Move the drag's end to `point`, painting on the next frame. */
  extend: (point: Point) => void;
  /** Abandon the drag and whatever frame it had pending. */
  clear: () => void;
}

export function useMapEditDragPreview(): MapEditDragPreview {
  const [previewDrag, setPreviewDrag] = useState<RoomDrag | null>(null);
  const dragRef = useRef<RoomDrag | null>(null);
  const frameRef = useRef<number | null>(null);

  const cancelFrame = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    dragRef.current = null;
    cancelFrame();
    setPreviewDrag(null);
  }, [cancelFrame]);

  useEffect(() => () => cancelFrame(), [cancelFrame]);

  const flush = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setPreviewDrag(dragRef.current ? { ...dragRef.current } : null);
    });
  }, []);

  const current = useCallback(() => dragRef.current, []);

  const begin = useCallback((point: Point) => {
    dragRef.current = { start: point, end: point };
    setPreviewDrag({ start: point, end: point });
  }, []);

  const extend = useCallback(
    (point: Point) => {
      if (!dragRef.current) return;
      dragRef.current = { start: dragRef.current.start, end: point };
      flush();
    },
    [flush],
  );

  return { previewDrag, current, begin, extend, clear };
}
