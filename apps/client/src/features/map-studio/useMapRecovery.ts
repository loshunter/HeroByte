import { useCallback, useEffect, useRef } from "react";
import { generateUUID } from "../../utils/uuid";
import type { MapRecoveryCallback, MapRecoveryOutcome } from "./mapRecovery";
import type { MapStudioServerMessage } from "./types";

interface PendingRecovery {
  documentId: string;
  requestId: string;
  settle: MapRecoveryCallback;
  timer: ReturnType<typeof setTimeout>;
}

/** Independent of loading, edit acknowledgements and conflict-refresh ownership. */
export function useMapRecovery() {
  const pending = useRef<PendingRecovery | null>(null);
  const finish = useCallback((outcome: MapRecoveryOutcome) => {
    const request = pending.current;
    if (!request) return;
    pending.current = null;
    clearTimeout(request.timer);
    request.settle(outcome);
  }, []);
  const cancel = useCallback(
    () =>
      finish({
        status: "failed",
        reason: "The map refresh was superseded or closed. Refresh again to inspect it.",
      }),
    [finish],
  );
  const begin = useCallback(
    (documentId: string, settle: MapRecoveryCallback) => {
      cancel();
      const requestId = generateUUID();
      pending.current = {
        documentId,
        requestId,
        settle,
        timer: setTimeout(
          () =>
            finish({
              status: "failed",
              reason: "The requested map refresh did not arrive. Try Refresh map again.",
            }),
          12_000,
        ),
      };
      return requestId;
    },
    [cancel, finish],
  );
  const receive = useCallback(
    (message: MapStudioServerMessage) => {
      if (message.t !== "map-studio-document" && message.t !== "map-studio-error") return;
      const request = pending.current;
      const documentId =
        message.t === "map-studio-document" ? message.document.id : message.documentId;
      if (!request || request.requestId !== message.requestId || request.documentId !== documentId)
        return;
      finish(
        message.t === "map-studio-document"
          ? { status: "received" }
          : { status: "failed", reason: message.reason },
      );
    },
    [finish],
  );
  const activate = useCallback(
    (documentId: string) => {
      if (pending.current && pending.current.documentId !== documentId) cancel();
    },
    [cancel],
  );
  const discard = useCallback(
    (documentId: string) => {
      if (pending.current?.documentId === documentId) cancel();
    },
    [cancel],
  );
  useEffect(() => cancel, [cancel]);
  return { begin, cancel, receive, activate, discard };
}
