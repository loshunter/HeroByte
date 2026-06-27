import { useEffect, useState } from "react";
import { JRPGButton, JRPGPanel } from "../../../../components/ui/JRPGPanel";
import { createMapDocumentSvgDataUrl, type MapStudioController } from "../../../map-studio";
import { MapGridEditor } from "./MapGridEditor";
import { MapStudioExportControls } from "./MapStudioExportControls";
import { MapShapeEditor } from "./MapShapeEditor";
import { MapStudioCanvas } from "./MapStudioCanvas";
import { MapStructureEditor } from "./MapStructureEditor";

export interface MapStudioControlProps {
  controller: MapStudioController;
  onPublishToLiveMap?: (publish: {
    backgroundUrl: string;
    gridSize: number;
    documentId: string;
    documentName: string;
  }) => void;
}

export function MapStudioControl({ controller, onPublishToLiveMap }: MapStudioControlProps) {
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
    deleteDocument,
    updateLayer,
    moveLayer,
    updateGrid,
    addShape,
    addWall,
    addDoor,
    removeElement,
    updateElement,
    undo,
    redo,
  } = controller;
  const [name, setName] = useState("New Battlemap");
  const [width, setWidth] = useState(2048);
  const [height, setHeight] = useState(2048);
  const [selectedId, setSelectedId] = useState("");
  const [publishStatus, setPublishStatus] = useState("");

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (activeDocument) {
      setSelectedId(activeDocument.id);
    } else if (!selectedId && documents[0]) {
      setSelectedId(documents[0].id);
    }
  }, [activeDocument, documents, selectedId]);

  const handleCreate = () => {
    if (!name.trim()) return;
    const id = createDocument(name.trim(), width, height);
    setSelectedId(id);
  };

  const handleDelete = () => {
    if (!selectedId) return;
    const selected = documents.find((document) => document.id === selectedId);
    if (window.confirm(`Delete map "${selected?.name ?? selectedId}"? This cannot be undone.`)) {
      deleteDocument(selectedId);
      setSelectedId("");
    }
  };

  const handlePublish = () => {
    if (!activeDocument || !onPublishToLiveMap) return;
    onPublishToLiveMap({
      backgroundUrl: createMapDocumentSvgDataUrl(activeDocument),
      gridSize: toLiveGridSize(activeDocument.grid.size),
      documentId: activeDocument.id,
      documentName: activeDocument.name,
    });
    setPublishStatus(`Published "${activeDocument.name}" to the live map.`);
  };

  return (
    <JRPGPanel variant="simple" title="HeroByte Map Studio">
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <p className="jrpg-text-small" style={{ margin: 0, opacity: 0.85 }}>
          Versioned battlemap documents stay separate until you publish them to the live token
          scene.
        </p>

        <label className="jrpg-text-small" htmlFor="map-studio-name">
          New map name
        </label>
        <input
          id="map-studio-name"
          value={name}
          maxLength={200}
          onChange={(event) => setName(event.target.value)}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <DimensionInput label="Width" value={width} onChange={setWidth} />
          <DimensionInput label="Height" value={height} onChange={setHeight} />
        </div>
        <JRPGButton variant="primary" disabled={loading || !name.trim()} onClick={handleCreate}>
          {loading ? "WORKING..." : "CREATE EDITABLE MAP"}
        </JRPGButton>

        <div style={{ borderTop: "1px solid var(--jrpg-border-gold)", paddingTop: "10px" }}>
          <label className="jrpg-text-small" htmlFor="map-studio-document">
            Saved maps
          </label>
          <select
            id="map-studio-document"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            style={{ width: "100%", marginTop: "4px" }}
          >
            <option value="">{documents.length ? "Choose a map" : "No maps yet"}</option>
            {documents.map((document) => (
              <option key={document.id} value={document.id}>
                {document.name} · r{document.revision}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
            <JRPGButton
              style={{ flex: 1, fontSize: "10px" }}
              disabled={!selectedId || loading || saving}
              onClick={() => openDocument(selectedId)}
            >
              OPEN
            </JRPGButton>
            <JRPGButton
              variant="danger"
              style={{ fontSize: "10px" }}
              disabled={!selectedId || loading || saving}
              onClick={handleDelete}
            >
              DELETE
            </JRPGButton>
            <JRPGButton style={{ fontSize: "10px" }} disabled={loading} onClick={refresh}>
              ↻
            </JRPGButton>
          </div>
        </div>

        {activeDocument && (
          <div aria-live="polite">
            <div className="jrpg-text-small" style={{ marginBottom: "6px" }}>
              <strong>{activeDocument.name}</strong> · {activeDocument.width}×
              {activeDocument.height} · revision {activeDocument.revision} ·{" "}
              {activeDocument.elements.length}
              {" elements"}
              {saving && " · saving…"}
            </div>
            {error && (
              <p role="alert" className="jrpg-text-small" style={{ color: "#ff9b8f" }}>
                {error}
              </p>
            )}
            <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
              <JRPGButton
                style={{ flex: 1, fontSize: "10px" }}
                disabled={saving || !canUndo}
                onClick={undo}
              >
                ↶ UNDO
              </JRPGButton>
              <JRPGButton
                style={{ flex: 1, fontSize: "10px" }}
                disabled={saving || !canRedo}
                onClick={redo}
              >
                ↷ REDO
              </JRPGButton>
            </div>
            <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
              <JRPGButton
                variant="primary"
                style={{ flex: 1, fontSize: "10px" }}
                disabled={saving || !onPublishToLiveMap}
                onClick={handlePublish}
              >
                PUBLISH TO LIVE MAP
              </JRPGButton>
            </div>
            {publishStatus && (
              <p role="status" className="jrpg-text-small" style={{ margin: "0 0 6px" }}>
                {publishStatus}
              </p>
            )}
            <MapStudioExportControls document={activeDocument} disabled={saving} />
            <MapStudioCanvas
              document={activeDocument}
              disabled={saving}
              onRemoveElement={removeElement}
              onUpdateElement={updateElement}
            />
            <div style={{ marginTop: "8px" }}>
              <MapGridEditor grid={activeDocument.grid} disabled={saving} onUpdate={updateGrid} />
            </div>
            <div style={{ marginTop: "8px" }}>
              <MapShapeEditor document={activeDocument} disabled={saving} onAddShape={addShape} />
            </div>
            <div style={{ marginTop: "8px" }}>
              <MapStructureEditor
                document={activeDocument}
                disabled={saving}
                onAddWall={addWall}
                onAddDoor={addDoor}
              />
            </div>
            <div className="jrpg-text-small" style={{ margin: "8px 0 4px" }}>
              Layers
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              {activeDocument.layers.map((layer, index) => (
                <div
                  key={layer.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "24px 24px 1fr 58px 24px 24px",
                    gap: "4px",
                    alignItems: "center",
                    padding: "4px",
                    border: "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  <input
                    aria-label={`Show ${layer.name}`}
                    type="checkbox"
                    checked={layer.visible}
                    disabled={saving}
                    onChange={(event) => updateLayer(layer.id, { visible: event.target.checked })}
                  />
                  <input
                    aria-label={`Lock ${layer.name}`}
                    type="checkbox"
                    checked={layer.locked}
                    disabled={saving}
                    onChange={(event) => updateLayer(layer.id, { locked: event.target.checked })}
                  />
                  <span className="jrpg-text-small" title={layer.kind}>
                    {layer.name}
                  </span>
                  <input
                    aria-label={`${layer.name} opacity`}
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={layer.opacity}
                    disabled={saving}
                    onChange={(event) =>
                      updateLayer(layer.id, { opacity: Number(event.target.value) })
                    }
                  />
                  <button
                    aria-label={`Move ${layer.name} up`}
                    disabled={saving || index === activeDocument.layers.length - 1}
                    onClick={() => moveLayer(layer.id, index + 1)}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Move ${layer.name} down`}
                    disabled={saving || index === 0}
                    onClick={() => moveLayer(layer.id, index - 1)}
                  >
                    ↓
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </JRPGPanel>
  );
}

function toLiveGridSize(documentGridSize: number): number {
  return Math.min(500, Math.max(10, Math.round(documentGridSize)));
}

function DimensionInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="jrpg-text-small">
      {label}
      <input
        aria-label={`${label} in pixels`}
        type="number"
        min={256}
        max={32768}
        step={256}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ width: "100%", marginTop: "4px" }}
      />
    </label>
  );
}
