import type {
  ClientMessage,
  MapDocument,
  MapDocumentSummary,
  MapDoorState,
  MapElement,
  MapElementUpdate,
  MapGridUpdate,
  MapLayerUpdate,
  MapPublishBackgroundMode,
  ServerMessage,
  TerrainPaintCell,
} from "@herobyte/shared";
import type { UploadedAssetInfo } from "./uploads/assetUpload";

export type MapStudioServerMessage = Extract<
  ServerMessage,
  {
    t: "map-studio-documents" | "map-studio-document" | "map-studio-deleted" | "map-studio-error";
  }
>;

export interface MapShapeDraft {
  layerId: string;
  shape: "rectangle" | "ellipse";
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
}

export interface MapTileDraft {
  layerId: string;
  assetId: string;
  x: number;
  y: number;
  columns: number;
  rows: number;
  tint?: string;
}

/** Off-grid Shelf placement: pixel-precise position and footprint. */
export interface MapStampDraft {
  layerId: string;
  assetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees, around the stamp's visual center. Defaults to 0. */
  rotation?: number;
  tint?: string;
}

export interface MapWallDraft {
  layerId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  blocksMovement: boolean;
  blocksVision: boolean;
}

export interface MapDoorDraft {
  layerId: string;
  x: number;
  y: number;
  width: number;
  rotation: number;
  state: "open" | "closed" | "locked" | "secret";
  blocksMovement: boolean;
  blocksVision: boolean;
}

/** A generate request, minus the documentId and commandId the queue supplies. */
export type GenerateInput = Omit<
  Extract<ClientMessage, { t: "map-studio-generate" }>,
  "t" | "documentId" | "commandId"
>;

export interface MapStudioController {
  documents: MapDocumentSummary[];
  activeDocument: MapDocument | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  canUndo: boolean;
  canRedo: boolean;
  refresh: () => void;
  createDocument: (name: string, width?: number, height?: number) => string;
  openDocument: (documentId: string) => void;
  deleteDocument: (documentId: string) => void;
  updateLayer: (layerId: string, update: MapLayerUpdate) => void;
  moveLayer: (layerId: string, targetIndex: number) => void;
  updateGrid: (update: MapGridUpdate) => void;
  addTile: (draft: MapTileDraft) => string | null;
  addTiles: (drafts: MapTileDraft[]) => string[];
  addStamp: (draft: MapStampDraft) => string | null;
  addStamps: (drafts: MapStampDraft[]) => string[];
  /** One brush stroke: a batch of cell paints/erases as one undo step. */
  paintTerrain: (cells: TerrainPaintCell[]) => void;
  /** Place a room: floor terrain + wall/element geometry as ONE undo step. */
  placeRoom: (cells: TerrainPaintCell[], elements: MapElement[]) => void;
  addShape: (draft: MapShapeDraft) => string | null;
  addWall: (draft: MapWallDraft) => string | null;
  addDoor: (draft: MapDoorDraft) => string | null;
  removeElement: (elementId: string) => void;
  updateElement: (elementId: string, update: MapElementUpdate) => void;
  /** Author a placed door's initial state + width (dedicated data path). */
  updateDoor: (elementId: string, update: { state: MapDoorState; width: number }) => void;
  /**
   * Run a server-side recipe over a region of the active document. The whole
   * result lands as ONE undo step; `saving` is the pending state and `error`
   * carries a rejection, exactly like every other action.
   */
  generate: (input: GenerateInput) => void;
  undo: () => void;
  redo: () => void;
  /**
   * Publish the active document: the server compiles walls/doors/lights into
   * the live scene. Passing documentId makes the publish a no-op if a
   * different document became active meanwhile (async background rendering).
   * backgroundMode "elements-only" tells the server to attach the document's
   * terrain to the snapshot as data (R5); absent means a full-render
   * background (legacy behavior).
   */
  publishDocument: (
    background: string,
    documentId?: string,
    backgroundMode?: MapPublishBackgroundMode,
  ) => boolean;
  /** Upload an image to the content-addressed asset service (rejects with AssetUploadError). */
  uploadAsset: (file: File) => Promise<UploadedAssetInfo>;
  /** Restore a serialized JSON backup as a new document (fresh id, server-sanitized). */
  importDocument: (document: MapDocument) => string;
  handleServerMessage: (message: MapStudioServerMessage) => void;
}
