import type { RegisterCommandDelivery } from "./mapOperation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, MapDocument, MapDocumentSummary } from "@herobyte/shared";
import { upsertMapDocumentSummary } from "./documentSummaries";
import type { MapBindRefusal, MapStudioController, MapStudioServerMessage } from "./types";
import type { AssetUploadCredentials } from "./uploads/assetUpload";
import { useMapStudioActions } from "./useMapStudioActions";
import { useMapStudioRequests } from "./useMapStudioRequests";
import { useCampaignReadout } from "./useCampaignReadout";
import { useMapStudioQueue } from "./useMapStudioQueue";

export function useMapStudio(
  sendMessage: (message: ClientMessage) => void,
  getAuthCredentials?: () => AssetUploadCredentials | null,
  isConnected?: boolean,
  registerCommandDelivery?: RegisterCommandDelivery,
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
  const [bindRefusal, setBindRefusal] = useState<MapBindRefusal | null>(null);
  const [listed, setListed] = useState(false);
  const bindRefusals = useRef(0);
  // The campaign's weight beside the map list, and its silent re-lists (useCampaignReadout).
  const readout = useCampaignReadout(sendMessage);
  // Mints this panel asked for (create, import) whose reply is still owed. A
  // refusal is matched HERE, not through the single requestedDocumentId slot,
  // which moves on with a second click or the watchdog — and dropped the refusal.
  const pendingMintIds = useRef<Set<string>>(new Set());
  const deletedDocumentIds = useRef(new Set<string>());
  // The panel's OWN list is tracked apart, so a silent reply never swallows its spinner.
  const explicitListPending = useRef(false);
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const requestedDocumentId = useRef<string | null>(null);
  const activeDocumentRef = useRef<MapDocument | null>(null);
  // True only while the CURRENT error is a stale loading-timeout the watchdog
  // raised — so a late reply clears that, but never a command/revision-conflict
  // error the user still needs to see.
  const watchdogFired = useRef(false);
  activeDocumentRef.current = activeDocument;

  // The list/get/create/delete/publish/import requests and their loading
  // watchdog (split module, 350-LOC cap). Replies land in handleServerMessage.
  const {
    handleRecoveryReply,
    activateRecoveryDocument,
    discardRecoveryDocument,
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
    pendingMintIds,
    explicitListPending,
  });

  const {
    applyMessage,
    applyCommand,
    activateDocument,
    handleRefusal,
    handleDocumentReply,
    deleteDocument: discardDocument,
    isActive,
    failRefresh,
    replayCommands,
  } = useMapStudioQueue({
    sendMessage,
    activeDocumentRef,
    setSaving,
    setError,
    registerCommandDelivery,
  });

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
    pendingMintIds.current.clear();
    readout.onReconnect();
    replayCommands();
  }, [isConnected, replayCommands, readout]);

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
    addSpline,
    removeElement,
    updateElement,
    updateDoor,
    generate,
    undo,
    redo,
  } = useMapStudioActions({ activeDocumentRef, applyCommand, applyMessage });

  const handleServerMessage = useCallback(
    (message: MapStudioServerMessage) => {
      if (!isActive()) return;
      if (message.t === "map-studio-documents") {
        setDocuments(message.documents);
        setListed(true);
        // A map the server once reported gone is back (a loaded game restored
        // it without a document frame): the list is the newer word.
        setMissingDocumentId((current) =>
          current && message.documents.some((document) => document.id === current) ? null : current,
        );
        readout.onListReply(message);
        // Only the panel's OWN list releases its spinner (a silent or
        // unsolicited reply never does).
        if (explicitListPending.current) {
          explicitListPending.current = false;
          setLoading(false);
        }
        return;
      }

      if (message.t === "map-studio-deleted") {
        discardRecoveryDocument(message.documentId);
        deletedDocumentIds.current.add(message.documentId);
        readout.onDeleted(message.documentId);
        setDocuments((current) => current.filter((document) => document.id !== message.documentId));
        setActiveDocument((current) => (current?.id === message.documentId ? null : current));
        if (activeDocumentRef.current?.id === message.documentId) {
          activeDocumentRef.current = null;
          setHistory({ canUndo: false, canRedo: false });
        }
        discardDocument(message.documentId);
        return;
      }

      if (message.t === "map-studio-error") {
        handleRecoveryReply(message);
        if (message.code === "not-found" && message.commandId === `get:${message.documentId}`) {
          failRefresh(message.documentId, message.reason);
        }
        // A "not-found" for the document we are OPENING is a reply to the
        // get, not to a queued command; a REFUSED create or import (an empty
        // commandId — those messages carry none, so the router never nacks
        // them) is the same shape. Either way: release the load and show the
        // reason, instead of spinning until the watchdog blames the server.
        // not-found also remembers the dangling id so the open isn't
        // auto-retried forever (the stuck-STARTING loop after a server-side
        // maps-store reset).
        const mintRefused =
          message.commandId === "" && pendingMintIds.current.delete(message.documentId);
        const openRefused =
          message.code === "not-found" && requestedDocumentId.current === message.documentId;
        if (mintRefused || openRefused) {
          // A real reply supersedes a prior timeout, whichever request it was for.
          watchdogFired.current = false;
          if (requestedDocumentId.current === message.documentId) {
            // The request the panel is waiting on: release it.
            requestedDocumentId.current = null;
            setLoading(false);
          }
          if (message.code === "not-found") setMissingDocumentId(message.documentId);
          setError(message.reason);
          return;
        }
        // A refused table binding (Use at table, or Build's bind after a
        // create) is no queued command, so handleRefusal never matches it and
        // it vanished — leaving the DM told the table was on its way.
        if (message.commandId.startsWith("set-live:")) {
          watchdogFired.current = false;
          setError(message.reason);
          bindRefusals.current += 1;
          setBindRefusal({
            documentId: message.documentId,
            reason: message.reason,
            seq: bindRefusals.current,
          });
          return;
        }
        const refusal = handleRefusal(message);
        if (!refusal.matched || !refusal.current) return;
        // A real server response arrived, so any prior timeout is moot — don't
        // let a stale watchdog flag later clear THIS command/conflict error.
        watchdogFired.current = false;
        setError(message.reason);
        if (refusal.refresh) {
          requestedDocumentId.current = message.documentId;
          sendMessage({ t: "map-studio-get", documentId: message.documentId });
        }
        return;
      }

      const { document } = message;
      if (deletedDocumentIds.current.has(document.id)) return;
      // A document that arrives is by definition not missing any more.
      setMissingDocumentId((current) => (current === document.id ? null : current));
      pendingMintIds.current.delete(document.id);
      setDocuments((current) => upsertMapDocumentSummary(current, document));
      readout.onDocumentFrame(message);
      const shouldActivate =
        requestedDocumentId.current === document.id ||
        activeDocumentRef.current?.id === document.id ||
        activeDocumentRef.current === null;
      if (shouldActivate) {
        activateRecoveryDocument(document.id);
        activeDocumentRef.current = document;
        activateDocument(document.id);
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
      handleDocumentReply(document, message.appliedCommandId);
      handleRecoveryReply(message);
    },
    [
      handleRecoveryReply,
      activateRecoveryDocument,
      discardRecoveryDocument,
      activateDocument,
      handleDocumentReply,
      readout,
      handleRefusal,
      failRefresh,
      discardDocument,
      isActive,
      sendMessage,
    ],
  );

  return {
    documents,
    activeDocument,
    loading,
    saving,
    error,
    missingDocumentId,
    bindRefusal,
    listed,
    exportBytes: readout.exportBytes,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    refresh,
    listQuietly: readout.requestSilentList,
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
    addSpline,
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
