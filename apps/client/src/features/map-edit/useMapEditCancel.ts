import { useCallback, useLayoutEffect, useRef, type MutableRefObject } from "react";
import type { RoomDrag } from "../map-studio/components/MapStudioWorkspace.types";
import { escapeRegistry, useEscapeOwner } from "../interaction/useEscapeOwner";
import type { MapEditSubTool } from "./mapEditTypes";

interface UseMapEditCancelOptions {
  active: boolean;
  subTool: MapEditSubTool;
  documentId: string | undefined;
  liveDocumentId: string | undefined;
  brushContext?: string;
  cancelSignal: number | undefined;
  currentDrag: () => RoomDrag | null;
  currentAim: () => boolean;
  clearDrag: () => void;
  brushingRef: MutableRefObject<boolean>;
  discardStroke: () => void;
  cancelAim: () => void;
}

/** Every cancellation disarms live refs before a later move/release can publish. */
export function useMapEditCancel({
  active,
  subTool,
  documentId,
  liveDocumentId,
  brushContext,
  cancelSignal,
  currentDrag,
  currentAim,
  clearDrag,
  brushingRef,
  discardStroke,
  cancelAim,
}: UseMapEditCancelOptions): () => void {
  const cancelGesture = useCallback(() => {
    brushingRef.current = false;
    clearDrag();
    cancelAim();
    discardStroke();
    escapeRegistry.refresh();
  }, [brushingRef, clearDrag, cancelAim, discardStroke]);

  useEscapeOwner(() => ({
    kind: "gesture",
    name: "live-map-gesture",
    active: active && Boolean(brushingRef.current || currentDrag() || currentAim()),
    order: 20,
    label: brushingRef.current ? "Cancel stroke" : "Cancel placement",
    handle: cancelGesture,
  }));

  // Revision/object/callback changes are not document or tool transitions.
  const previous = useRef([active, subTool, documentId, liveDocumentId, brushContext] as const);
  useLayoutEffect(() => {
    const next = [active, subTool, documentId, liveDocumentId, brushContext] as const;
    const changed = next.some((value, index) => value !== previous.current[index]);
    previous.current = next;
    if (changed) cancelGesture();
  }, [active, subTool, documentId, liveDocumentId, brushContext, cancelGesture]);

  const seen = useRef(cancelSignal);
  useLayoutEffect(() => {
    if (seen.current === cancelSignal) return;
    seen.current = cancelSignal;
    cancelGesture();
  }, [cancelSignal, cancelGesture]);

  const cancelRef = useRef(cancelGesture);
  useLayoutEffect(() => {
    cancelRef.current = cancelGesture;
  });
  useLayoutEffect(() => () => cancelRef.current(), []);
  return cancelGesture;
}
