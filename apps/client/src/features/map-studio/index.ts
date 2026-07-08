export { useMapStudio } from "./useMapStudio";
// NOTE: MapStudioWorkspace (the editor component + its renderer graph) is NOT
// re-exported here on purpose — entry code imports this barrel for `useMapStudio`
// and a static re-export would drag the whole editor into the entry chunk.
// Load it lazily by path: React.lazy(() => import(".../components/MapStudioWorkspace")).
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
