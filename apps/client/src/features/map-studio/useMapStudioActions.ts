import { useCallback, type MutableRefObject } from "react";
import type {
  MapDocument,
  MapElementUpdate,
  MapGridUpdate,
  MapLayerUpdate,
  MapStudioCommand,
} from "@herobyte/shared";
import { generateUUID } from "../../utils/uuid";
import {
  createDoorElement,
  createShapeElement,
  createTileElement,
  createWallElement,
} from "./elementBuilders";
import type { MapDoorDraft, MapShapeDraft, MapTileDraft, MapWallDraft } from "./types";

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
    addShape,
    addWall,
    addDoor,
    removeElement,
    updateElement,
    undo,
    redo,
  };
}
