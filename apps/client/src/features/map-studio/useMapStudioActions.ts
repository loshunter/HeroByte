import { useCallback, type MutableRefObject } from "react";
import type {
  MapDocument,
  MapDoorState,
  MapElement,
  MapElementUpdate,
  MapGridUpdate,
  MapLayerUpdate,
  MapStudioCommand,
  TerrainPaintCell,
} from "@herobyte/shared";
import { generateUUID } from "../../utils/uuid";
import {
  createDoorElement,
  createShapeElement,
  createStampElement,
  createTileElement,
  createWallElement,
} from "./elementBuilders";
import type {
  MapDoorDraft,
  MapShapeDraft,
  MapStampDraft,
  MapTileDraft,
  MapWallDraft,
} from "./types";

type CommandBuilder = (document: MapDocument, commandId: string) => MapStudioCommand;

interface UseMapStudioActionsOptions {
  activeDocumentRef: MutableRefObject<MapDocument | null>;
  applyCommand: (build: CommandBuilder) => void;
}

export function useMapStudioActions({
  activeDocumentRef,
  applyCommand,
}: UseMapStudioActionsOptions) {
  const updateLayer = useCallback(
    (layerId: string, update: MapLayerUpdate) => {
      applyCommand((document, commandId) => ({
        commandId,
        documentId: document.id,
        baseRevision: document.revision,
        type: "update-layer",
        layerId,
        update,
      }));
    },
    [applyCommand],
  );

  const moveLayer = useCallback(
    (layerId: string, targetIndex: number) => {
      applyCommand((document, commandId) => ({
        commandId,
        documentId: document.id,
        baseRevision: document.revision,
        type: "move-layer",
        layerId,
        targetIndex,
      }));
    },
    [applyCommand],
  );

  const updateGrid = useCallback(
    (update: MapGridUpdate) => {
      applyCommand((document, commandId) => ({
        commandId,
        documentId: document.id,
        baseRevision: document.revision,
        type: "update-grid",
        update,
      }));
    },
    [applyCommand],
  );

  const addShape = useCallback(
    (draft: MapShapeDraft) => {
      if (!activeDocumentRef.current) return null;
      const id = generateUUID();
      const element = createShapeElement(id, draft);
      applyCommand((document, commandId) => ({
        commandId,
        documentId: document.id,
        baseRevision: document.revision,
        type: "add-element",
        element,
      }));
      return id;
    },
    [activeDocumentRef, applyCommand],
  );

  const addTile = useCallback(
    (draft: MapTileDraft) => {
      if (!activeDocumentRef.current) return null;
      const id = generateUUID();
      const element = createTileElement(id, draft);
      applyCommand((document, commandId) => ({
        commandId,
        documentId: document.id,
        baseRevision: document.revision,
        type: "add-element",
        element,
      }));
      return id;
    },
    [activeDocumentRef, applyCommand],
  );

  const addTiles = useCallback(
    (drafts: MapTileDraft[]) => {
      if (!activeDocumentRef.current || drafts.length === 0) return [];
      const elements = drafts.map((draft) => createTileElement(generateUUID(), draft));
      applyCommand((document, commandId) => ({
        commandId,
        documentId: document.id,
        baseRevision: document.revision,
        type: "add-elements",
        elements,
      }));
      return elements.map((element) => element.id);
    },
    [activeDocumentRef, applyCommand],
  );

  const addStamp = useCallback(
    (draft: MapStampDraft) => {
      if (!activeDocumentRef.current) return null;
      const id = generateUUID();
      const element = createStampElement(id, draft);
      applyCommand((document, commandId) => ({
        commandId,
        documentId: document.id,
        baseRevision: document.revision,
        type: "add-element",
        element,
      }));
      return id;
    },
    [activeDocumentRef, applyCommand],
  );

  const addStamps = useCallback(
    (drafts: MapStampDraft[]) => {
      if (!activeDocumentRef.current || drafts.length === 0) return [];
      const elements = drafts.map((draft) => createStampElement(generateUUID(), draft));
      applyCommand((document, commandId) => ({
        commandId,
        documentId: document.id,
        baseRevision: document.revision,
        type: "add-elements",
        elements,
      }));
      return elements.map((element) => element.id);
    },
    [activeDocumentRef, applyCommand],
  );

  const paintTerrain = useCallback(
    (cells: TerrainPaintCell[]) => {
      if (!activeDocumentRef.current || cells.length === 0) return;
      applyCommand((document, commandId) => ({
        commandId,
        documentId: document.id,
        baseRevision: document.revision,
        type: "paint-terrain",
        cells,
      }));
    },
    [activeDocumentRef, applyCommand],
  );

  const placeRoom = useCallback(
    (cells: TerrainPaintCell[], elements: MapElement[]) => {
      if (!activeDocumentRef.current || cells.length === 0 || elements.length === 0) return;
      // Floor terrain + wall perimeter as ONE command = ONE undo step.
      applyCommand((document, commandId) => ({
        commandId,
        documentId: document.id,
        baseRevision: document.revision,
        type: "place-room",
        cells,
        elements,
      }));
    },
    [activeDocumentRef, applyCommand],
  );

  const addWall = useCallback(
    (draft: MapWallDraft) => {
      if (!activeDocumentRef.current) return null;
      const id = generateUUID();
      const element = createWallElement(id, draft);
      applyCommand((document, commandId) => ({
        commandId,
        documentId: document.id,
        baseRevision: document.revision,
        type: "add-element",
        element,
      }));
      return id;
    },
    [activeDocumentRef, applyCommand],
  );

  const addDoor = useCallback(
    (draft: MapDoorDraft) => {
      if (!activeDocumentRef.current) return null;
      const id = generateUUID();
      const element = createDoorElement(id, draft);
      applyCommand((document, commandId) => ({
        commandId,
        documentId: document.id,
        baseRevision: document.revision,
        type: "add-element",
        element,
      }));
      return id;
    },
    [activeDocumentRef, applyCommand],
  );

  const removeElement = useCallback(
    (elementId: string) => {
      applyCommand((document, commandId) => ({
        commandId,
        documentId: document.id,
        baseRevision: document.revision,
        type: "remove-element",
        elementId,
      }));
    },
    [applyCommand],
  );

  const updateElement = useCallback(
    (elementId: string, update: MapElementUpdate) => {
      applyCommand((document, commandId) => ({
        commandId,
        documentId: document.id,
        baseRevision: document.revision,
        type: "update-element",
        elementId,
        update,
      }));
    },
    [applyCommand],
  );

  const updateDoor = useCallback(
    (elementId: string, update: { state: MapDoorState; width: number }) => {
      applyCommand((document, commandId) => ({
        commandId,
        documentId: document.id,
        baseRevision: document.revision,
        type: "update-door",
        elementId,
        state: update.state,
        width: update.width,
      }));
    },
    [applyCommand],
  );

  const undo = useCallback(() => {
    applyCommand((document, commandId) => ({
      commandId,
      documentId: document.id,
      baseRevision: document.revision,
      type: "undo",
    }));
  }, [applyCommand]);

  const redo = useCallback(() => {
    applyCommand((document, commandId) => ({
      commandId,
      documentId: document.id,
      baseRevision: document.revision,
      type: "redo",
    }));
  }, [applyCommand]);

  return {
    updateLayer,
    moveLayer,
    updateGrid,
    addTile,
    addTiles,
    addStamp,
    addStamps,
    paintTerrain,
    placeRoom,
    addShape,
    addWall,
    addDoor,
    removeElement,
    updateElement,
    updateDoor,
    undo,
    redo,
  };
}
