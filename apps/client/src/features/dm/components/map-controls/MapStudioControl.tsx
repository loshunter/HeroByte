import { useEffect, useRef, useState } from "react";
import type { MapDocument, MapPublishBackgroundMode } from "@herobyte/shared";
import { JRPGButton, JRPGPanel } from "../../../../components/ui/JRPGPanel";
import {
  describePublishFailure,
  rasterizeAndUploadMapBackground,
  type MapStudioController,
} from "../../../map-studio";
import { MapStudioExportControls } from "./MapStudioExportControls";

export interface MapStudioControlProps {
  controller: MapStudioController;
  onPublishToLiveMap?: (publish: {
    backgroundUrl: string;
    gridSize: number;
    documentId: string;
    documentName: string;
    backgroundMode: MapPublishBackgroundMode;
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
    undo,
    redo,
    uploadAsset,
    importDocument,
  } = controller;
  const [name, setName] = useState("New Battlemap");
  const [width, setWidth] = useState(2048);
  const [height, setHeight] = useState(2048);
  const [selectedId, setSelectedId] = useState("");
  const [publishStatus, setPublishStatus] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleImportFile = (fileText: string) => {
    try {
      const parsed: unknown = JSON.parse(fileText);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        (parsed as { schemaVersion?: unknown }).schemaVersion !== 1
      ) {
        throw new Error("Not a HeroByte map backup");
      }
      const id = importDocument(parsed as MapDocument);
      setSelectedId(id);
      setPublishStatus("Importing map backup…");
    } catch {
      setPublishStatus("Import failed: that file is not a HeroByte map JSON backup.");
    }
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (activeDocument) {
      setSelectedId(activeDocument.id);
      return;
    }
    if (!selectedId && documents[0]) {
      setSelectedId(documents[0].id);
    }
  }, [activeDocument, documents, selectedId]);

  const handleCreate = () => {
    if (!name.trim() || loading || saving) return;
    const id = createDocument(name.trim(), width, height);
    setSelectedId(id);
  };

  const handleOpen = () => {
    if (!selectedId || loading || saving) return;
    openDocument(selectedId);
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
    const documentToPublish = activeDocument;
    if (!documentToPublish || !onPublishToLiveMap) return;
    // Bake + upload run async; the payload captures the document so a mid-bake
    // switch can't mismatch id and background.
    void (async () => {
      // Full raster, matching the in-studio Publish button: the map is baked to
      // an opaque PNG (terrain composited) and uploaded by reference, so only a
      // short /assets URL rides the wire and the table renders it as the map.
      let backgroundUrl: string;
      try {
        backgroundUrl = await rasterizeAndUploadMapBackground(documentToPublish, uploadAsset);
      } catch (error) {
        setPublishStatus(describePublishFailure(error));
        return;
      }
      onPublishToLiveMap({
        backgroundUrl,
        gridSize: toLiveGridSize(documentToPublish.grid.size),
        documentId: documentToPublish.id,
        documentName: documentToPublish.name,
        backgroundMode: "full",
      });
      setPublishStatus(`Published "${documentToPublish.name}" to the live map.`);
    })();
  };

  return (
    <JRPGPanel variant="simple" title="HeroByte Map Studio">
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
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
        <JRPGButton
          variant="primary"
          disabled={loading || saving || !name.trim()}
          onClick={handleCreate}
        >
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
              onClick={handleOpen}
            >
              OPEN ON CANVAS
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
          <JRPGButton
            style={{ width: "100%", marginTop: "6px", fontSize: "10px" }}
            disabled={loading || saving}
            onClick={() => importInputRef.current?.click()}
          >
            IMPORT JSON BACKUP
          </JRPGButton>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              void file.text().then(handleImportFile);
            }}
          />
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
