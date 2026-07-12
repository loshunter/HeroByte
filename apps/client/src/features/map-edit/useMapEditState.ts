// ============================================================================
// MAP-EDIT STATE (glue hook)
// ============================================================================
// Owns the live map-edit palette state and the bind flow. Drives the ONE
// App-level MapStudioController — never a second useMapStudio (two queues would
// revision-conflict). Mirrors useDrawingStateManager's shape: takes the
// controller + sendMessage + mode + setActiveTool, returns palette props.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage } from "@herobyte/shared";
import type { ToolMode } from "../../components/layout/Header";
import type { MapStudioController } from "../map-studio/types";
import { useMapEditHotkeys } from "./useMapEditHotkeys";
import type { MapEditFloorFamily, MapEditSubTool, MapEditToolbarProps } from "./mapEditTypes";

interface UseMapEditStateOptions {
  controller: MapStudioController;
  sendMessage: (message: ClientMessage) => void;
  mapEditMode: boolean;
  setActiveTool: (tool: ToolMode) => void;
  /** The room's live-bound document id (from the snapshot), if any. */
  liveMapDocumentId: string | undefined;
  /** The room's current live grid size, synced onto a freshly created document. */
  roomGridSize: number;
  /** True when the room still carries a raster background (double-draw hint). */
  hasRasterBackground: boolean;
  /** Surface a server-side map-studio error to the DM (e.g. a toast). */
  notifyError?: (message: string) => void;
}

interface UseMapEditStateReturn {
  activeSubTool: MapEditSubTool;
  /** Floor terrain family the room sub-tool paints. */
  floorFamily: MapEditFloorFamily;
  /** Keep the DM walls overlay visible even outside map-edit mode. */
  wallsOverlayPinned: boolean;
  toolbarProps: MapEditToolbarProps;
}

const LIVE_MAP_SIZE = 8192;

export function useMapEditState({
  controller,
  sendMessage,
  mapEditMode,
  setActiveTool,
  liveMapDocumentId,
  roomGridSize,
  hasRasterBackground,
  notifyError,
}: UseMapEditStateOptions): UseMapEditStateReturn {
  const [activeSubTool, setActiveSubTool] = useState<MapEditSubTool>("wall");
  const [floorFamily, setFloorFamily] = useState<MapEditFloorFamily>("grass");
  // The id of a document we just created and are waiting to activate before
  // binding it live (createDocument returns synchronously, but the controller
  // no-ops every action until the server's map-studio-document reply lands).
  const [pendingLiveId, setPendingLiveId] = useState<string | null>(null);
  // True from the moment START LIVE MAP is clicked until the room snapshot
  // confirms the binding (isLive). Without it, the button briefly re-enables
  // between "set-live sent" and "snapshot confirms", so a double-click would
  // create a second orphan "Live Map" document.
  const [awaitingLiveBind, setAwaitingLiveBind] = useState(false);
  // Pin the DM-only walls overlay so it stays visible after leaving map-edit
  // mode (in map-edit it always shows; the pin persists it beyond that).
  const [wallsOverlayPinned, setWallsOverlayPinned] = useState(false);

  // Stable controller methods (useCallback-memoized inside useMapStudio); the
  // controller OBJECT is recreated each render, so depend on these, not it.
  const { activeDocument, loading, createDocument, openDocument, updateGrid, undo, redo } =
    controller;
  const activeId = activeDocument?.id;

  const isLive = Boolean(liveMapDocumentId) && activeId === liveMapDocumentId;

  // Ctrl/Cmd+Z / +Y route to the active (live) map document while map-edit is
  // on; the useKeyboardShortcuts selection-undo branch is guarded off in the
  // same mode so exactly one handler acts.
  useMapEditHotkeys({
    mapEditMode,
    canUndo: controller.canUndo,
    canRedo: controller.canRedo,
    undo,
    redo,
  });

  // Surface a server-side map-studio error (revision conflict, rejected command)
  // as a toast while editing — the palette also shows it inline, but the DM's
  // focus is usually on the canvas. Fires once per error: the controller resets
  // error to null before each command, so a recurring failure re-toasts.
  const lastError = useRef<string | null>(null);
  useEffect(() => {
    const err = controller.error;
    if (err && err !== lastError.current && mapEditMode) notifyError?.(err);
    lastError.current = err;
  }, [controller.error, mapEditMode, notifyError]);

  const startLiveMap = useCallback(() => {
    if (awaitingLiveBind) return; // a create/bind is already in flight
    if (activeId && activeId === liveMapDocumentId) return; // already live
    setAwaitingLiveBind(true);
    if (liveMapDocumentId) {
      openDocument(liveMapDocumentId);
      return;
    }
    setPendingLiveId(createDocument("Live Map", LIVE_MAP_SIZE, LIVE_MAP_SIZE));
  }, [awaitingLiveBind, activeId, liveMapDocumentId, openDocument, createDocument]);

  // Release the latch once the binding is confirmed live by the room snapshot.
  useEffect(() => {
    if (isLive) setAwaitingLiveBind(false);
  }, [isLive]);

  // Create → bind: once the freshly created document activates, bind it live and
  // sync its grid to the room. set-live FIRST so the grid command rides the S1
  // live-recompile hook and the table lattice self-corrects (§3).
  useEffect(() => {
    if (!pendingLiveId || activeId !== pendingLiveId) return;
    sendMessage({ t: "map-studio-set-live", documentId: pendingLiveId });
    updateGrid({ size: roomGridSize });
    setPendingLiveId(null);
  }, [pendingLiveId, activeId, sendMessage, updateGrid, roomGridSize]);

  // Rebind after a reload: entering map-edit with a live binding but no active
  // document (fresh controller) auto-opens it. The loading guard prevents the
  // effect from re-firing while the fetch is in flight.
  useEffect(() => {
    if (!mapEditMode || !liveMapDocumentId || pendingLiveId || loading) return;
    if (activeId === liveMapDocumentId) return;
    openDocument(liveMapDocumentId);
  }, [mapEditMode, liveMapDocumentId, pendingLiveId, loading, activeId, openDocument]);

  const onClose = useCallback(() => setActiveTool(null), [setActiveTool]);
  const onToggleWallsOverlay = useCallback(() => setWallsOverlayPinned((pinned) => !pinned), []);

  const toolbarProps: MapEditToolbarProps = {
    isLive,
    busy: awaitingLiveBind || pendingLiveId !== null || loading,
    activeSubTool,
    onSelectSubTool: setActiveSubTool,
    floorFamily,
    onSelectFloorFamily: setFloorFamily,
    canUndo: controller.canUndo,
    canRedo: controller.canRedo,
    onUndo: undo,
    onRedo: redo,
    onStartLiveMap: startLiveMap,
    onClose,
    hasRasterBackground,
    error: controller.error,
    wallsOverlayPinned,
    onToggleWallsOverlay,
  };

  return { activeSubTool, floorFamily, wallsOverlayPinned, toolbarProps };
}
