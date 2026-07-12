// ============================================================================
// MAP-EDIT STATE (glue hook)
// ============================================================================
// Owns the live map-edit palette state and the bind flow. Drives the ONE
// App-level MapStudioController — never a second useMapStudio (two queues would
// revision-conflict). Mirrors useDrawingStateManager's shape: takes the
// controller + sendMessage + mode + setActiveTool, returns palette props.

import { useCallback, useEffect, useState } from "react";
import type { ClientMessage } from "@herobyte/shared";
import type { ToolMode } from "../../components/layout/Header";
import type { MapStudioController } from "../map-studio/types";
import type { MapEditSubTool, MapEditToolbarProps } from "./mapEditTypes";

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
}

interface UseMapEditStateReturn {
  activeSubTool: MapEditSubTool;
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
}: UseMapEditStateOptions): UseMapEditStateReturn {
  const [activeSubTool, setActiveSubTool] = useState<MapEditSubTool>("wall");
  // The id of a document we just created and are waiting to activate before
  // binding it live (createDocument returns synchronously, but the controller
  // no-ops every action until the server's map-studio-document reply lands).
  const [pendingLiveId, setPendingLiveId] = useState<string | null>(null);

  // Stable controller methods (useCallback-memoized inside useMapStudio); the
  // controller OBJECT is recreated each render, so depend on these, not it.
  const { activeDocument, loading, createDocument, openDocument, updateGrid, undo, redo } =
    controller;
  const activeId = activeDocument?.id;

  const isLive = Boolean(liveMapDocumentId) && activeId === liveMapDocumentId;

  const startLiveMap = useCallback(() => {
    if (activeId && activeId === liveMapDocumentId) return; // already live
    if (liveMapDocumentId) {
      openDocument(liveMapDocumentId);
      return;
    }
    setPendingLiveId(createDocument("Live Map", LIVE_MAP_SIZE, LIVE_MAP_SIZE));
  }, [activeId, liveMapDocumentId, openDocument, createDocument]);

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

  const toolbarProps: MapEditToolbarProps = {
    isLive,
    busy: pendingLiveId !== null || loading,
    activeSubTool,
    onSelectSubTool: setActiveSubTool,
    canUndo: controller.canUndo,
    canRedo: controller.canRedo,
    onUndo: undo,
    onRedo: redo,
    onStartLiveMap: startLiveMap,
    onClose,
    hasRasterBackground,
    error: controller.error,
  };

  return { activeSubTool, toolbarProps };
}
