// The one question Publish map background has to ask, and when.
//
// Publishing the map the table is already on is a BAKE — the same scene,
// re-rendered as a raster — and needs no confirmation. Publishing any OTHER
// document replaces the table for everyone connected, and it used to happen
// by accident: the library's open document is the map a DM was LAST looking
// at, which after a kicked-in door is the map they left. So a publish that
// would change the scene says so first, naming both maps, the way session
// load names what it replaces — and says whether the scene it replaces is
// kept (its map is still in the library) or lost for good (its map is gone).

import {
  displayName,
  sceneLossWarning,
  tableSceneFate,
} from "../../../map-studio/tableMapIdentity";

export interface PublishTarget {
  id: string;
  name: string;
}

export interface LiveMapReplacement {
  prompt: string;
  /** The kept scene's map, named; absent when the scene is lost. */
  liveName?: string;
}

export function describeLiveMapReplacement(
  target: PublishTarget,
  liveSceneDocumentId: string | undefined,
  documents: ReadonlyArray<PublishTarget>,
  missingDocumentId?: string | null,
  listed = true,
  /** Said too (a generated location's map while fog is off), even for a bake. */
  fogNote?: string,
): LiveMapReplacement | null {
  const targetName = displayName(target.id, documents) ?? target.name;
  const ask = `Publish "${targetName}" to the table?`;
  if (!liveSceneDocumentId || liveSceneDocumentId === target.id) {
    return fogNote ? { prompt: `${ask}\n\n${fogNote}` } : null;
  }
  const tail = fogNote ? `\n\n${fogNote}` : "";
  const fate = tableSceneFate({
    sceneDocumentId: liveSceneDocumentId,
    missingDocumentId,
    documents,
    listed,
  });
  const warning = sceneLossWarning(fate);
  if (warning) return { prompt: `${ask}\n\n${warning}${tail}` };
  const liveName = displayName(liveSceneDocumentId, documents) ?? liveSceneDocumentId;
  return {
    liveName,
    prompt:
      `${ask}\n\n` +
      `The table is currently on "${liveName}". Publishing REPLACES it for everyone connected. ` +
      `The current map stays in your Map library — Use at table brings it back.${tail}`,
  };
}
