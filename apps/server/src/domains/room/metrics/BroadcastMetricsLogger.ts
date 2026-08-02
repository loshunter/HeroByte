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
 *
 * OFF by default (HEROBYTE_BROADCAST_METRICS=true enables): unconditionally
 * it emitted one JSON line per broadcast — dozens per minute at a busy
 * table — which buried real errors and warnings in the production logs.
 * Read per call, not at construction, so tests (and a live operator) can
 * toggle it without rebuilding the logger.
 */
export class BroadcastMetricsLogger {
  log(payload: BroadcastMetricsPayload): void {
    const setting = process.env.HEROBYTE_BROADCAST_METRICS?.trim().toLowerCase();
    if (setting !== "true" && setting !== "1") {
      return;
    }

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
