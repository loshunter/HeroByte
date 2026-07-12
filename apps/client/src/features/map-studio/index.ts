export { useMapStudio } from "./useMapStudio";
// This barrel is the Map Studio ENGINE's public surface (document/command/
// compile, export, publish) used by the live map-edit palette + the DM menu.
// The full-screen Studio editor scene was removed in S13; authoring is now live.
export type {
  MapDoorDraft,
  MapShapeDraft,
  MapStudioController,
  MapStudioServerMessage,
  MapTileDraft,
  MapWallDraft,
} from "./types";
export {
  downloadMapDocument,
  downloadRasterMapDocument,
  createMapDocumentSvgDataUrl,
  createMapDocumentSvgDataUrlWithAssets,
  backgroundExceedsPublishLimit,
  MAX_PUBLISH_BACKGROUND_BYTES,
  rasterizeMapDocument,
  renderMapDocumentSvg,
  serializeMapDocument,
  type MapExportFormat,
} from "./exportMapDocument";
export { rasterizeAndUploadMapBackground, describePublishFailure } from "./publishRaster";
