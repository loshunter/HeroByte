import { useEffect, useRef, type ChangeEvent } from "react";
import type { MapDocument, MapDocumentSummary } from "@herobyte/shared";
import type { MapStudioController } from "../../../map-studio";
import { displayName } from "../../../map-studio/tableMapIdentity";
import { parseBackupImport } from "./importBackup";

interface MapImportOptions {
  importDocument: MapStudioController["importDocument"];
  activeDocument: MapDocument | null;
  /** The library, so an import that shares a name reads as the copy it is. */
  documents: ReadonlyArray<Pick<MapDocumentSummary, "id" | "name">>;
  error: string | null;
  setStatus: (status: string) => void;
  setSelectedId: (id: string) => void;
}

/** Restore an editable-map JSON file as a new library document, with honest status. */
export function useMapImport({
  importDocument,
  activeDocument,
  documents,
  error,
  setStatus,
  setSelectedId,
}: MapImportOptions) {
  const importInputRef = useRef<HTMLInputElement>(null);
  // The id of the last document sent for import, so we can turn the in-progress
  // "Importing…" status into a completion once that document activates.
  const importingIdRef = useRef<string | null>(null);

  const handleImportFile = (fileText: string) => {
    const parsed = parseBackupImport(fileText);
    if ("error" in parsed) {
      setStatus(parsed.error);
      return;
    }
    const id = importDocument(parsed.document);
    importingIdRef.current = id;
    setSelectedId(id);
    setStatus("Importing editable map…");
  };

  // Resolve the "Importing…" status once the imported document activates, so the
  // panel doesn't read "Importing editable map…" forever under a finished import.
  useEffect(() => {
    if (importingIdRef.current && activeDocument?.id === importingIdRef.current) {
      importingIdRef.current = null;
      const name = displayName(activeDocument.id, documents) ?? activeDocument.name;
      setStatus(`Imported "${name}".`);
    }
  }, [activeDocument, documents, setStatus]);

  // If an import fails, the watchdog surfaces controller.error while the import
  // is still pending — drop the now-misleading "Importing…" status (the visible
  // error carries the failure) and stop tracking the import so a later publish
  // status can't be blanked by an unrelated error.
  useEffect(() => {
    if (error && importingIdRef.current) {
      importingIdRef.current = null;
      setStatus("");
    }
  }, [error, setStatus]);

  const onImportChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    // `.catch`, not `.then`'s second argument: that catches a failed
    // READ only, so a handler throw vanished and the panel said
    // nothing. One sentence, true of both failures — see importBackup.
    const failed = () => setStatus("Import failed: that file could not be read or applied.");
    file.text().then(handleImportFile).catch(failed);
  };

  return { importInputRef, onImportChange };
}
