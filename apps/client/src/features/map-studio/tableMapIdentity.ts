// ============================================================================
// TABLE MAP IDENTITY — "On table" vs "Viewing in library", in words
// ============================================================================
// A DM meets maps at several entry points (Build, the Maps tab, World), and
// the library's open document is NOT necessarily what the party sees: opening
// a saved map inspects it, it never moves the table. Every entry point names
// both from these helpers so the words cannot drift apart. Data-only on
// purpose — no React, no controller — so any surface may import it.

import type { MapDocumentSummary } from "@herobyte/shared";
import { formatUpdatedAt } from "./formatUpdatedAt";

type Named = Pick<MapDocumentSummary, "id" | "name">;

/**
 * A saved map's name as the DM should read it: with a short id when another
 * saved map shares the name (every backup import used to arrive as another
 * "Live Map"), so "On table" and "Viewing in library" never read alike.
 */
export function displayName(id: string, documents: ReadonlyArray<Named>): string | undefined {
  const document = documents.find((entry) => entry.id === id);
  if (!document) return undefined;
  const copies = documents.filter((entry) => entry.name === document.name).length;
  return copies > 1 ? `${document.name} #${id.slice(-4)}` : document.name;
}

interface OnTableInput {
  /** The room's live binding: the document Build edits. */
  liveMapDocumentId?: string;
  /** A binding to a map the server reported gone is no binding at all. */
  missingDocumentId?: string | null;
  /** The compiled scene's own map, named when no binding says otherwise. */
  sceneSourceDocumentId?: string;
  documents: ReadonlyArray<Named>;
  hasCompiledScene: boolean;
  hasBackground?: boolean;
}

/** What the party currently occupies, named for a DM. */
export function describeOnTable({
  liveMapDocumentId,
  missingDocumentId,
  sceneSourceDocumentId,
  documents,
  hasCompiledScene,
  hasBackground = false,
}: OnTableInput): string {
  if (liveMapDocumentId && liveMapDocumentId !== missingDocumentId) {
    return displayName(liveMapDocumentId, documents) ?? "the table map";
  }
  // Unbound, but the scene's own map is still saved (an older save file): it is
  // what the party sees, and it can be put back on the table.
  const sceneMap =
    sceneSourceDocumentId && sceneSourceDocumentId !== missingDocumentId
      ? displayName(sceneSourceDocumentId, documents)
      : undefined;
  if (sceneMap) return sceneMap;
  // No (live) binding but a scene still playing: the table's own map was
  // deleted, or a loaded session or restart named a map that no longer exists.
  if (hasCompiledScene) return "a scene with no editable map";
  if (hasBackground) return "a background image";
  return "no map yet";
}

/**
 * One saved map's line in the library picker. The edit counter and stamp stay;
 * the table's map is marked; and same-named copies (every backup import used
 * to arrive as another "Live Map") get a short id so no two lines read alike.
 */
export function libraryOptionLabel(
  document: MapDocumentSummary,
  documents: ReadonlyArray<MapDocumentSummary>,
  onTableId: string | undefined,
): string {
  const copies = documents.filter((entry) => entry.name === document.name).length;
  const copy = copies > 1 ? ` · #${document.id.slice(-4)}` : "";
  const stamp = `r${document.revision} · ${formatUpdatedAt(document.updatedAt)}`;
  const line = `${document.name}${copy} · ${stamp}`;
  return document.id === onTableId ? `● ${line} · on table` : line;
}

export type TableSceneFate = "none" | "kept" | "lost" | "unknown";

/**
 * What becomes of the scene on the table if another map replaces it. The server
 * saves an outgoing scene under the map it came from; a scene whose map is no
 * longer in the library has nowhere to be saved, so the next map erases it.
 * Before the library's first list reply (`listed: false`) an absent map proves
 * nothing, so the fate is "unknown" — unless the server already said it is gone.
 */
export function tableSceneFate({
  sceneDocumentId,
  missingDocumentId,
  documents,
  listed = true,
}: {
  sceneDocumentId?: string;
  missingDocumentId?: string | null;
  documents: ReadonlyArray<Named>;
  listed?: boolean;
}): TableSceneFate {
  if (!sceneDocumentId) return "none";
  if (sceneDocumentId === missingDocumentId) return "lost";
  if (documents.some((entry) => entry.id === sceneDocumentId)) return "kept";
  return listed ? "lost" : "unknown";
}

/** Said before any action that would replace a scene with no saved map. */
export const LOST_SCENE_WARNING =
  "The scene on the table has no saved map, so it cannot be kept: player characters come " +
  "along, but its NPCs, props, drawings, background and combat are removed for good.";

/** Said in place of the loss while the library has not answered yet. */
export const UNKNOWN_SCENE_WARNING =
  "The Map library has not loaded yet, so it is not certain the scene on the table has a " +
  "saved map. If it has none, player characters come along, but its NPCs, props, drawings, " +
  "background and combat are removed for good.";

/**
 * Said when a generated World location's map reaches the table by anything but
 * Travel here while fog is off. Travel here turns fog on for a first visit; the
 * other paths keep the table's fog — unless they resume a scene the party left
 * on that map, which brings its own fog back.
 */
export function generatedMapFogNote(action: string): string {
  return (
    "Fog is OFF at this table. Travel here turns fog on for this generated location's first " +
    `visit. ${action} does not: unless the party left a scene on this map (its own fog comes ` +
    "back with it), fog stays off and every player sees the whole map."
  );
}

/** The warning a table-moving confirm must carry for this fate, if any. */
export function sceneLossWarning(fate: TableSceneFate): string | null {
  if (fate === "lost") return LOST_SCENE_WARNING;
  if (fate === "unknown") return UNKNOWN_SCENE_WARNING;
  return null;
}
