/**
 * Per-message traces: the router's "Routing message type" line, selections, the staging
 * zone's steps (the per-heartbeat line is gone). OFF by default; HEROBYTE_MESSAGE_LOG=true (or 1) turns them
 * on. Unconditionally they wrote a line for every routed message — every drag preview
 * and measure frame, every player's 25 s heartbeat (twice) — and buried the warnings
 * that matter in the production logs. Read per call, like BroadcastMetricsLogger, so a
 * test or a live operator can toggle it without a restart of anything but the env.
 */
export function messageTraceEnabled(): boolean {
  const setting = process.env.HEROBYTE_MESSAGE_LOG?.trim().toLowerCase();
  return setting === "true" || setting === "1";
}

export function traceMessage(...args: unknown[]): void {
  if (messageTraceEnabled()) console.log(...args);
}
