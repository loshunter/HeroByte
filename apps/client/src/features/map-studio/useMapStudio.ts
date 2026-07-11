import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ClientMessage,
  MapDocument,
  MapDocumentSummary,
  MapPublishBackgroundMode,
  MapStudioCommand,
} from "@herobyte/shared";
import { generateUUID } from "../../utils/uuid";
import { upsertMapDocumentSummary } from "./documentSummaries";
import type { MapStudioController, MapStudioServerMessage } from "./types";
import { uploadAssetFile, type AssetUploadCredentials } from "./uploads/assetUpload";
import { useMapStudioActions } from "./useMapStudioActions";

type CommandBuilder = (document: MapDocument, commandId: string) => MapStudioCommand;
interface QueuedCommand {
  documentId: string;
  build: CommandBuilder;
}

export function useMapStudio(
  sendMessage: (message: ClientMessage) => void,
  getAuthCredentials?: () => AssetUploadCredentials | null,
  isConnected?: boolean,
): MapStudioController {
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
  // The exact message last dispatched, kept for reconnect re-sends. The server
  // dedupes by commandId, so re-sending the identical message is safe whether
  // the original was applied (ack lost) or never arrived.
  const inFlightMessage = useRef<ClientMessage | null>(null);
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

  const publishDocument = useCallback(
    (background: string, documentId?: string, backgroundMode?: MapPublishBackgroundMode) => {
      const document = activeDocumentRef.current;
      if (!document) return false;
      if (documentId && document.id !== documentId) return false;
      sendMessage({
        t: "map-studio-publish",
        documentId: document.id,
        background,
        // Omitted (not undefined) for legacy-shaped messages on the wire.
        ...(backgroundMode ? { backgroundMode } : {}),
      });
      return true;
    },
    [sendMessage],
  );

  const uploadAsset = useCallback(
    (file: File) => uploadAssetFile(file, getAuthCredentials?.() ?? null),
    [getAuthCredentials],
  );

  const importDocument = useCallback(
    (document: MapDocument) => {
      // A fresh id lets the same backup restore repeatedly without colliding.
      const id = generateUUID();
      requestedDocumentId.current = id;
      setLoading(true);
      sendMessage({ t: "map-studio-import", document: { ...document, id } });
      return id;
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
      const message: ClientMessage = {
        t: "map-studio-command",
        command: queued.build(document, commandId),
      };
      inFlightMessage.current = message;
      sendMessage(message);
    },
    [sendMessage],
  );

  // Reconnect recovery: a socket drop can eat the reply to the in-flight
  // command, which would otherwise wedge the queue forever (nothing else
  // clears inFlightCommandId). On the false->true transition, re-send the
  // identical message — the server's commandId dedupe cache makes that safe —
  // or kick the queue if nothing was in flight.
  const wasConnected = useRef(isConnected);
  useEffect(() => {
    const cameBackUp = isConnected === true && wasConnected.current === false;
    wasConnected.current = isConnected;
    if (!cameBackUp) return;
    if (inFlightMessage.current) {
      sendMessage(inFlightMessage.current);
    } else if (commandQueue.current.length > 0) {
      dispatchNextCommand();
    }
  }, [isConnected, sendMessage, dispatchNextCommand]);

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

  const {
    updateLayer,
    moveLayer,
    updateGrid,
    addTile,
    addTiles,
    addStamp,
    addStamps,
    paintTerrain,
    addShape,
    addWall,
    addDoor,
    removeElement,
    updateElement,
    updateDoor,
    undo,
    redo,
  } = useMapStudioActions({ activeDocumentRef, applyCommand });

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
        inFlightMessage.current = null;
        setSaving(false);
        setHistory({ canUndo: false, canRedo: false });
        return;
      }

      if (message.t === "map-studio-error") {
        if (message.commandId !== inFlightCommandId.current) return;
        commandQueue.current.shift();
        inFlightCommandId.current = null;
        inFlightMessage.current = null;
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
        inFlightMessage.current = null;
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
    addTile,
    addTiles,
    addStamp,
    addStamps,
    paintTerrain,
    addShape,
    addWall,
    addDoor,
    removeElement,
    updateElement,
    updateDoor,
    undo,
    redo,
    publishDocument,
    uploadAsset,
    importDocument,
    handleServerMessage,
  };
}
