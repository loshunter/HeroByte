// What opening Build offers when the table's map is not the open document.
// Build edits the map on the table. If a DM opened a different saved map in the
// library, Build names both and offers to RESUME the table's map; it never
// swaps documents on its own, and never offers to "start" a map the table
// already has. Only a missing or dangling binding starts a new one — and a
// start that would erase a scene with no saved map says so first.

import type { MapDocumentSummary } from "@herobyte/shared";
import { describeOnTable, displayName, tableSceneFate } from "../map-studio/tableMapIdentity";

export type BuildEntry =
  | { kind: "live" }
  | { kind: "resume"; onTableName: string; viewingName: string | null }
  | {
      kind: "start";
      /** What the party sees now, and the library map open (if any), named. */
      onTableName?: string;
      viewingName?: string | null;
      replacesUnsavedScene?: boolean;
      /** The library has not answered yet, so the loss is possible, not certain. */
      sceneFateUnknown?: boolean;
      /** Unbound, but the scene's own map is still saved (an older save file). */
      sceneMapSaved?: boolean;
    };

interface BuildEntryInput {
  isLive: boolean;
  liveMapDocumentId: string | undefined;
  bindingDangling: boolean;
  activeDocument: { id: string; name: string } | null;
  documents: ReadonlyArray<Pick<MapDocumentSummary, "id" | "name">>;
  /** The compiled scene's own map: a start replaces that scene. */
  sceneSourceDocumentId?: string;
  missingDocumentId?: string | null;
  /** The library has answered (before that, an absent map proves nothing). */
  listed?: boolean;
  hasBackground?: boolean;
}

export function describeBuildEntry({
  isLive,
  liveMapDocumentId,
  bindingDangling,
  activeDocument,
  documents,
  sceneSourceDocumentId,
  missingDocumentId,
  listed = true,
  hasBackground = false,
}: BuildEntryInput): BuildEntry {
  if (isLive) return { kind: "live" };
  if (!liveMapDocumentId || bindingDangling) {
    const fate = tableSceneFate({
      sceneDocumentId: sceneSourceDocumentId,
      missingDocumentId,
      documents,
      listed,
    });
    return {
      kind: "start",
      onTableName: describeOnTable({
        liveMapDocumentId,
        missingDocumentId: bindingDangling ? liveMapDocumentId : missingDocumentId,
        sceneSourceDocumentId,
        documents,
        hasCompiledScene: Boolean(sceneSourceDocumentId),
        hasBackground,
      }),
      // The scene's own map, open in the library, is not a second map.
      viewingName:
        activeDocument && activeDocument.id !== sceneSourceDocumentId
          ? (displayName(activeDocument.id, documents) ?? activeDocument.name)
          : null,
      replacesUnsavedScene: fate === "lost" || fate === "unknown",
      sceneFateUnknown: fate === "unknown",
      sceneMapSaved: fate === "kept",
    };
  }
  return {
    kind: "resume",
    onTableName: describeOnTable({ liveMapDocumentId, documents, hasCompiledScene: true }),
    viewingName:
      activeDocument && activeDocument.id !== liveMapDocumentId
        ? (displayName(activeDocument.id, documents) ?? activeDocument.name)
        : null,
  };
}
