import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import type { ClientMessage, MapDocument, MapStudioCommand } from "@herobyte/shared";
import { generateUUID } from "../../utils/uuid";
import { useConflictRefresh } from "./useConflictRefresh";
import type { MapStudioServerMessage } from "./types";
import {
  createMapOperation,
  mapOperationFailure,
  type RegisterCommandDelivery,
} from "./mapOperation";

type MessageBuilder = (document: MapDocument, commandId: string) => ClientMessage;
type Refusal = Extract<MapStudioServerMessage, { t: "map-studio-error" }>;
interface Entry {
  documentId: string;
  toMessage: MessageBuilder;
  operation: ReturnType<typeof createMapOperation>;
  commandId: string | null;
  message: ClientMessage | null;
  observed: boolean;
  sendAttempts: number;
  replayed: boolean;
}
interface Options {
  sendMessage: (message: ClientMessage) => void;
  activeDocumentRef: MutableRefObject<MapDocument | null>;
  setSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;
  registerCommandDelivery?: RegisterCommandDelivery;
}

export function useMapStudioQueue({
  sendMessage,
  activeDocumentRef,
  setSaving,
  setError,
  registerCommandDelivery,
}: Options) {
  const entries = useRef<Entry[]>([]);
  const alive = useRef(true);
  const lifetime = useRef(0);
  const observation = useRef<RegisterCommandDelivery | undefined>();
  const reportSaving = useCallback(() => {
    if (alive.current) setSaving(entries.current.length > 0);
  }, [setSaving]);

  const discard = useCallback((entry: Entry, reason: string) => {
    entry.operation.settle(
      mapOperationFailure(
        entry.message ? "completion-unavailable" : "cancelled-before-send",
        reason,
      ),
    );
  }, []);

  const {
    document: refreshDocument,
    begin: beginRefresh,
    clear: clearRefresh,
    fail: failRefresh,
  } = useConflictRefresh((documentId, reason) => {
    if (!alive.current) return;
    entries.current = entries.current.filter((entry) => {
      if (entry.message || entry.documentId !== documentId) return true;
      discard(entry, reason);
      return false;
    });
    setError(reason);
    dispatchNextCommand();
    reportSaving();
  });

  useEffect(() => {
    alive.current = true;
    const instance = ++lifetime.current;
    return () => {
      alive.current = false;
      // React's immediate effect replay revives this same owner before this runs.
      // Old callbacks are inert immediately; real disposal still settles every entry.
      queueMicrotask(() => {
        if (lifetime.current !== instance || alive.current) return;
        const retired = entries.current;
        entries.current = [];
        clearRefresh();
        retired.forEach((entry) =>
          discard(entry, "The map editor closed before completion could be confirmed."),
        );
      });
    };
  }, [discard, clearRefresh]);

  const deliveryHandler = useRef<
    (event: import("../../services/websocket/serviceTypes").CommandDeliveryEvent) => void
  >(() => {});
  useEffect(() => {
    observation.current = registerCommandDelivery;
    const unsubscribe = registerCommandDelivery?.((event) => deliveryHandler.current(event));
    return () => {
      observation.current = undefined;
      entries.current.forEach((entry) => {
        entry.observed = false;
      });
      unsubscribe?.();
    };
  }, [registerCommandDelivery]);

  const dispatchNextCommand = useCallback(() => {
    if (!alive.current) return;
    while (entries.current.length) {
      const entry = entries.current[0]!;
      if (entry.message) return;
      const document = activeDocumentRef.current;
      if (!document || document.id !== entry.documentId) {
        entries.current.shift();
        discard(entry, "The target document changed before this edit was sent.");
        continue;
      }
      if (refreshDocument.current === document.id) return;
      try {
        entry.commandId = generateUUID();
        const message = entry.toMessage(document, entry.commandId);
        // From this boundary the sender may buffer or send; a throw is not rollback.
        entry.message = message;
        setSaving(true);
        setError(null);
        sendMessage(message);
        return;
      } catch (error) {
        // A synchronous callback may already have settled and removed this entry.
        if (entries.current[0] !== entry) return;
        entries.current.shift();
        const reason = error instanceof Error ? error.message : "The edit could not be submitted.";
        discard(entry, reason);
        setError(reason);
      }
    }
    reportSaving();
  }, [activeDocumentRef, discard, reportSaving, sendMessage, setError, setSaving, refreshDocument]);

  const applyMessage = useCallback(
    (toMessage: MessageBuilder) => {
      const document = activeDocumentRef.current;
      const operation = createMapOperation(document?.id ?? null);
      if (!alive.current || !document) {
        operation.settle(
          mapOperationFailure(
            "cancelled-before-send",
            "No active map editor is available; this edit was not sent.",
          ),
        );
        return operation.handle;
      }
      entries.current.push({
        documentId: document.id,
        toMessage,
        operation,
        commandId: null,
        message: null,
        observed: Boolean(observation.current),
        sendAttempts: 0,
        replayed: false,
      });
      reportSaving();
      dispatchNextCommand();
      return operation.handle;
    },
    [activeDocumentRef, dispatchNextCommand, reportSaving],
  );

  const applyCommand = useCallback(
    (build: (document: MapDocument, id: string) => MapStudioCommand) => {
      return applyMessage((document, commandId) => ({
        t: "map-studio-command",
        command: build(document, commandId),
      }));
    },
    [applyMessage],
  );

  const activateDocument = useCallback(
    (documentId: string) => {
      if (!alive.current) return;
      entries.current = entries.current.filter((entry) => {
        if (entry.message || entry.documentId === documentId) return true;
        discard(entry, "The target document changed before this edit was sent.");
        return false;
      });
      if (refreshDocument.current !== documentId) clearRefresh();
      reportSaving();
    },
    [discard, reportSaving, clearRefresh, refreshDocument],
  );

  const handleDocumentReply = useCallback(
    (document: MapDocument, appliedCommandId?: string) => {
      if (!alive.current) return;
      const head = entries.current[0];
      if (head?.message && head.documentId === document.id && head.commandId === appliedCommandId) {
        entries.current.shift();
        head.operation.settle({ status: "succeeded" });
      }
      if (refreshDocument.current === document.id) clearRefresh();
      dispatchNextCommand();
      reportSaving();
    },
    [dispatchNextCommand, reportSaving, clearRefresh, refreshDocument],
  );

  const handleRefusal = useCallback(
    (message: Refusal) => {
      const head = entries.current[0];
      if (
        !alive.current ||
        !head?.message ||
        head.documentId !== message.documentId ||
        head.commandId !== message.commandId
      ) {
        return { matched: false, refresh: false, current: false };
      }
      entries.current.shift();
      // The positive code covers this invocation only; any previous/unknown resend
      // means an earlier invocation may already have applied. Generic errors are unknown.
      const definite =
        message.code === "command-not-applied" &&
        head.observed &&
        head.sendAttempts === 1 &&
        !head.replayed;
      head.operation.settle(
        mapOperationFailure(definite ? "rejected" : "completion-unavailable", message.reason),
      );
      const current = activeDocumentRef.current?.id === message.documentId;
      const refresh = current && message.code === "revision-conflict";
      if (refresh) beginRefresh(message.documentId);
      else dispatchNextCommand();
      reportSaving();
      return { matched: true, refresh, current };
    },
    [activeDocumentRef, dispatchNextCommand, reportSaving, beginRefresh],
  );

  const deleteDocument = useCallback(
    (documentId: string) => {
      if (!alive.current) return;
      entries.current = entries.current.filter((entry) => {
        if (entry.documentId !== documentId) return true;
        discard(
          entry,
          entry.message
            ? "The target map was deleted; completion of its edit cannot be confirmed."
            : "The target map was deleted before this edit was sent.",
        );
        return false;
      });
      if (refreshDocument.current === documentId) clearRefresh();
      dispatchNextCommand();
      reportSaving();
    },
    [discard, dispatchNextCommand, reportSaving, clearRefresh, refreshDocument],
  );

  const replayCommands = useCallback(() => {
    if (!alive.current) return;
    const head = entries.current[0];
    if (head?.message) {
      head.replayed = true;
      sendMessage(head.message);
    } else if (refreshDocument.current) {
      sendMessage({ t: "map-studio-get", documentId: refreshDocument.current });
    } else dispatchNextCommand();
  }, [dispatchNextCommand, sendMessage, refreshDocument]);

  // The transport calls before every socket attempt and before reporting a drop.
  deliveryHandler.current = (event) => {
    if (!alive.current) return;
    if (event.type === "tracking-lost") {
      entries.current.forEach((entry) => {
        entry.observed = false;
      });
      return;
    }
    // GET producers share a document ID, so a drop cannot identify our refresh.
    // Its independent deadline settles waiting edits if no usable document arrives.
    const head = entries.current[0];
    const identity =
      event.message.t === "map-studio-command"
        ? event.message.command
        : event.message.t === "map-studio-generate"
          ? event.message
          : null;
    if (
      !head?.message ||
      identity?.documentId !== head.documentId ||
      identity.commandId !== head.commandId
    )
      return;
    if (event.type === "send-attempt") {
      head.sendAttempts += 1;
      return;
    }
    entries.current.shift();
    discard(head, "No final result was received.");
    dispatchNextCommand();
    reportSaving();
  };
  const isActive = useCallback(() => alive.current, []);
  return {
    applyMessage,
    applyCommand,
    activateDocument,
    handleDocumentReply,
    handleRefusal,
    deleteDocument,
    replayCommands,
    isActive,
    failRefresh,
  };
}
