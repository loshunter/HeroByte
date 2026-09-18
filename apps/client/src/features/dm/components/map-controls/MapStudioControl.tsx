import { useEffect, useRef, useState } from "react";
import type { MapPublishBackgroundMode } from "@herobyte/shared";
import { JRPGButton, JRPGPanel } from "../../../../components/ui/JRPGPanel";
import {
  describePublishFailure,
  rasterizeAndUploadMapBackground,
  type MapStudioController,
} from "../../../map-studio";
import { CampaignWeight } from "./CampaignWeight";
import { MapStudioExportControls } from "./MapStudioExportControls";
import { formatUpdatedAt } from "./formatUpdatedAt";
import { parseBackupImport } from "./importBackup";
import { describeLiveMapReplacement } from "./publishGuard";

export interface MapStudioControlProps {
  controller: MapStudioController;
  /**
   * The document the table's compiled scene came from. A publish of any OTHER
   * document replaces the table and asks first; without this the panel cannot
   * tell a bake from a swap, so it asks nothing (the pre-2026-09-08 behaviour).
   */
  liveSceneDocumentId?: string;
  onPublishToLiveMap?: (publish: {
    backgroundUrl: string;
    gridSize: number;
    documentId: string;
    documentName: string;
    backgroundMode: MapPublishBackgroundMode;
  }) => void;
}

export function MapStudioControl({
  controller,
  liveSceneDocumentId,
  onPublishToLiveMap,
}: MapStudioControlProps) {
  const {
    documents,
    activeDocument,
    loading,
    saving,
    error,
    canUndo,
    canRedo,
    exportBytes,
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
  // The id of the last document sent for import, so we can turn the in-progress
  // "Importing…" status into a completion once that document activates.
  const importingIdRef = useRef<string | null>(null);

  const handleImportFile = (fileText: string) => {
    const parsed = parseBackupImport(fileText);
    if ("error" in parsed) {
      setPublishStatus(parsed.error);
      return;
    }
    const id = importDocument(parsed.document);
    importingIdRef.current = id;
    setSelectedId(id);
    setPublishStatus("Importing map backup…");
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

  // Resolve the "Importing…" status once the imported document activates, so the
  // panel doesn't read "Importing map backup…" forever under a finished import.
  useEffect(() => {
    if (importingIdRef.current && activeDocument?.id === importingIdRef.current) {
      importingIdRef.current = null;
      setPublishStatus(`Imported "${activeDocument.name}".`);
    }
  }, [activeDocument]);

  // If an import fails, the watchdog surfaces controller.error while the import
  // is still pending — drop the now-misleading "Importing…" status (the visible
  // error carries the failure) and stop tracking the import so a later publish
  // status can't be blanked by an unrelated error.
  useEffect(() => {
    if (error && importingIdRef.current) {
      importingIdRef.current = null;
      setPublishStatus("");
    }
  }, [error]);

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
    const replacement = describeLiveMapReplacement(
      documentToPublish,
      liveSceneDocumentId,
      documents,
    );
    if (replacement && !window.confirm(replacement.prompt)) {
      setPublishStatus(`Publish cancelled — the table stays on "${replacement.liveName}".`);
      return;
    }
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
                {/*
                  `revision` is an edit counter, not a copy index, so two
                  documents both auto-named "Live Map" were indistinguishable
                  here — and there is no rename anywhere on the wire, only
                  delete, whose confirm quotes the same ambiguous name. The
                  last-edited stamp is the one thing that actually tells them
                  apart, and the summary already carries it.
                */}
                {document.name} · r{document.revision} · {formatUpdatedAt(document.updatedAt)}
              </option>
            ))}
          </select>
          <CampaignWeight bytes={exportBytes} maps={documents.length} />
          <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
            <JRPGButton
              style={{ flex: 1, fontSize: "10px" }}
              disabled={!selectedId || loading || saving}
              onClick={handleOpen}
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
              // .then(fn).catch(...), NOT .then(fn, onRejected): the two-argument
              // form catches a failed READ only, so anything thrown by the
              // handler itself becomes an unhandled rejection and the panel
              // says nothing. A parse bug must still reach the DM as words.
              file
                .text()
                .then(handleImportFile)
                .catch(() => {
                  setPublishStatus("Import failed: couldn't read that file.");
                });
            }}
          />
        </div>

        {/* Status + error live outside the active-document block: import (and its
            watchdog failure) runs with no active document (restore-from-backup),
            so its feedback must show even then. */}
        {publishStatus && (
          <p role="status" className="jrpg-text-small" style={{ margin: 0 }}>
            {publishStatus}
          </p>
        )}
        {error && (
          <p role="alert" className="jrpg-text-small" style={{ color: "#ff9b8f", margin: 0 }}>
            {error}
          </p>
        )}

        {activeDocument && (
          <div aria-live="polite">
            <div className="jrpg-text-small" style={{ marginBottom: "6px" }}>
              <strong>{activeDocument.name}</strong> · {activeDocument.width}×
              {activeDocument.height} · revision {activeDocument.revision} ·{" "}
              {activeDocument.elements.length}
              {" elements"}
              {saving && " · saving…"}
            </div>
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
