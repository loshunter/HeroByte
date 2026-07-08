// Slice 4 publish producer: instead of shipping an elements-only SVG data-url
// on the wire (and streaming painted terrain live), publish bakes the whole map
// to a full opaque PNG — terrain composited in — and uploads it by reference.
//
// Upload-by-reference dodges the 1MB inbound WebSocket cap by construction: the
// PNG rides an HTTP POST to the content-addressed /assets store (5MB ceiling,
// same-origin) and only its short URL travels in the publish message. The server
// then stores that URL in mapBackground exactly as it stores any background
// string, and the table renders it as the first-class "map" scene object.
import type { MapDocument } from "@herobyte/shared";
import { rasterizeMapDocument } from "./exportMapDocument";
import { AssetUploadError, uploadedAssetUrl, type UploadedAssetInfo } from "./uploads/assetUpload";

/**
 * Rasterise the document to a PNG, upload it to the /assets store, and return
 * the servable same-origin URL to hand to `publishDocument(url, id, "full")`.
 * Rejects with {@link AssetUploadError} when the room lacks credentials or the
 * baked PNG exceeds the 5MB upload cap.
 */
export async function rasterizeAndUploadMapBackground(
  document: MapDocument,
  uploadAsset: (file: File) => Promise<UploadedAssetInfo>,
): Promise<string> {
  // omitGrid: the live table draws its own grid overlay, so a grid baked into
  // the raster would double-draw (and drift when the DM moves/scales the map).
  const blob = await rasterizeMapDocument(document, "image/png", { omitGrid: true });
  const file = new File([blob], mapBackgroundFilename(document.name), { type: "image/png" });
  const { hash } = await uploadAsset(file);
  return uploadedAssetUrl(hash);
}

/** Turn an upload/rasterise failure into a DM-facing publish status message. */
export function describePublishFailure(error: unknown): string {
  if (error instanceof AssetUploadError) {
    return `Publish failed: ${error.message}`;
  }
  return "Publish failed: the map could not be prepared for the live table.";
}

function mapBackgroundFilename(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "map"}.png`;
}
