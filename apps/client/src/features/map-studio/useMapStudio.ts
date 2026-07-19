import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ClientMessage,
  MapDocument,
  MapDocumentSummary,
  MapStudioCommand,
} from "@herobyte/shared";
import { generateUUID } from "../../utils/uuid";
import { upsertMapDocumentSummary } from "./documentSummaries";
import type { MapStudioController, MapStudioServerMessage } from "./types";
import type { AssetUploadCredentials } from "./uploads/assetUpload";
import { useMapStudioActions } from "./useMapStudioActions";
import { useMapStudioRequests } from "./useMapStudioRequests";

type CommandBuilder = (document: MapDocument, commandId: string) => MapStudioCommand;
/**
 * Builds the whole wire message. Most actions send a `map-studio-command` and go
 * through `applyCommand`, which wraps their command for them; a few (generate)
 * are their own message type but MUST still ride this queue — it is the only
 * thing that owns commandId minting, error surfacing, revision-conflict
 * refetch, and dedupe-safe reconnect re-sends.
 */
type MessageBuilder = (document: MapDocument, commandId: string) => ClientMessage;
interface QueuedCommand {
  documentId: string;
  toMessage: MessageBuilder;
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
  // A document id the server reported as gone ("not-found" on open) — e.g.
  // the maps store reset under a room that kept its live binding. Glue code
  // uses it to stop re-fetching the dangling id and offer a fresh start.
  const [missingDocumentId, setMissingDocumentId] = useState<string | null>(null);
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const requestedDocumentId = useRef<string | null>(null);
  const activeDocumentRef = useRef<MapDocument | null>(null);
  const commandQueue = useRef<QueuedCommand[]>([]);
  const inFlightCommandId = useRef<string | null>(null);
  // The exact message last dispatched, kept for reconnect re-sends. The server
  // dedupes by commandId, so re-sending the identical message is safe whether
  // the original was applied (ack lost) or never arrived.
  const inFlightMessage = useRef<ClientMessage | null>(null);
  // True only while the CURRENT error is a stale loading-timeout the watchdog
  // raised — so a late reply clears that, but never a command/revision-conflict
  // error the user still needs to see.
  const watchdogFired = useRef(false);
  activeDocumentRef.current = activeDocument;

  // The list/get/create/delete/publish/import requests and their loading
  // watchdog (split module, 350-LOC cap). Replies land in handleServerMessage.
  const {
    refresh,
    createDocument,
    openDocument,
    deleteDocument,
    publishDocument,
    uploadAsset,
    importDocument,
  } = useMapStudioRequests({
    sendMessage,
    getAuthCredentials,
    loading,
    setLoading,
    setError,
    requestedDocumentId,
    activeDocumentRef,
    watchdogFired,
  });

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
      const message = queued.toMessage(document, commandId);
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

  /** Queue any map-studio message that the server acks by commandId. */
  const applyMessage = useCallback(
    (toMessage: MessageBuilder) => {
      const document = activeDocumentRef.current;
      if (!document) return;
      commandQueue.current.push({ documentId: document.id, toMessage });
      setSaving(true);
      dispatchNextCommand(document);
    },
    [dispatchNextCommand],
  );

  const applyCommand = useCallback(
    (build: CommandBuilder) => {
      applyMessage((document, commandId) => ({
        t: "map-studio-command",
        command: build(document, commandId),
      }));
    },
    [applyMessage],
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
    placeRoom,
    addShape,
    addWall,
    addDoor,
    addLight,
    removeElement,
    updateElement,
    updateDoor,
    generate,
    undo,
    redo,
  } = useMapStudioActions({ activeDocumentRef, applyCommand, applyMessage });

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
        // A "not-found" for the document we are OPENING is a reply to the
        // get, not to a queued command: release the load and remember the
        // dangling id so the open isn't auto-retried forever (the
        // stuck-STARTING loop after a server-side maps-store reset).
        if (message.code === "not-found" && requestedDocumentId.current === message.documentId) {
          requestedDocumentId.current = null;
          watchdogFired.current = false;
          setMissingDocumentId(message.documentId);
          setLoading(false);
          setError(message.reason);
          return;
        }
        if (message.commandId !== inFlightCommandId.current) return;
        commandQueue.current.shift();
        inFlightCommandId.current = null;
        inFlightMessage.current = null;
        // A real server response arrived, so any prior timeout is moot — don't
        // let a stale watchdog flag later clear THIS command/conflict error.
        watchdogFired.current = false;
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
      // A document that arrives is by definition not missing any more.
      setMissingDocumentId((current) => (current === document.id ? null : current));
      setDocuments((current) => upsertMapDocumentSummary(current, document));
      const shouldActivate =
        requestedDocumentId.current === document.id ||
        activeDocumentRef.current?.id === document.id ||
        activeDocumentRef.current === null;
      if (shouldActivate) {
        activeDocumentRef.current = document;
        setActiveDocument(document);
        // Clear ONLY a stale watchdog timeout error (a slow reply that timed out
        // then landed) — never a command/revision-conflict error the user must
        // still see. The conflict re-fetch path leaves watchdogFired false.
        if (watchdogFired.current) {
          watchdogFired.current = false;
          setError(null);
        }
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
    missingDocumentId,
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
    placeRoom,
    addShape,
    addWall,
    addDoor,
    addLight,
    removeElement,
    updateElement,
    updateDoor,
    generate,
    undo,
    redo,
    publishDocument,
    uploadAsset,
    importDocument,
    handleServerMessage,
  };
}
