import { useEffect, useRef, useState } from "react";
import { JRPGButton, JRPGPanel } from "../../../../components/ui/JRPGPanel";
import type { MapStudioController } from "../../../map-studio";
import type { AtlasNodeSnapshot } from "@herobyte/shared";
import { displayName, libraryOptionLabel } from "../../../map-studio/tableMapIdentity";
import { CampaignWeight } from "./CampaignWeight";
import { deleteMapPrompt } from "./deleteMapPrompt";
import { useMapImport } from "./useMapImport";
import { usePublishMapBackground, type PublishToLiveMap } from "./usePublishMapBackground";
import { useUseMapAtTable } from "./useUseMapAtTable";
import { ViewedMapDetails } from "./ViewedMapDetails";

export interface MapStudioControlProps {
  controller: MapStudioController;
  /**
   * The document the table's compiled scene came from. A publish of any OTHER
   * document replaces the table and asks first; without this the panel cannot
   * tell a bake from a swap, so it asks nothing (the pre-2026-09-08 behaviour).
   */
  liveSceneDocumentId?: string;
  /** Returns false when nothing was sent (the viewed map changed during the bake). */
  onPublishToLiveMap?: (publish: PublishToLiveMap) => boolean | void;
  /** The room's live binding: the saved map the party is on. */
  tableMapDocumentId?: string;
  /** The table shows an uploaded background image (it stays under a new map). */
  hasBackground?: boolean;
  /** Fog on the table now (Use at table keeps it; Travel here may turn it on). */
  fogEnabled?: boolean;
  /** World locations: a location's map says what Travel here and DELETE do to it. */
  atlasNodes?: ReadonlyArray<Pick<AtlasNodeSnapshot, "name" | "mapDocumentId" | "recipe">>;
  /** Binds a saved map through the existing set-live transition. */
  onUseAtTable?: (documentId: string) => void;
}

/**
 * The Map library: saved maps, inspected here without moving the party. Only
 * Use at table (and Advanced → Publish map background) changes the table, and
 * each asks first. Not a second editor: Build edits the map on the table.
 */
export function MapStudioControl({
  controller,
  liveSceneDocumentId,
  onPublishToLiveMap,
  tableMapDocumentId,
  hasBackground = false,
  fogEnabled = false,
  atlasNodes = [],
  onUseAtTable,
}: MapStudioControlProps) {
  const {
    documents,
    activeDocument,
    loading,
    saving,
    error,
    missingDocumentId,
    bindRefusal,
    listed,
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
  const { importInputRef, onImportChange } = useMapImport({
    importDocument,
    activeDocument,
    documents,
    error,
    setStatus: setPublishStatus,
    setSelectedId,
  });
  const publish = usePublishMapBackground({
    documents,
    liveSceneDocumentId,
    missingDocumentId,
    listed,
    fogEnabled,
    atlasNodes,
    uploadAsset,
    onPublishToLiveMap,
    setStatus: setPublishStatus,
  });
  const putAtTable = useUseMapAtTable({
    documents,
    tableMapDocumentId,
    liveSceneDocumentId,
    missingDocumentId,
    listed,
    hasBackground,
    fogEnabled,
    atlasNodes,
    onUseAtTable,
    bindRefusal,
    setStatus: setPublishStatus,
  });

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Follow the open document when a DIFFERENT one opens — not on every render.
  // Re-syncing whenever the selection changed made a pick snap straight back to
  // the open map, so View, Use at table and DELETE acted on the wrong map.
  const activeId = activeDocument?.id;
  const followedId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (activeId && activeId !== followedId.current) {
      followedId.current = activeId;
      setSelectedId(activeId);
      return;
    }
    if (!activeId) followedId.current = undefined;
    if (!selectedId && documents[0]) {
      setSelectedId(documents[0].id);
    }
  }, [activeId, documents, selectedId]);

  const handleCreate = () => {
    if (!name.trim() || loading || saving) return;
    const id = createDocument(name.trim(), width, height);
    setSelectedId(id);
  };

  const handleOpen = () => {
    if (!selectedId || loading || saving) return;
    openDocument(selectedId);
  };

  // A pick that is not in the list (a refused create or import, a map just
  // deleted) has nothing to view, use or delete.
  const pickListed = documents.some((document) => document.id === selectedId);
  const tableName = tableMapDocumentId ? displayName(tableMapDocumentId, documents) : undefined;
  // What the party sees: the binding, or (an older save, unbound) the scene's own map.
  const onTableId = tableMapDocumentId ?? liveSceneDocumentId;

  const handleDelete = () => {
    if (!pickListed) return;
    const prompt = deleteMapPrompt({
      name: displayName(selectedId, documents) ?? selectedId,
      onTable: selectedId === tableMapDocumentId || selectedId === liveSceneDocumentId,
      locationName: atlasNodes.find((node) => node.mapDocumentId === selectedId)?.name,
    });
    if (window.confirm(prompt)) {
      deleteDocument(selectedId);
      // Never leave the deleted map picked: the list drops it only when the
      // server replies, and falling back to the first entry could re-pick it.
      const next = activeId && activeId !== selectedId ? activeId : undefined;
      setSelectedId(next ?? documents.find((document) => document.id !== selectedId)?.id ?? "");
    }
  };

  const busy = loading || saving;
  return (
    <JRPGPanel variant="simple" title="Map library">
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <p className="jrpg-text-small" style={{ margin: 0 }}>
          Saved maps. Viewing one never moves the party; Use at table does, after asking.
        </p>
        <div>
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
                {libraryOptionLabel(document, documents, onTableId)}
              </option>
            ))}
          </select>
          <CampaignWeight bytes={exportBytes} maps={documents.length} />
          <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
            <JRPGButton
              style={{ flex: 1, fontSize: "10px" }}
              disabled={!pickListed || busy}
              onClick={handleOpen}
            >
              View saved map
            </JRPGButton>
            {onUseAtTable && (
              <JRPGButton
                variant="primary"
                style={{ flex: 1, fontSize: "10px" }}
                title={
                  selectedId && selectedId === tableMapDocumentId
                    ? "Already on the table"
                    : "Put this map on the table for everyone"
                }
                disabled={!pickListed || busy || selectedId === tableMapDocumentId}
                onClick={() => putAtTable(selectedId)}
              >
                Use at table
              </JRPGButton>
            )}
            <JRPGButton
              variant="danger"
              style={{ fontSize: "10px" }}
              disabled={!pickListed || busy}
              onClick={handleDelete}
            >
              DELETE
            </JRPGButton>
            <JRPGButton
              aria-label="Refresh map library"
              style={{ fontSize: "10px" }}
              disabled={loading}
              onClick={refresh}
            >
              ↻
            </JRPGButton>
          </div>
        </div>

        {/* Status + error live outside the viewed-document block: import (and its
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
          <ViewedMapDetails
            document={activeDocument}
            name={displayName(activeDocument.id, documents) ?? activeDocument.name}
            onTable={activeDocument.id === onTableId}
            saving={saving}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            canPublish={Boolean(onPublishToLiveMap)}
            onPublish={() => publish(activeDocument)}
          />
        )}

        <div
          style={{
            borderTop: "1px solid var(--jrpg-border-gold)",
            paddingTop: "10px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
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
          <p className="jrpg-text-small" style={{ margin: 0 }}>
            A new map opens here to view.
            {tableName
              ? ` The table stays on "${tableName}" until you choose Use at table`
              : " Nothing on the table changes until you choose Use at table"}
            {" (or Advanced → Publish map background)."}
          </p>
          <JRPGButton variant="primary" disabled={busy || !name.trim()} onClick={handleCreate}>
            {loading ? "WORKING..." : "＋ Create map in library"}
          </JRPGButton>
          <JRPGButton
            style={{ fontSize: "10px" }}
            disabled={busy}
            onClick={() => importInputRef.current?.click()}
          >
            Import editable map (.json)
          </JRPGButton>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={onImportChange}
          />
        </div>
      </div>
    </JRPGPanel>
  );
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
