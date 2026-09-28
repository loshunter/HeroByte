// ============================================================================
// MAP-EDIT STATE (glue hook)
// ============================================================================
// Owns the live map-edit palette state (the bind flow is useLiveMapEntry). Drives the ONE
// App-level MapStudioController — never a second useMapStudio (two queues would
// revision-conflict). Mirrors useDrawingStateManager's shape: takes the
// controller + sendMessage + mode + setActiveTool, returns palette props.

import type { UseMapEditStateOptions, UseMapEditStateReturn } from "./useMapEditState.types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveMapEntry } from "./useLiveMapEntry";
import { displayName } from "../map-studio/tableMapIdentity";
import { useMapEditHotkeys } from "./useMapEditHotkeys";
import { usePopulate } from "./usePopulate";
import { useGenerate } from "./useGenerate";
import { usePlacementDials } from "./usePlacementDials";
import type { MapEditToolbarProps } from "./mapEditTypes";
import { useMapEditPaletteState } from "./useMapEditPaletteState";
import { useElementProperties } from "./useElementProperties";

/** A crate is the friendliest first set-dressing default. */

export function useMapEditState({
  controller,
  sendMessage,
  mapEditMode,
  setActiveTool,
  isDM,
  snapshotLoaded,
  liveMapDocumentId,
  sceneSourceDocumentId,
  roomGridSize,
  hasRasterBackground,
  notifyError,
  dismissError,
}: UseMapEditStateOptions): UseMapEditStateReturn {
  const {
    activeSubTool,
    activeGroup,
    onSelectGroup,
    setActiveSubTool,
    floorFamily,
    setFloorFamily,
    roomWallFamily,
    setRoomWallFamily,
    hallwayWidth,
    setHallwayWidth,
    terrainBrushSize,
    setTerrainBrushSize,
    splineKind,
    setSplineKind,
    layersOpen,
    inspectorOpen,
    wallsOverlayPinned,
    onToggleWallsOverlay,
    onToggleLayers,
    onToggleInspector,
  } = useMapEditPaletteState();
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  // What Place/Scatter/Row drop and how — asset, picker flag, stamp-vs-tile and
  // rotation, in one hook so a phone control and the Alt/R keys write the same
  // state rather than two that can disagree.
  const dials = usePlacementDials({ setFloorFamily, setActiveSubTool });
  const populate = usePopulate(controller, notifyError);
  const { activeDocument, undo, redo } = controller;
  const { isLive, busy, startLiveMap, buildEntry } = useLiveMapEntry({
    controller,
    sendMessage,
    mapEditMode,
    liveMapDocumentId,
    sceneSourceDocumentId,
    hasBackground: hasRasterBackground,
    roomGridSize,
  });

  const generate = useGenerate(controller, isLive, activeSubTool, mapEditMode, notifyError);

  // Ctrl/Cmd+Z / +Y route to the table's map while map-edit is on; the
  // useKeyboardShortcuts selection-undo branch is guarded off in the same mode
  // so exactly one handler acts. Only while that map is OPEN: with a library
  // map viewed, the controller's history is that map's, and a Ctrl+Z in Build
  // silently rewound it while the table did not change.
  useMapEditHotkeys({
    mapEditMode: mapEditMode && isLive,
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
  const errorNotification = useRef<string | null>(null);
  useEffect(() => {
    const err = controller.error;
    if (err !== lastError.current && errorNotification.current) {
      dismissError?.(errorNotification.current);
      errorNotification.current = null;
    }
    if (err && err !== lastError.current && mapEditMode) {
      const id = notifyError?.(err);
      if (typeof id === "string") errorNotification.current = id;
    }
    lastError.current = err;
  }, [controller.error, mapEditMode, notifyError, dismissError]);

  // LOSING DM LEAVES THE MODE. Every way OUT of map-edit is DM-gated — the
  // header's entry, and the palette itself (TopPanelLayout gates on isDM) —
  // while the mode's effects are not: one-finger pan is off (shouldPan
  // excludes it) and tokens are non-interactive. So a revoked DM was left on
  // a table they could neither author nor move, with only an undiscoverable
  // Escape as the way out. Revocation is not always self-inflicted, either.
  //
  // The snapshotLoaded half is not belt-and-braces, it is the whole
  // correctness of this guard. `isDM` is derived from the snapshot, and ANY
  // socket close nulls it: handleClose -> authManager.reset -> the "reset"
  // auth event -> setSnapshot(null), while AuthenticationGate keeps the app
  // MOUNTED behind a Reconnecting banner. A phone locking its screen would
  // otherwise drop the DM out of map-edit and leave them there after the
  // reconnect, looking like the mode had quit on its own.
  useEffect(() => {
    if (mapEditMode && snapshotLoaded && !isDM) setActiveTool(null);
  }, [mapEditMode, snapshotLoaded, isDM, setActiveTool]);

  const onClose = useCallback(() => setActiveTool(null), [setActiveTool]);

  // Quick-wheel dispatch pair (P5): useState setters are identity-stable, so
  // one memo keeps the pair stable for MapBoard.
  const wheelActions = useMemo(
    () => ({ selectSubTool: setActiveSubTool, selectFloorFamily: setFloorFamily }),
    [],
  );

  // The selected element, resolved live from the active document so edits (and
  // deletions) reflect immediately; clears when the element is gone.
  const selectedElement = useMemo(
    () =>
      (activeDocument?.elements ?? []).find((element) => element.id === selectedElementId) ?? null,
    [activeDocument, selectedElementId],
  );

  const properties = useElementProperties(
    controller,
    selectedElementId,
    setSelectedElementId,
    isDM || !snapshotLoaded,
  );
  const toolbarProps: MapEditToolbarProps = {
    documentId: activeDocument?.id,
    properties: properties.properties,
    mapName: activeDocument
      ? (displayName(activeDocument.id, controller.documents) ?? activeDocument.name)
      : "Current table map",
    activeGroup,
    onSelectGroup,
    isLive,
    busy,
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
    buildEntry,
    onClose,
    hasRasterBackground,
    error: controller.error,
    wallsOverlayPinned,
    onToggleWallsOverlay,
    selectedAssetId: dials.selectedAssetId,
    onSelectAsset: dials.onSelectAsset,
    uploadAsset: controller.uploadAsset,
    assetPickerOpen: dials.assetPickerOpen,
    onToggleAssetPicker: dials.onToggleAssetPicker,
    stampMode: dials.stampMode,
    onToggleStampMode: dials.onToggleStampMode,
    stampRotation: dials.stampRotation,
    onRotateStamp: dials.onRotateStamp,
    hallwayWidth,
    onSelectHallwayWidth: setHallwayWidth,
    terrainBrushSize,
    onSelectTerrainBrushSize: setTerrainBrushSize,
    splineKind,
    onSelectSplineKind: setSplineKind,
    populateDensity: populate.density,
    onSelectPopulateDensity: populate.setDensity,
    populateCategory: populate.category,
    onSelectPopulateCategory: populate.setCategory,
    onPopulate: populate.onPopulate,
    canPopulate: populate.canPopulate,
    populateTarget: populate.target,
    populateHint: populate.hint,
    generateParams: generate.params,
    onGenerateParamsChange: generate.setParams,
    onRerollSeed: generate.rerollSeed,
    onGenerate: generate.onGenerate,
    canGenerate: generate.canGenerate,
    generateRegion: generate.region,
    generateHint: generate.hint,
    generateFeedback: generate.feedback,
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
    selectedAssetId: dials.selectedAssetId,
    hallwayWidth,
    splineKind,
    terrainBrushSize,
    onRegionPlaced: populate.onRegionPlaced,
    persistentPreview: {
      populateGhosts:
        isDM && (activeSubTool === "room" || activeSubTool === "hallway")
          ? populate.previewGhosts
          : null,
      populateTarget:
        isDM && (activeSubTool === "room" || activeSubTool === "hallway") ? populate.target : null,
      generateRegion: isDM ? generate.preview : null,
    },
    wheelActions,
    onRegionDragged: generate.onRegionDragged,
    selectedElementId,
    onSelectElement: properties.selectElement,
    onSampleAsset: dials.onSampleAsset,
    wallsOverlayPinned,
    toolbarProps,
  };
}
