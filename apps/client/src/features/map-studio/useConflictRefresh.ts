import { useCallback, useEffect, useRef } from "react";

/** A prerequisite GET deadline, not a timeout for an already-sent edit. */
export function useConflictRefresh(onFailure: (documentId: string, reason: string) => void) {
  const document = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failure = useRef(onFailure);
  failure.current = onFailure;
  const clear = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    document.current = null;
  }, []);
  const fail = useCallback(
    (documentId: string, reason: string) => {
      if (document.current !== documentId) return false;
      clear();
      failure.current(documentId, reason);
      return true;
    },
    [clear],
  );
  const begin = useCallback(
    (documentId: string) => {
      clear();
      document.current = documentId;
      timer.current = setTimeout(() => {
        fail(
          documentId,
          "The map refresh did not finish. Waiting edits were not sent; refresh the map before retrying.",
        );
      }, 12_000);
    },
    [clear, fail],
  );
  useEffect(() => clear, [clear]);
  return { document, begin, clear, fail };
}
