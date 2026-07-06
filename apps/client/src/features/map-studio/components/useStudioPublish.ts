import { useState } from "react";
import type { MapDocument, MapPublishBackgroundMode } from "@herobyte/shared";
import {
  backgroundExceedsPublishLimit,
  createMapDocumentSvgDataUrlWithAssets,
} from "../exportMapDocument";

const TOO_LARGE_MESSAGE =
  "Publish failed: this map's images are too large to send. Remove or shrink uploaded images and try again.";

interface StudioPublishOptions {
  activeDocument: MapDocument | null;
  publishDocument: (
    background: string,
    documentId?: string,
    backgroundMode?: MapPublishBackgroundMode,
  ) => boolean;
  onPublishStatus?: (message: string) => void;
}

/**
 * Publishing the active document to the live scene. Uploaded images inline
 * asynchronously (SVG-as-image can't fetch external refs), so the flow is
 * async and guarded against (a) the active document switching mid-render and
 * (b) an oversized background the server would silently drop past its 1MB cap.
 */
export function useStudioPublish({
  activeDocument,
  publishDocument,
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
      // Elements-only: terrain, grid, and the opaque backdrop are stripped from
      // the SVG. Terrain rides the wire as data (R5a) and draws live at the
      // table (R5b); the table supplies its own grid; a transparent background
      // lets that live terrain show through beneath the elements.
      const background = await createMapDocumentSvgDataUrlWithAssets(documentToPublish, {
        omitTerrain: true,
        omitGrid: true,
        transparentBackground: true,
      });
      if (backgroundExceedsPublishLimit(background)) {
        announce(TOO_LARGE_MESSAGE);
        return;
      }
      if (!publishDocument(background, documentToPublish.id, "elements-only")) return;
      announce(`Published "${documentToPublish.name}" to the live map.`);
    })();
  };

  return { publishMessage, setPublishMessage, handlePublish };
}
