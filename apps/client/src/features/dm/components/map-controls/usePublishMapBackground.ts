import type { AtlasNodeSnapshot, MapDocument, MapPublishBackgroundMode } from "@herobyte/shared";
import {
  describePublishFailure,
  rasterizeAndUploadMapBackground,
  type MapStudioController,
} from "../../../map-studio";
import { displayName, generatedMapFogNote } from "../../../map-studio/tableMapIdentity";
import { describeLiveMapReplacement, type PublishTarget } from "./publishGuard";

export interface PublishToLiveMap {
  backgroundUrl: string;
  gridSize: number;
  documentId: string;
  documentName: string;
  backgroundMode: MapPublishBackgroundMode;
}

interface PublishMapBackgroundOptions {
  documents: ReadonlyArray<PublishTarget>;
  liveSceneDocumentId: string | undefined;
  missingDocumentId?: string | null;
  /** The library has answered (before that, an absent map proves nothing). */
  listed: boolean;
  /** Fog on the table now, and World locations: a publish keeps the fog. */
  fogEnabled: boolean;
  atlasNodes: ReadonlyArray<Pick<AtlasNodeSnapshot, "mapDocumentId" | "recipe">>;
  uploadAsset: MapStudioController["uploadAsset"];
  /** Returns false when nothing was sent (the viewed map changed during the bake). */
  onPublishToLiveMap?: (publish: PublishToLiveMap) => boolean | void;
  setStatus: (status: string) => void;
}

/**
 * The legacy raster publish: bake the document to one flat image, upload it,
 * and hand the table a reference. A publish of any document other than the one
 * the table is on replaces the table, so it asks first.
 */
export function usePublishMapBackground({
  documents,
  liveSceneDocumentId,
  missingDocumentId,
  listed,
  fogEnabled,
  atlasNodes,
  uploadAsset,
  onPublishToLiveMap,
  setStatus,
}: PublishMapBackgroundOptions) {
  const generatedLocationMap = (id: string) =>
    atlasNodes.some((node) => node.mapDocumentId === id && node.recipe);
  return (documentToPublish: MapDocument | null) => {
    if (!documentToPublish || !onPublishToLiveMap) return;
    const replacement = describeLiveMapReplacement(
      documentToPublish,
      liveSceneDocumentId,
      documents,
      missingDocumentId,
      listed,
      generatedLocationMap(documentToPublish.id) && !fogEnabled
        ? generatedMapFogNote("Publishing")
        : undefined,
    );
    if (replacement && !window.confirm(replacement.prompt)) {
      setStatus(
        replacement.liveName
          ? `Publish cancelled — the table stays on "${replacement.liveName}".`
          : "Publish cancelled — the table is unchanged.",
      );
      return;
    }
    const name = displayName(documentToPublish.id, documents) ?? documentToPublish.name;
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
        setStatus(describePublishFailure(error));
        return;
      }
      const sent = onPublishToLiveMap({
        backgroundUrl,
        gridSize: toLiveGridSize(documentToPublish.grid.size),
        documentId: documentToPublish.id,
        documentName: documentToPublish.name,
        backgroundMode: "full",
      });
      setStatus(
        sent === false
          ? `"${name}" was not published: the map open in the library changed while it was baking.`
          : `Published "${name}" as the table's map background.`,
      );
    })();
  };
}

function toLiveGridSize(documentGridSize: number): number {
  return Math.min(500, Math.max(10, Math.round(documentGridSize)));
}
