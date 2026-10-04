import { useCallback, useEffect, useReducer, useRef } from "react";
import type { MapOperationOutcome } from "../map-studio/mapOperation";
import type { GenerateInput, MapStudioController } from "../map-studio/types";

interface Attempt {
  signature: string;
  outcome: MapOperationOutcome | null;
  inspected: boolean;
  refresh?: { status: "pending" | "received" | "failed"; reason?: string };
}

export interface GenerateFeedback {
  status: "idle" | "pending" | "succeeded" | "failed";
  recovery: null | {
    refreshing: boolean;
    canAcknowledge: boolean;
    refresh: () => void;
    acknowledge: () => void;
  };
}

/** Request state belongs to its document and handle, never the queue's busy flag. */
export function useGenerateOutcome(controller: MapStudioController) {
  const attempts = useRef(new Map<string, Attempt>());
  const built = useRef(new Map<string, string>());
  const alive = useRef(true);
  const [, render] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const document = controller.activeDocument;
  const documentId = document?.id;
  const currentDocumentId = useRef(documentId);
  currentDocumentId.current = documentId;
  useEffect(() => {
    for (const [id, previous] of attempts.current) {
      if (id !== documentId) previous.refresh = undefined;
    }
  }, [documentId]);
  const attempt = documentId ? attempts.current.get(documentId) : undefined;
  const uncertain =
    attempt?.outcome?.status === "failed" &&
    attempt.outcome.kind === "completion-unavailable" &&
    !attempt.inspected;
  const pending = Boolean(attempt && !attempt.outcome);
  const canAcknowledge = Boolean(uncertain && attempt?.refresh?.status === "received");

  const submit = useCallback(
    (signature: string, input: GenerateInput) => {
      const id = controller.activeDocument?.id;
      if (!id || !alive.current) return;
      const previous = attempts.current.get(id);
      if (
        previous &&
        (!previous.outcome ||
          (previous.outcome.status === "failed" &&
            previous.outcome.kind === "completion-unavailable" &&
            !previous.inspected))
      )
        return;
      // Install the guard synchronously, before calling through to a possible immediate reply.
      const next: Attempt = { signature, outcome: null, inspected: false };
      attempts.current.set(id, next);
      render();
      const request = controller.generate(input);
      void request.completion.then((outcome) => {
        if (!alive.current || attempts.current.get(id) !== next) return;
        next.outcome = outcome;
        if (outcome.status === "succeeded") built.current.set(id, signature);
        render();
      });
    },
    [controller],
  );

  const refresh = () => {
    if (
      !alive.current ||
      currentDocumentId.current !== documentId ||
      !uncertain ||
      !attempt ||
      !document ||
      attempt.refresh?.status === "pending"
    )
      return;
    const receipt: NonNullable<Attempt["refresh"]> = { status: "pending" };
    attempt.refresh = receipt;
    render();
    controller.openDocument(document.id, (outcome) => {
      if (
        !alive.current ||
        attempts.current.get(document.id) !== attempt ||
        attempt.refresh !== receipt
      )
        return;
      receipt.status = outcome.status;
      if (outcome.status === "failed") receipt.reason = outcome.reason;
      render();
    });
  };
  const acknowledge = () => {
    if (
      !alive.current ||
      currentDocumentId.current !== documentId ||
      !uncertain ||
      !attempt ||
      attempt.refresh?.status !== "received"
    )
      return;
    // This only acknowledges the user's inspection. It never sends a new generation.
    attempt.inspected = true;
    render();
  };
  let reason: string | null = null;
  if (pending) reason = "Generating… waiting for the server to confirm this request.";
  else if (attempt?.outcome?.status === "failed") {
    reason = uncertain
      ? `Completion unconfirmed. ${attempt.outcome.reason} Refresh this map and inspect the result before generating again.`
      : attempt.outcome.kind === "completion-unavailable"
        ? "Completion remains unconfirmed. Map inspected; generate again only if another dungeon is intended."
        : `Failed. ${attempt.outcome.reason}`;
    if (uncertain && attempt.refresh?.status === "failed") reason += ` ${attempt.refresh.reason}`;
  }
  return {
    submit,
    pending,
    uncertain,
    reason,
    alreadyBuilt: (signature: string | null) =>
      Boolean(documentId && signature && built.current.get(documentId) === signature),
    feedback: {
      status: pending ? "pending" : (attempt?.outcome?.status ?? "idle"),
      recovery: uncertain
        ? {
            refreshing: attempt?.refresh?.status === "pending",
            canAcknowledge,
            refresh,
            acknowledge,
          }
        : null,
    } satisfies GenerateFeedback,
  };
}
