// ============================================================================
// MAP-EDIT STATE (glue hook)
// ============================================================================
// Owns the live map-edit palette state and the bind flow. Drives the ONE
// App-level MapStudioController — never a second useMapStudio (two queues would
// revision-conflict). Mirrors useDrawingStateManager's shape: takes the
// controller + sendMessage + mode + setActiveTool, returns palette props.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientMessage } from "@herobyte/shared";
import type { ToolMode } from "../../components/layout/Header";
import type { MapStudioController } from "../map-studio/types";
import { useMapEditHotkeys } from "./useMapEditHotkeys";
import { usePopulate } from "./usePopulate";
import { useGenerate } from "./useGenerate";
import type { RoomBounds } from "./roomBuilder";
import { floorFamilyFromAssetId } from "./mapEditFamilies";
import type {
  MapEditFloorFamily,
  MapEditSubTool,
  MapEditToolbarProps,
  MapEditWallFamily,
} from "./mapEditTypes";

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
  /** The Room tool's painted wall-ring material (fed to the tool). */
  roomWallFamily: MapEditWallFamily | "none";
  /** Asset the place/scatter sub-tools drop (fed to the tool + preview). */
  selectedAssetId: string;
  /** Corridor width in cells for the hallway sub-tool (fed to the tool + preview). */
  hallwayWidth: number;
  /** Record a room/hallway's bounds as the POPULATE target (fed to the tool). */
  onRegionPlaced: (bounds: RoomBounds) => void;
  /** Record a generate drag's bounds as the recipe's target (fed to the tool). */
  onRegionDragged: (bounds: RoomBounds) => void;
  /** Currently-selected element id (select sub-tool) + its setter (fed to the tool). */
  selectedElementId: string | null;
  onSelectElement: (elementId: string | null) => void;
  /** Re-arm the place tool with an eyedropper-sampled asset (fed to the tool). */
  onSampleAsset: (assetId: string) => void;
  /** Keep the DM walls overlay visible even outside map-edit mode. */
  wallsOverlayPinned: boolean;
  toolbarProps: MapEditToolbarProps;
}

const LIVE_MAP_SIZE = 8192;
/** A crate is the friendliest first set-dressing default. */
const DEFAULT_ASSET_ID = "objects:crate";

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
  // Rooms ship with a stone wall band by default — the Czepeku look out of the
  // box; "none" restores the bare floor-plus-perimeter behaviour.
  const [roomWallFamily, setRoomWallFamily] = useState<MapEditWallFamily | "none">("wall-stone");
  const [selectedAssetId, setSelectedAssetId] = useState<string>(DEFAULT_ASSET_ID);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [hallwayWidth, setHallwayWidth] = useState(2);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const populate = usePopulate(controller, notifyError);
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
  const {
    activeDocument,
    loading,
    missingDocumentId,
    createDocument,
    openDocument,
    updateGrid,
    undo,
    redo,
  } = controller;
  const activeId = activeDocument?.id;
  // The room's binding points at a document the server no longer has (the
  // maps store reset under the room — e.g. an ephemeral-disk restart). The
  // binding is DANGLING: never auto-open it again, and let START LIVE MAP
  // create a fresh document whose set-live repairs the room's binding.
  const bindingDangling = Boolean(liveMapDocumentId) && missingDocumentId === liveMapDocumentId;

  const isLive = Boolean(liveMapDocumentId) && activeId === liveMapDocumentId;

  const generate = useGenerate(controller, isLive, notifyError);

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
    if (liveMapDocumentId && !bindingDangling) {
      openDocument(liveMapDocumentId);
      return;
    }
    setPendingLiveId(createDocument("Live Map", LIVE_MAP_SIZE, LIVE_MAP_SIZE));
  }, [
    awaitingLiveBind,
    activeId,
    liveMapDocumentId,
    bindingDangling,
    openDocument,
    createDocument,
  ]);

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

  // Rebind after a reload: entering map-edit with a live binding but NO active
  // document (fresh controller) auto-opens it. Bail whenever ANY document is
  // already active — including one the DM deliberately opened to export or back
  // up — so this effect never force-reverts an explicit open (the palette shows
  // START LIVE MAP when a non-live doc is active). The loading guard prevents
  // re-firing while the fetch is in flight, and a DANGLING binding (the server
  // reported the document gone) is never re-opened — without that guard this
  // effect looped open → not-found → open forever, pinning the palette on
  // STARTING… after a server-side maps-store reset.
  useEffect(() => {
    if (!mapEditMode || !liveMapDocumentId || pendingLiveId || loading) return;
    if (activeId || bindingDangling) return;
    openDocument(liveMapDocumentId);
  }, [
    mapEditMode,
    liveMapDocumentId,
    bindingDangling,
    pendingLiveId,
    loading,
    activeId,
    openDocument,
  ]);

  const onClose = useCallback(() => setActiveTool(null), [setActiveTool]);
  const onToggleWallsOverlay = useCallback(() => setWallsOverlayPinned((pinned) => !pinned), []);
  const onToggleAssetPicker = useCallback(() => setAssetPickerOpen((open) => !open), []);
  const onToggleLayers = useCallback(() => setLayersOpen((open) => !open), []);
  const onToggleInspector = useCallback(() => setInspectorOpen((open) => !open), []);

  // Eyedropper re-arm: sampling a terrain family also updates the floor picker;
  // the place tool takes over so the next click drops the sampled asset.
  const onSampleAsset = useCallback((assetId: string) => {
    setSelectedAssetId(assetId);
    const family = floorFamilyFromAssetId(assetId);
    if (family) setFloorFamily(family);
    setActiveSubTool("place");
  }, []);

  // The selected element, resolved live from the active document so edits (and
  // deletions) reflect immediately; clears when the element is gone.
  const selectedElement = useMemo(
    () =>
      (activeDocument?.elements ?? []).find((element) => element.id === selectedElementId) ?? null,
    [activeDocument, selectedElementId],
  );

  const toolbarProps: MapEditToolbarProps = {
    isLive,
    busy: awaitingLiveBind || pendingLiveId !== null || loading,
    activeSubTool,
    onSelectSubTool: setActiveSubTool,
    floorFamily,
    onSelectFloorFamily: setFloorFamily,
    roomWallFamily,
    onSelectRoomWallFamily: setRoomWallFamily,
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
    selectedAssetId,
    onSelectAsset: setSelectedAssetId,
    uploadAsset: controller.uploadAsset,
    assetPickerOpen,
    onToggleAssetPicker,
    hallwayWidth,
    onSelectHallwayWidth: setHallwayWidth,
    populateDensity: populate.density,
    onSelectPopulateDensity: populate.setDensity,
    populateCategory: populate.category,
    onSelectPopulateCategory: populate.setCategory,
    onPopulate: populate.onPopulate,
    canPopulate: populate.canPopulate,
    generateParams: generate.params,
    onGenerateParamsChange: generate.setParams,
    onRerollSeed: generate.rerollSeed,
    onGenerate: generate.onGenerate,
    canGenerate: generate.canGenerate,
    generateRegion: generate.region,
    saving: controller.saving,
    layers: activeDocument?.layers ?? [],
    selectedElement,
    onUpdateLayer: controller.updateLayer,
    onMoveLayer: controller.moveLayer,
    onUpdateElement: controller.updateElement,
    onUpdateDoor: controller.updateDoor,
    onRemoveElement: controller.removeElement,
    layersOpen,
    onToggleLayers,
    inspectorOpen,
    onToggleInspector,
  };

  return {
    activeSubTool,
    floorFamily,
    roomWallFamily,
    selectedAssetId,
    hallwayWidth,
    onRegionPlaced: populate.onRegionPlaced,
    onRegionDragged: generate.onRegionDragged,
    selectedElementId,
    onSelectElement: setSelectedElementId,
    onSampleAsset,
    wallsOverlayPinned,
    toolbarProps,
  };
}
