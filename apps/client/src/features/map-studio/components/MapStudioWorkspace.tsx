import { useEffect, useMemo, useRef, useState } from "react";
import { createMapDocumentSvgDataUrl } from "../exportMapDocument";
import { MAP_STUDIO_TILE_ASSETS, getMapStudioTileAsset } from "../starterTiles";
import type { MapStudioController } from "../types";
import { MapStudioCanvas } from "./MapStudioCanvas";
import { MapStudioEmptyState } from "./MapStudioEmptyState";
import { MapStudioPalette } from "./MapStudioPalette";
import { StudioTopBar, ToolButton } from "./MapStudioWorkspaceControls";
import type { StudioTool, TileCategory } from "./MapStudioWorkspace.types";
import { leftRailStyle, workspaceStyle } from "./mapStudioWorkspaceStyles";
import { isVisible, layerOrder, pickPlacementLayer } from "./mapStudioWorkspaceUtils";
import { useMapStudioCanvasController } from "./useMapStudioCanvasController";

interface MapStudioWorkspaceProps {
  controller: MapStudioController;
  onExit: () => void;
  onPublishStatus?: (message: string) => void;
}

export function MapStudioWorkspace({
  controller,
  onExit,
  onPublishStatus,
}: MapStudioWorkspaceProps) {
  const {
    documents,
    activeDocument,
    loading,
    saving,
    error,
    canUndo,
    canRedo,
    refresh,
    createDocument,
    openDocument,
    addTile,
    addTiles,
    removeElement,
    undo,
    redo,
    publishDocument,
  } = controller;
  const requestedInitialDocuments = useRef(false);
  const [tool, setTool] = useState<StudioTool>("tile");
  const [category, setCategory] = useState<TileCategory>("terrain");
  const [selectedAssetId, setSelectedAssetId] = useState(MAP_STUDIO_TILE_ASSETS[0]?.id ?? "");
  const [roomFillAssetId, setRoomFillAssetId] = useState("terrain:stone-floor");
  const [roomWallAssetId, setRoomWallAssetId] = useState("structures:stone-wall");
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [newMapName, setNewMapName] = useState("New Battlemap");
  const [publishMessage, setPublishMessage] = useState("");

  useEffect(() => {
    if (!requestedInitialDocuments.current && !documents.length && !loading) {
      requestedInitialDocuments.current = true;
      refresh();
    }
  }, [documents.length, loading, refresh]);

  useEffect(() => {
    if (activeDocument) {
      setSelectedDocumentId(activeDocument.id);
      return;
    }
    if (!selectedDocumentId && documents[0]) {
      setSelectedDocumentId(documents[0].id);
    }
  }, [activeDocument, documents, selectedDocumentId]);

  const selectedAsset = useMemo(() => getMapStudioTileAsset(selectedAssetId), [selectedAssetId]);
  const roomFillAsset = useMemo(() => getMapStudioTileAsset(roomFillAssetId), [roomFillAssetId]);
  const roomWallAsset = useMemo(
    () => (roomWallAssetId ? getMapStudioTileAsset(roomWallAssetId) : null),
    [roomWallAssetId],
  );
  const visibleAssets = useMemo(
    () => MAP_STUDIO_TILE_ASSETS.filter((asset) => asset.category === category),
    [category],
  );
  const floorAssets = useMemo(
    () => MAP_STUDIO_TILE_ASSETS.filter((asset) => asset.layerKind === "terrain"),
    [],
  );
  const wallAssets = useMemo(
    () => MAP_STUDIO_TILE_ASSETS.filter((asset) => asset.layerKind === "walls"),
    [],
  );
  const layers = useMemo(
    () => new Map(activeDocument?.layers.map((layer) => [layer.id, layer]) ?? []),
    [activeDocument?.layers],
  );
  const visibleElements = useMemo(() => {
    if (!activeDocument) return [];
    return activeDocument.elements
      .filter((element) => isVisible(element, layers.get(element.layerId)))
      .sort((a, b) => layerOrder(layers.get(a.layerId)) - layerOrder(layers.get(b.layerId)));
  }, [activeDocument, layers]);

  const selectedElement = activeDocument?.elements.find(
    (element) => element.id === selectedElementId,
  );
  const selectedLayer = selectedElement ? layers.get(selectedElement.layerId) : undefined;
  const {
    svgRef,
    viewBox,
    roomDrag,
    snappedCursor,
    handleZoom,
    handleResetView,
    handleWheel,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerEnd,
  } = useMapStudioCanvasController({
    activeDocument,
    saving,
    selectedAsset,
    roomFillAsset,
    roomWallAsset,
    layers,
    tool,
    addTile,
    addTiles,
    removeElement,
    setSelectedElementId,
    setPublishMessage,
  });

  const handleCreate = () => {
    const name = newMapName.trim();
    if (!name || loading || saving) return;
    createDocument(name, 2048, 2048);
  };

  const handleOpenSelected = () => {
    if (!selectedDocumentId || loading || saving) return;
    openDocument(selectedDocumentId);
  };

  const handlePublish = () => {
    if (!activeDocument) return;
    // The server compiles the document's walls/doors/lights into the live
    // scene; the rendered SVG travels along as the cosmetic background.
    if (!publishDocument(createMapDocumentSvgDataUrl(activeDocument))) return;
    const message = `Published "${activeDocument.name}" to the live map.`;
    setPublishMessage(message);
    onPublishStatus?.(message);
  };

  if (!activeDocument) {
    return (
      <MapStudioEmptyState
        documents={documents}
        selectedDocumentId={selectedDocumentId}
        newMapName={newMapName}
        loading={loading}
        saving={saving}
        canUndo={canUndo}
        canRedo={canRedo}
        onSelectedDocumentIdChange={setSelectedDocumentId}
        onNewMapNameChange={setNewMapName}
        onOpenSelected={handleOpenSelected}
        onCreate={handleCreate}
        onUndo={undo}
        onRedo={redo}
        onPublish={handlePublish}
        onExit={onExit}
      />
    );
  }

  const previewLayer = pickPlacementLayer(activeDocument, selectedAsset);

  return (
    <div style={workspaceStyle}>
      <StudioTopBar
        title={`${activeDocument.name} · ${activeDocument.width}×${activeDocument.height} · r${activeDocument.revision}`}
        saving={saving}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onPublish={handlePublish}
        onExit={onExit}
        onZoomIn={() => handleZoom(0.82)}
        onZoomOut={() => handleZoom(1.18)}
        onResetView={handleResetView}
      />

      <div style={leftRailStyle} aria-label="Map Studio tools">
        <ToolButton active={tool === "pan"} label="Pan" onClick={() => setTool("pan")} />
        <ToolButton active={tool === "select"} label="Select" onClick={() => setTool("select")} />
        <ToolButton active={tool === "tile"} label="Tile" onClick={() => setTool("tile")} />
        <ToolButton active={tool === "room"} label="Room" onClick={() => setTool("room")} />
        <ToolButton active={tool === "erase"} label="Erase" onClick={() => setTool("erase")} />
      </div>

      <MapStudioPalette
        category={category}
        selectedAssetId={selectedAssetId}
        roomFillAssetId={roomFillAssetId}
        roomWallAssetId={roomWallAssetId}
        visibleAssets={visibleAssets}
        floorAssets={floorAssets}
        wallAssets={wallAssets}
        selectedElement={selectedElement}
        selectedLayer={selectedLayer}
        saving={saving}
        onCategorySelect={(nextCategory, fallbackAssetId) => {
          setCategory(nextCategory);
          setSelectedAssetId(fallbackAssetId);
          setTool("tile");
        }}
        onAssetSelect={(asset) => {
          setSelectedAssetId(asset.id);
          if (asset.layerKind === "terrain") setRoomFillAssetId(asset.id);
          if (asset.layerKind === "walls") setRoomWallAssetId(asset.id);
          setTool("tile");
        }}
        onRoomFillAssetIdChange={setRoomFillAssetId}
        onRoomWallAssetIdChange={setRoomWallAssetId}
        onDeleteSelected={() => {
          if (!selectedElement) return;
          removeElement(selectedElement.id);
          setSelectedElementId(null);
        }}
      />

      <MapStudioCanvas
        activeDocument={activeDocument}
        viewBox={viewBox}
        tool={tool}
        snappedCursor={snappedCursor}
        selectedAsset={selectedAsset}
        previewLayer={previewLayer}
        roomDrag={roomDrag}
        roomFillAsset={roomFillAsset}
        roomWallAsset={roomWallAsset}
        visibleElements={visibleElements}
        layers={layers}
        selectedElementId={selectedElementId}
        error={error}
        publishMessage={publishMessage}
        svgRef={svgRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerEnd={handleCanvasPointerEnd}
        onWheel={handleWheel}
        onSelectElement={setSelectedElementId}
      />
    </div>
  );
}
