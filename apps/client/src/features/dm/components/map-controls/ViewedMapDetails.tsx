import type { MapDocument } from "@herobyte/shared";
import { JRPGButton } from "../../../../components/ui/JRPGPanel";
import { MapStudioExportControls } from "./MapStudioExportControls";

interface ViewedMapDetailsProps {
  document: MapDocument;
  /** Its name as the library reads it (same-named copies carry a short id). */
  name: string;
  /** The viewed map is the one the party is on. */
  onTable: boolean;
  saving: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canPublish: boolean;
  onPublish: () => void;
}

/**
 * The saved map the library is showing: its details, its own edit history and
 * its exports. Details only — never a rendered preview or a second editor.
 */
export function ViewedMapDetails({
  document,
  name,
  onTable,
  saving,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  canPublish,
  onPublish,
}: ViewedMapDetailsProps) {
  const history = `the last edit to "${name}"`;
  return (
    <div aria-live="polite">
      <div className="jrpg-text-small" style={{ marginBottom: "6px" }}>
        Viewing: <strong>{name}</strong> · {document.width}×{document.height} · revision{" "}
        {document.revision} · {document.elements.length}
        {" elements"}
        {onTable && " · on table"}
        {saving && " · saving…"}
      </div>
      <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
        <JRPGButton
          style={{ flex: 1, fontSize: "10px", ...(saving ? { opacity: 0.5 } : {}) }}
          title={`Undo ${history}`}
          disabled={!canUndo}
          aria-disabled={saving || undefined}
          onClick={saving ? undefined : onUndo}
        >
          ↶ Undo edit
        </JRPGButton>
        <JRPGButton
          style={{ flex: 1, fontSize: "10px", ...(saving ? { opacity: 0.5 } : {}) }}
          title={`Redo ${history}`}
          disabled={!canRedo}
          aria-disabled={saving || undefined}
          onClick={saving ? undefined : onRedo}
        >
          ↷ Redo edit
        </JRPGButton>
      </div>
      <MapStudioExportControls document={document} disabled={saving} />
      <details>
        <summary className="jrpg-text-small">Advanced</summary>
        <p className="jrpg-text-small">
          Publish map background bakes this map into one flat image and puts that image on the table
          for everyone; later edits draw over that snapshot. Use at table draws the map live, so
          later edits show cleanly.
        </p>
        <JRPGButton
          style={{ width: "100%", fontSize: "10px" }}
          disabled={saving || !canPublish}
          onClick={onPublish}
        >
          Publish map background
        </JRPGButton>
      </details>
    </div>
  );
}
