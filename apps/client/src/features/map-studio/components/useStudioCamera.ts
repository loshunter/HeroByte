import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
  type WheelEvent,
} from "react";
import type { MapDocument } from "@herobyte/shared";
import type { MapViewBox } from "./MapStudioWorkspace.types";
import {
  clampViewBox,
  eventToMapPoint,
  screenDeltaToMapDelta,
  zoomViewBox,
} from "./mapStudioWorkspaceUtils";

/**
 * The studio camera: view-box state, wheel zoom anchored under the cursor,
 * and drag panning. Resets to the full document whenever the document (or
 * its dimensions) changes.
 */
export function useStudioCamera(
  activeDocument: MapDocument | null | undefined,
  svgRef: RefObject<SVGSVGElement>,
) {
  const panState = useRef<{ pointerId: number; lastClientX: number; lastClientY: number } | null>(
    null,
  );
  const [viewBox, setViewBox] = useState<MapViewBox>({ x: 0, y: 0, width: 2048, height: 2048 });

  useEffect(() => {
    if (!activeDocument) return;
    setViewBox({ x: 0, y: 0, width: activeDocument.width, height: activeDocument.height });
    panState.current = null;
  }, [activeDocument?.id, activeDocument?.width, activeDocument?.height]);

  const handleResetView = () => {
    if (!activeDocument) return;
    setViewBox({ x: 0, y: 0, width: activeDocument.width, height: activeDocument.height });
  };

  const handleZoom = useCallback(
    (factor: number, anchor?: { x: number; y: number }) => {
      if (!activeDocument) return;
      setViewBox((current) => zoomViewBox(current, activeDocument, factor, anchor));
    },
    [activeDocument],
  );

  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    if (!activeDocument) return;
    event.preventDefault();
    const anchor = eventToMapPoint(event, viewBox, svgRef.current);
    handleZoom(event.deltaY < 0 ? 0.82 : 1.18, anchor);
  };

  const startPan = (event: PointerEvent<SVGSVGElement>) => {
    if (!activeDocument) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    panState.current = {
      pointerId: event.pointerId,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
    };
  };

  /** Consumes the move when a pan drag owns this pointer. */
  const handlePanMove = (event: PointerEvent<SVGSVGElement>): boolean => {
    if (!activeDocument || panState.current?.pointerId !== event.pointerId) return false;
    const delta = screenDeltaToMapDelta(
      event.clientX - panState.current.lastClientX,
      event.clientY - panState.current.lastClientY,
      viewBox,
      svgRef.current,
    );
    panState.current = {
      pointerId: event.pointerId,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
    };
    setViewBox((current) =>
      clampViewBox({ ...current, x: current.x - delta.x, y: current.y - delta.y }, activeDocument),
    );
    return true;
  };

  const endPan = () => {
    panState.current = null;
  };

  return { viewBox, handleResetView, handleZoom, handleWheel, startPan, handlePanMove, endPan };
}
