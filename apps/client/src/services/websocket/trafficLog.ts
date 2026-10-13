// ============================================================================
// TRAFFIC LOG — per-message traces, off unless the build asks for them
// ============================================================================
// Every send wrote three console lines (WebSocketService.send, the queue's send,
// sendRaw) and every ack a fourth — at a drag's, a measure's or the voice meter's
// rate, in production too. VITE_DEBUG_TRAFFIC=true turns them back on, the way
// VITE_DEBUG_SELECTION does for useObjectSelection. Read per call so a test can
// stub it.

export function trafficLog(...args: unknown[]): void {
  const setting = import.meta.env.VITE_DEBUG_TRAFFIC;
  if (typeof setting === "string" && setting.toLowerCase() === "true") console.log(...args);
}
