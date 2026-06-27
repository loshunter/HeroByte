import { useCallback, useRef, useState } from "react";
import type {
  ClientMessage,
  MapDocument,
  MapDocumentSummary,
  MapElementUpdate,
  MapGridUpdate,
  MapLayerUpdate,
  MapStudioCommand,
} from "@herobyte/shared";
import { generateUUID } from "../../utils/uuid";
import { upsertMapDocumentSummary } from "./documentSummaries";
import { createDoorElement, createShapeElement, createWallElement } from "./elementBuilders";
import type {
  MapDoorDraft,
  MapShapeDraft,
  MapStudioController,
  MapStudioServerMessage,
  MapWallDraft,
} from "./types";

type CommandBuilder = (document: MapDocument, commandId: string) => MapStudioCommand;
interface QueuedCommand {
  documentId: string;
  build: CommandBuilder;
}

export function useMapStudio(sendMessage: (message: ClientMessage) => void): MapStudioController {
  const [documents, setDocuments] = useState<MapDocumentSummary[]>([]);
  const [activeDocument, setActiveDocument] = useState<MapDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const requestedDocumentId = useRef<string | null>(null);
  const activeDocumentRef = useRef<MapDocument | null>(null);
  const commandQueue = useRef<QueuedCommand[]>([]);
  const inFlightCommandId = useRef<string | null>(null);
  activeDocumentRef.current = activeDocument;

  const refresh = useCallback(() => {
    setLoading(true);
    sendMessage({ t: "map-studio-list" });
  }, [sendMessage]);

  const createDocument = useCallback(
    (name: string, width?: number, height?: number) => {
      const id = generateUUID();
      requestedDocumentId.current = id;
      setLoading(true);
      sendMessage({
        t: "map-studio-create",
        document: { id, name, width, height },
      });
      return id;
    },
    [sendMessage],
  );

  const openDocument = useCallback(
    (documentId: string) => {
      requestedDocumentId.current = documentId;
      setLoading(true);
      sendMessage({ t: "map-studio-get", documentId });
    },
    [sendMessage],
  );

  const deleteDocument = useCallback(
    (documentId: string) => {
      sendMessage({ t: "map-studio-delete", documentId });
    },
    [sendMessage],
  );

  const dispatchNextCommand = useCallback(
    (document: MapDocument | null = activeDocumentRef.current) => {
      if (inFlightCommandId.current) return;
      const queued = commandQueue.current[0];
      if (!queued) {
        setSaving(false);
        return;
      }
      if (!document || queued.documentId !== document.id) {
        commandQueue.current = [];
        setSaving(false);
        return;
      }

      const commandId = generateUUID();
      inFlightCommandId.current = commandId;
      setSaving(true);
      setError(null);
      sendMessage({
        t: "map-studio-command",
        command: queued.build(document, commandId),
      });
    },
    [sendMessage],
  );

  const applyCommand = useCallback(
    (build: CommandBuilder) => {
      const document = activeDocumentRef.current;
      if (!document) return;
      commandQueue.current.push({ documentId: document.id, build });
      setSaving(true);
      dispatchNextCommand(document);
    },
    [dispatchNextCommand],
  );

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
    [applyCommand],
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
    [applyCommand],
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
    [applyCommand],
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

  const handleServerMessage = useCallback(
    (message: MapStudioServerMessage) => {
      if (message.t === "map-studio-documents") {
        setDocuments(message.documents);
        setLoading(false);
        return;
      }

      if (message.t === "map-studio-deleted") {
        setDocuments((current) => current.filter((document) => document.id !== message.documentId));
        setActiveDocument((current) => (current?.id === message.documentId ? null : current));
        if (activeDocumentRef.current?.id === message.documentId) activeDocumentRef.current = null;
        commandQueue.current = [];
        inFlightCommandId.current = null;
        setSaving(false);
        setHistory({ canUndo: false, canRedo: false });
        return;
      }

      if (message.t === "map-studio-error") {
        if (message.commandId !== inFlightCommandId.current) return;
        commandQueue.current.shift();
        inFlightCommandId.current = null;
        setError(message.reason);
        if (message.code === "revision-conflict") {
          requestedDocumentId.current = message.documentId;
          sendMessage({ t: "map-studio-get", documentId: message.documentId });
        } else {
          dispatchNextCommand();
        }
        return;
      }

      const { document } = message;
      setDocuments((current) => upsertMapDocumentSummary(current, document));
      const shouldActivate =
        requestedDocumentId.current === document.id ||
        activeDocumentRef.current?.id === document.id ||
        activeDocumentRef.current === null;
      if (shouldActivate) {
        activeDocumentRef.current = document;
        setActiveDocument(document);
        if (message.history) setHistory(message.history);
      }
      if (requestedDocumentId.current === document.id) {
        requestedDocumentId.current = null;
        setLoading(false);
      }
      if (message.appliedCommandId === inFlightCommandId.current) {
        commandQueue.current.shift();
        inFlightCommandId.current = null;
      }
      if (!inFlightCommandId.current && commandQueue.current.length) {
        dispatchNextCommand(document);
      } else if (!inFlightCommandId.current) {
        setSaving(false);
      }
    },
    [dispatchNextCommand, sendMessage],
  );

  return {
    documents,
    activeDocument,
    loading,
    saving,
    error,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    refresh,
    createDocument,
    openDocument,
    deleteDocument,
    updateLayer,
    moveLayer,
    updateGrid,
    addShape,
    addWall,
    addDoor,
    removeElement,
    updateElement,
    undo,
    redo,
    handleServerMessage,
  };
}
