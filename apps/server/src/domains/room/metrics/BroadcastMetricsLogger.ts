// ============================================================================
// BROADCAST METRICS LOGGER
// ============================================================================
// Emits structured logs for room broadcast activity.

/**
 * Telemetry payload describing a broadcast operation.
 */
export interface BroadcastMetricsPayload {
  clientCount: number;
  snapshotBytes: number;
  durationMs: number;
  reason?: string;
}

/**
 * Logs broadcast telemetry in a structured JSON format so external
 * observability tooling (Datadog, Loki, etc.) can parse it consistently.
 */
export class BroadcastMetricsLogger {
  log(payload: BroadcastMetricsPayload): void {
    const safePayload = {
      event: "room-broadcast",
      timestamp: new Date().toISOString(),
      clientCount: payload.clientCount,
      snapshotBytes: payload.snapshotBytes,
      durationMs: Number(payload.durationMs.toFixed(2)),
      reason: payload.reason ?? "unspecified",
    };

    console.log(JSON.stringify(safePayload));
  }
}
