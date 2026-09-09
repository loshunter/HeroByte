// The one question PUBLISH TO LIVE MAP has to ask, and when.
//
// Publishing the map the table is already on is a BAKE — the same scene,
// re-rendered as a raster — and needs no confirmation. Publishing any OTHER
// document replaces the table for everyone connected, and it used to happen
// by accident: the Studio's active document is the map a DM was LAST looking
// at, which after a kicked-in door is the map they left. So a publish that
// would change the scene says so first, naming both maps, the way session
// load names what it replaces. Unlike session load this one is recoverable,
// and the prompt says that too, because a DM who has just watched their map
// vanish deserves to be told it is still there.

export interface PublishTarget {
  id: string;
  name: string;
}

export interface LiveMapReplacement {
  prompt: string;
  liveName: string;
}

export function describeLiveMapReplacement(
  target: PublishTarget,
  liveSceneDocumentId: string | undefined,
  documents: ReadonlyArray<PublishTarget>,
): LiveMapReplacement | null {
  if (!liveSceneDocumentId || liveSceneDocumentId === target.id) return null;
  const liveName =
    documents.find((entry) => entry.id === liveSceneDocumentId)?.name ?? "the current map";
  return {
    liveName,
    prompt:
      `Publish "${target.name}" to the table?\n\n` +
      `The table is currently on "${liveName}". Publishing REPLACES it for everyone connected. ` +
      `The current map stays in your campaign — travel to its node brings it back.`,
  };
}
