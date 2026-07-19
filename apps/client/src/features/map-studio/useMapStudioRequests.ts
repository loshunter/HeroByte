// The request side of the map-studio controller (split from useMapStudio for
// the 350-LOC cap): the list/get/create/delete/publish/import requests and the
// loading watchdog that releases them when a reply never lands. The parent
// hook owns the state and refs; this module only sends and arms the watchdog —
// replies are handled by the parent's handleServerMessage.

import { useCallback, useEffect, type MutableRefObject } from "react";
import type { ClientMessage, MapDocument, MapPublishBackgroundMode } from "@herobyte/shared";
import { generateUUID } from "../../utils/uuid";
import { uploadAssetFile, type AssetUploadCredentials } from "./uploads/assetUpload";

/**
 * How long a list/get/create/import request may leave the panel in `loading`
 * before we give up. These requests clear `loading` only when their reply lands,
 * so a dropped socket — or an oversized/invalid import the server silently drops
 * at its 1MB cap before any handler runs — would otherwise spin forever.
 */
const LOADING_TIMEOUT_MS = 12_000;

interface UseMapStudioRequestsOptions {
  sendMessage: (message: ClientMessage) => void;
  getAuthCredentials?: () => AssetUploadCredentials | null;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  requestedDocumentId: MutableRefObject<string | null>;
  activeDocumentRef: MutableRefObject<MapDocument | null>;
  /** True only while the CURRENT error is a stale loading-timeout the watchdog
   * raised — so a late reply clears that, but never a command error. */
  watchdogFired: MutableRefObject<boolean>;
}

export function useMapStudioRequests({
  sendMessage,
  getAuthCredentials,
  loading,
  setLoading,
  setError,
  requestedDocumentId,
  activeDocumentRef,
  watchdogFired,
}: UseMapStudioRequestsOptions) {
  // Every user-initiated request clears any stale error first — so retrying
  // after a watchdog timeout ("server didn't respond") doesn't leave that
  // message lingering under the freshly-loaded result.
  const refresh = useCallback(() => {
    setError(null);
    setLoading(true);
    sendMessage({ t: "map-studio-list" });
  }, [sendMessage, setError, setLoading]);

  const createDocument = useCallback(
    (name: string, width?: number, height?: number) => {
      const id = generateUUID();
      requestedDocumentId.current = id;
      setError(null);
      setLoading(true);
      sendMessage({ t: "map-studio-create", document: { id, name, width, height } });
      return id;
    },
    [sendMessage, setError, setLoading, requestedDocumentId],
  );

  const openDocument = useCallback(
    (documentId: string) => {
      requestedDocumentId.current = documentId;
      setError(null);
      setLoading(true);
      sendMessage({ t: "map-studio-get", documentId });
    },
    [sendMessage, setError, setLoading, requestedDocumentId],
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
    [sendMessage, activeDocumentRef],
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
      setError(null);
      setLoading(true);
      sendMessage({ t: "map-studio-import", document: { ...document, id } });
      return id;
    },
    [sendMessage, setError, setLoading, requestedDocumentId],
  );

  // Loading watchdog: if a request's reply never arrives (socket drop, or an
  // oversized/invalid import dropped at the server's 1MB cap before any handler
  // runs), release the panel and surface an error instead of spinning forever.
  // The cleanup cancels the timer the moment a reply flips `loading` back off.
  useEffect(() => {
    if (!loading) return;
    watchdogFired.current = false; // a fresh request supersedes any prior timeout
    const timer = setTimeout(() => {
      requestedDocumentId.current = null;
      watchdogFired.current = true;
      setLoading(false);
      setError("The map server didn't respond. Please try again.");
    }, LOADING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loading, setLoading, setError, requestedDocumentId, watchdogFired]);

  return {
    refresh,
    createDocument,
    openDocument,
    deleteDocument,
    publishDocument,
    uploadAsset,
    importDocument,
  };
}
