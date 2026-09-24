import { useCallback, useRef, type MutableRefObject } from "react";
import type { ClientMessage, MapDocument, MapStudioCommand } from "@herobyte/shared";
import { generateUUID } from "../../utils/uuid";

type CommandBuilder = (document: MapDocument, commandId: string) => MapStudioCommand;
/** Builds a whole wire message; Generate must ride the same command queue. */
type MessageBuilder = (document: MapDocument, commandId: string) => ClientMessage;
interface QueuedCommand {
  documentId: string;
  toMessage: MessageBuilder;
}

interface UseMapStudioQueueOptions {
  sendMessage: (message: ClientMessage) => void;
  activeDocumentRef: MutableRefObject<MapDocument | null>;
  setSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;
}

/** Queue mechanics only; document activation, loading, and refusal policy stay in the controller. */
export function useMapStudioQueue({
  sendMessage,
  activeDocumentRef,
  setSaving,
  setError,
}: UseMapStudioQueueOptions) {
  const commandQueue = useRef<QueuedCommand[]>([]);
  const inFlightCommandId = useRef<string | null>(null);
  // The exact message last dispatched, kept for reconnect re-sends. The server
  // dedupes by commandId, so re-sending the identical message is safe whether
  // the original was applied (ack lost) or never arrived.
  const inFlightMessage = useRef<ClientMessage | null>(null);

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
    [activeDocumentRef, sendMessage, setError, setSaving],
  );

  /** Queue any map-studio message that the server acks by commandId. */
  const applyMessage = useCallback(
    (toMessage: MessageBuilder) => {
      const document = activeDocumentRef.current;
      if (!document) return;
      commandQueue.current.push({ documentId: document.id, toMessage });
      setSaving(true);
      dispatchNextCommand(document);
    },
    [activeDocumentRef, dispatchNextCommand, setSaving],
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

  // Removal does not choose continuation: errors use the active document,
  // whereas document frames use their incoming document, even when it is not active.
  const removeMatchedCommand = useCallback((commandId: string | undefined): boolean => {
    if (commandId !== inFlightCommandId.current) return false;
    commandQueue.current.shift();
    inFlightCommandId.current = null;
    inFlightMessage.current = null;
    return true;
  }, []);

  const handleDocumentReply = useCallback(
    (document: MapDocument, appliedCommandId?: string) => {
      removeMatchedCommand(appliedCommandId);
      if (!inFlightCommandId.current && commandQueue.current.length) {
        dispatchNextCommand(document);
      } else if (!inFlightCommandId.current) {
        setSaving(false);
      }
    },
    [dispatchNextCommand, removeMatchedCommand, setSaving],
  );

  const resetCommands = useCallback(() => {
    commandQueue.current = [];
    inFlightCommandId.current = null;
    inFlightMessage.current = null;
    setSaving(false);
  }, [setSaving]);

  const replayCommands = useCallback(() => {
    if (inFlightMessage.current) {
      sendMessage(inFlightMessage.current);
    } else if (commandQueue.current.length > 0) {
      dispatchNextCommand();
    }
  }, [dispatchNextCommand, sendMessage]);

  return {
    applyMessage,
    applyCommand,
    dispatchNextCommand,
    removeMatchedCommand,
    handleDocumentReply,
    resetCommands,
    replayCommands,
  };
}
