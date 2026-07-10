import {
  addMapLayer,
  moveMapLayer,
  paintTerrain,
  removeMapLayer,
  updateMapGrid,
  updateMapLayer,
  type TerrainPaintCell,
} from "./mapStudio.js";
import {
  addMapElement,
  addMapElements,
  removeMapElement,
  updateMapDoor,
  updateMapElement,
} from "./mapStudioElements.js";
import type {
  MapDocument,
  MapDoorState,
  MapElement,
  MapElementUpdate,
  MapGridUpdate,
  MapLayer,
  MapLayerUpdate,
} from "./mapStudioTypes.js";

interface MapCommandBase {
  commandId: string;
  documentId: string;
  baseRevision: number;
}

export type MapHistoryCommand = MapCommandBase & { type: "undo" | "redo" };

export type MapDocumentCommand =
  | (MapCommandBase & { type: "update-grid"; update: MapGridUpdate })
  | (MapCommandBase & { type: "add-layer"; layer: MapLayer })
  | (MapCommandBase & { type: "update-layer"; layerId: string; update: MapLayerUpdate })
  | (MapCommandBase & { type: "move-layer"; layerId: string; targetIndex: number })
  | (MapCommandBase & { type: "remove-layer"; layerId: string })
  | (MapCommandBase & { type: "add-element"; element: MapElement })
  | (MapCommandBase & { type: "add-elements"; elements: MapElement[] })
  | (MapCommandBase & {
      type: "update-element";
      elementId: string;
      update: MapElementUpdate;
    })
  | (MapCommandBase & {
      type: "update-door";
      elementId: string;
      state: MapDoorState;
      width: number;
    })
  | (MapCommandBase & { type: "remove-element"; elementId: string })
  | (MapCommandBase & { type: "paint-terrain"; cells: TerrainPaintCell[] });

export type MapStudioCommand = MapDocumentCommand | MapHistoryCommand;

export interface AppliedMapDocumentCommand {
  commandId: string;
  documentId: string;
  previousRevision: number;
  revision: number;
  document: MapDocument;
}

export class MapDocumentRevisionConflictError extends Error {
  readonly expectedRevision: number;
  readonly actualRevision: number;

  constructor(expectedRevision: number, actualRevision: number) {
    super(`Map document revision conflict: expected ${expectedRevision}, actual ${actualRevision}`);
    this.name = "MapDocumentRevisionConflictError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

export function applyMapDocumentCommand(
  document: MapDocument,
  command: MapDocumentCommand,
  timestamp: number = Date.now(),
): AppliedMapDocumentCommand {
  if (!command.commandId.trim()) {
    throw new Error("Map command id is required");
  }
  if (command.documentId !== document.id) {
    throw new Error(
      `Map command document mismatch: expected ${document.id}, received ${command.documentId}`,
    );
  }
  if (!Number.isInteger(command.baseRevision) || command.baseRevision < 0) {
    throw new Error("Map command base revision must be a non-negative integer");
  }
  if (command.baseRevision !== document.revision) {
    throw new MapDocumentRevisionConflictError(command.baseRevision, document.revision);
  }

  let next: MapDocument;
  switch (command.type) {
    case "update-grid":
      next = updateMapGrid(document, command.update, timestamp);
      break;
    case "add-layer":
      next = addMapLayer(document, command.layer, timestamp);
      break;
    case "update-layer":
      next = updateMapLayer(document, command.layerId, command.update, timestamp);
      break;
    case "move-layer":
      next = moveMapLayer(document, command.layerId, command.targetIndex, timestamp);
      break;
    case "remove-layer":
      next = removeMapLayer(document, command.layerId, timestamp);
      break;
    case "add-element":
      next = addMapElement(document, command.element, timestamp);
      break;
    case "add-elements":
      next = addMapElements(document, command.elements, timestamp);
      break;
    case "update-element":
      next = updateMapElement(document, command.elementId, command.update, timestamp);
      break;
    case "update-door":
      next = updateMapDoor(
        document,
        command.elementId,
        { state: command.state, width: command.width },
        timestamp,
      );
      break;
    case "remove-element":
      next = removeMapElement(document, command.elementId, timestamp);
      break;
    case "paint-terrain":
      next = paintTerrain(document, command.cells, timestamp);
      break;
  }

  return {
    commandId: command.commandId.trim(),
    documentId: document.id,
    previousRevision: document.revision,
    revision: next.revision,
    document: next,
  };
}
