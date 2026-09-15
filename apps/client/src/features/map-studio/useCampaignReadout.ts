/**
 * The campaign's weight beside the map list — and how it stays fresh.
 *
 * Extracted from useMapStudio for the 350-LOC cap. The server says the weight
 * on the list reply (`exportBytes`) and on the frames that move it by a map's
 * worth at once (the live GENERATE tool's document frame); for the mints that
 * do not (a create, an import, a kick — a NEW id) and for a delete, the hook
 * re-lists SILENTLY: never clearing `loading` (the watchdog's only signal),
 * once per burst, bounded — a list this build never answers (no commandId, so
 * no nack) must not wedge the readout for the session — and only once a list
 * has ever arrived, so a bare command stream costs no extra message. On a
 * reconnect the readout is forgotten (another table's number is not this
 * one's) and asked for again.
 */
import { useCallback, useRef, useState } from "react";
import type { ClientMessage, ServerMessage } from "@herobyte/shared";

type DocumentsReply = Extract<ServerMessage, { t: "map-studio-documents" }>;
type DocumentFrame = Extract<ServerMessage, { t: "map-studio-document" }>;

/** A silent readout re-list is forgotten after this — a reply that never comes must not wedge the readout. */
const SILENT_LIST_TIMEOUT_MS = 10_000;

export function useCampaignReadout(sendMessage: (message: ClientMessage) => void) {
  const [exportBytes, setExportBytes] = useState<number | null>(null);
  // The ids the last list (or a frame since) told us about; null until a list has arrived.
  const knownIds = useRef<Set<string> | null>(null);
  const silentListPending = useRef(false);
  const silentListTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestSilentList = useCallback(() => {
    if (silentListPending.current) return;
    silentListPending.current = true;
    silentListTimer.current = setTimeout(() => {
      silentListPending.current = false;
    }, SILENT_LIST_TIMEOUT_MS);
    sendMessage({ t: "map-studio-list" });
  }, [sendMessage]);

  /** Any list reply: the ids, the weight, and the silent flag un-stuck. */
  const onListReply = useCallback((message: DocumentsReply) => {
    knownIds.current = new Set(message.documents.map((document) => document.id));
    setExportBytes(message.exportBytes ?? null);
    silentListPending.current = false;
    if (silentListTimer.current) clearTimeout(silentListTimer.current);
  }, []);

  /** A document frame: the weight when it carries one; a NEW id is a mint — re-list. */
  const onDocumentFrame = useCallback(
    (message: DocumentFrame) => {
      if (message.exportBytes !== undefined) setExportBytes(message.exportBytes);
      if (knownIds.current && !knownIds.current.has(message.document.id)) {
        knownIds.current.add(message.document.id);
        requestSilentList();
      }
    },
    [requestSilentList],
  );

  /** A delete moves the weight: re-list. */
  const onDeleted = useCallback(
    (documentId: string) => {
      if (!knownIds.current) return;
      knownIds.current.delete(documentId);
      requestSilentList();
    },
    [requestSilentList],
  );

  /** Forgotten, then asked for again — if a list had ever arrived. */
  const onReconnect = useCallback(() => {
    const hadList = knownIds.current !== null;
    knownIds.current = null;
    silentListPending.current = false;
    setExportBytes(null);
    if (hadList) requestSilentList();
  }, [requestSilentList]);

  return { exportBytes, onListReply, onDocumentFrame, onDeleted, onReconnect };
}
