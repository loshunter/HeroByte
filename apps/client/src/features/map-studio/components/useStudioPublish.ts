import { useState } from "react";
import type { MapDocument, MapPublishBackgroundMode } from "@herobyte/shared";
import type { UploadedAssetInfo } from "../uploads/assetUpload";
import { describePublishFailure, rasterizeAndUploadMapBackground } from "../publishRaster";

interface StudioPublishOptions {
  activeDocument: MapDocument | null;
  publishDocument: (
    background: string,
    documentId?: string,
    backgroundMode?: MapPublishBackgroundMode,
  ) => boolean;
  uploadAsset: (file: File) => Promise<UploadedAssetInfo>;
  onPublishStatus?: (message: string) => void;
}

/**
 * Publishing the active document to the live scene. The map is baked to a full
 * opaque raster PNG (terrain composited) and uploaded by reference to the
 * content-addressed /assets store; only its short URL rides the publish message
 * ("full" mode), so the 1MB inbound cap can't drop it. The flow is async and
 * guarded against the active document switching mid-bake.
 */
export function useStudioPublish({
  activeDocument,
  publishDocument,
  uploadAsset,
  onPublishStatus,
}: StudioPublishOptions): {
  publishMessage: string;
  setPublishMessage: (message: string) => void;
  handlePublish: () => void;
} {
  const [publishMessage, setPublishMessage] = useState("");

  const announce = (message: string) => {
    setPublishMessage(message);
    onPublishStatus?.(message);
  };

  const handlePublish = () => {
    const documentToPublish = activeDocument;
    if (!documentToPublish) return;
    void (async () => {
      let backgroundUrl: string;
      try {
        backgroundUrl = await rasterizeAndUploadMapBackground(documentToPublish, uploadAsset);
      } catch (error) {
        announce(describePublishFailure(error));
        return;
      }
      if (!publishDocument(backgroundUrl, documentToPublish.id, "full")) return;
      announce(`Published "${documentToPublish.name}" to the live map.`);
    })();
  };

  return { publishMessage, setPublishMessage, handlePublish };
}
