import { useEffect, useRef } from "react";
import type { AtlasNodeSnapshot, MapDocumentSummary } from "@herobyte/shared";
import type { MapBindRefusal } from "../../../map-studio/types";
import {
  displayName,
  generatedMapFogNote,
  sceneLossWarning,
  tableSceneFate,
} from "../../../map-studio/tableMapIdentity";

interface UseMapAtTableOptions {
  documents: ReadonlyArray<Pick<MapDocumentSummary, "id" | "name">>;
  /** The room's live binding: the map the party is on. */
  tableMapDocumentId?: string;
  /** The compiled scene's own map: what the server saves when the table moves. */
  liveSceneDocumentId?: string;
  missingDocumentId?: string | null;
  /** The library has answered (before that, an absent map proves nothing). */
  listed: boolean;
  hasBackground: boolean;
  /** Fog on the table now: Use at table keeps it, where Travel here may not. */
  fogEnabled: boolean;
  /** World locations, so a location's map can say what Travel here does instead. */
  atlasNodes: ReadonlyArray<Pick<AtlasNodeSnapshot, "name" | "mapDocumentId" | "recipe">>;
  /** Sends the existing map-studio-set-live binding transition. */
  onUseAtTable?: (documentId: string) => void;
  /** The controller's last refused binding (see useMapStudio). */
  bindRefusal: MapBindRefusal | null;
  setStatus: (status: string) => void;
}

/**
 * Put a saved map on the table, deliberately. Viewing a map in the library
 * never moves the party; this is the one library action that does, so it asks
 * first and says what happens to the scene it replaces — saved when its map is
 * still in the library, lost for good when it is not.
 */
export function useUseMapAtTable({
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
  setStatus,
}: UseMapAtTableOptions) {
  const pending = useRef<{ id: string; name: string } | null>(null);

  // Success is the table saying so, not the click.
  useEffect(() => {
    if (pending.current && tableMapDocumentId === pending.current.id) {
      setStatus(`"${pending.current.name}" is on the table.`);
      pending.current = null;
    }
  }, [tableMapDocumentId, setStatus]);

  // Only a refusal of THIS map ends the wait; a repeat of the same refusal is
  // a new object, so it still lands.
  useEffect(() => {
    if (!bindRefusal || bindRefusal.documentId !== pending.current?.id) return;
    setStatus(`"${pending.current.name}" is not on the table.`);
    pending.current = null;
  }, [bindRefusal, setStatus]);

  return (documentId: string) => {
    if (!onUseAtTable || !documentId || documentId === tableMapDocumentId) return;
    const name = displayName(documentId, documents) ?? "this map";
    const fate = tableSceneFate({
      sceneDocumentId: liveSceneDocumentId,
      missingDocumentId,
      documents,
      listed,
    });
    const warning = sceneLossWarning(fate);
    const current =
      fate === "kept" && liveSceneDocumentId
        ? displayName(liveSceneDocumentId, documents)
        : undefined;
    // The binding was cleared but the scene still comes from this very map (an
    // older save): putting it back re-attaches the scene, and nothing moves.
    if (documentId === liveSceneDocumentId && current) {
      const prompt = `Put "${name}" back on the table as its editable map? The scene on the table already comes from it; nothing moves.`;
      if (!window.confirm(prompt)) {
        setStatus("The table is unchanged.");
        return;
      }
      pending.current = { id: documentId, name };
      onUseAtTable(documentId);
      setStatus(`Putting "${name}" on the table…`);
      return;
    }
    const lines = [`Put "${name}" on the table for everyone?`];
    if (current) {
      lines.push(
        `The table is on "${current}". It is saved exactly as it stands and comes back when ` +
          "you use it at the table again.",
      );
    } else if (warning) {
      lines.push(warning);
    } else if (hasBackground) {
      lines.push("The table's background image stays underneath the map.");
    }
    const location = atlasNodes.find((node) => node.mapDocumentId === documentId);
    if (location) {
      lines.push(
        `"${name}" is also the World location "${location.name}". Travel here (World tab) ` +
          "would move the party to its entrance and mark it discovered; Use at table does neither.",
      );
      // A generated location's first visit by Travel here turns fog on; Use at
      // table keeps the table's fog, which would show its whole floor plan.
      if (location.recipe && !fogEnabled) lines.push(generatedMapFogNote("Use at table"));
    }
    if (!window.confirm(lines.join("\n\n"))) {
      setStatus(current ? `The table stays on "${current}".` : "The table is unchanged.");
      return;
    }
    pending.current = { id: documentId, name };
    onUseAtTable(documentId);
    setStatus(`Putting "${name}" on the table…`);
  };
}
