export type { RegisterCommandDelivery } from "../../services/websocket/serviceTypes";

export type MapOperationOutcome =
  | { status: "succeeded" }
  | {
      status: "failed";
      kind: "rejected" | "cancelled-before-send" | "completion-unavailable";
      reason: string;
    };

export interface MapOperationHandle {
  readonly documentId: string | null;
  readonly completion: Promise<MapOperationOutcome>;
}

export function createMapOperation(documentId: string | null) {
  let resolve!: (outcome: MapOperationOutcome) => void;
  let settled = false;
  const completion = new Promise<MapOperationOutcome>((finish) => {
    resolve = finish;
  });
  const handle: MapOperationHandle = Object.freeze({ documentId, completion });
  return {
    handle,
    settle(outcome: MapOperationOutcome) {
      if (settled) return;
      settled = true;
      resolve(outcome);
    },
  };
}

export function mapOperationFailure(
  kind: Extract<MapOperationOutcome, { status: "failed" }>["kind"],
  reason: string,
): MapOperationOutcome {
  return { status: "failed", kind, reason };
}
