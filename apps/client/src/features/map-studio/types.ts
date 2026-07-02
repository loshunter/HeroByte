import type {
  MapDocument,
  MapDocumentSummary,
  MapElementUpdate,
  MapGridUpdate,
  MapLayerUpdate,
  ServerMessage,
} from "@herobyte/shared";

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
  addShape: (draft: MapShapeDraft) => string | null;
  addWall: (draft: MapWallDraft) => string | null;
  addDoor: (draft: MapDoorDraft) => string | null;
  removeElement: (elementId: string) => void;
  updateElement: (elementId: string, update: MapElementUpdate) => void;
  undo: () => void;
  redo: () => void;
  /** Publish the active document: the server compiles walls/doors/lights into the live scene. */
  publishDocument: (background: string) => boolean;
  /** Restore a serialized JSON backup as a new document (fresh id, server-sanitized). */
  importDocument: (document: MapDocument) => string;
  handleServerMessage: (message: MapStudioServerMessage) => void;
}
