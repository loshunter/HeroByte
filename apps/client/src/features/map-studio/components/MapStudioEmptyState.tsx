import type { MapDocumentSummary } from "@herobyte/shared";
import { JRPGButton, JRPGPanel } from "../../../components/ui/JRPGPanel";
import { StudioTopBar } from "./MapStudioWorkspaceControls";
import { emptyStateStyle, workspaceStyle } from "./mapStudioWorkspaceStyles";

interface MapStudioEmptyStateProps {
  documents: MapDocumentSummary[];
  selectedDocumentId: string;
  newMapName: string;
  loading: boolean;
  saving: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onSelectedDocumentIdChange: (documentId: string) => void;
  onNewMapNameChange: (name: string) => void;
  onOpenSelected: () => void;
  onCreate: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onPublish: () => void;
  onExit: () => void;
}

export function MapStudioEmptyState({
  documents,
  selectedDocumentId,
  newMapName,
  loading,
  saving,
  canUndo,
  canRedo,
  onSelectedDocumentIdChange,
  onNewMapNameChange,
  onOpenSelected,
  onCreate,
  onUndo,
  onRedo,
  onPublish,
  onExit,
}: MapStudioEmptyStateProps) {
  return (
    <div style={workspaceStyle}>
      <StudioTopBar
        title="HeroByte Map Studio"
        saving={saving}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        onPublish={onPublish}
        onExit={onExit}
        publishDisabled
      />
      <div style={emptyStateStyle}>
        <JRPGPanel variant="simple" title="Choose a Map">
          <div style={{ display: "grid", gap: "10px", minWidth: "320px" }}>
            <label className="jrpg-text-small">
              Saved maps
              <select
                aria-label="Studio saved maps"
                value={selectedDocumentId}
                onChange={(event) => onSelectedDocumentIdChange(event.target.value)}
                style={{ width: "100%", marginTop: "4px" }}
              >
                <option value="">{documents.length ? "Choose a map" : "No maps yet"}</option>
                {documents.map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.name} · r{document.revision}
                  </option>
                ))}
              </select>
            </label>
            <JRPGButton disabled={!selectedDocumentId || loading} onClick={onOpenSelected}>
              OPEN MAP
            </JRPGButton>
            <label className="jrpg-text-small">
              New map name
              <input
                aria-label="Studio new map name"
                value={newMapName}
                onChange={(event) => onNewMapNameChange(event.target.value)}
                style={{ width: "100%", marginTop: "4px" }}
              />
            </label>
            <JRPGButton
              variant="primary"
              disabled={loading || saving || !newMapName.trim()}
              onClick={onCreate}
            >
              CREATE MAP
            </JRPGButton>
          </div>
        </JRPGPanel>
      </div>
    </div>
  );
}
