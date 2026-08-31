// ============================================================================
// SENTINEL LEAK CHECK — the raw-bytes bar, without the wall-clock time bomb
// ============================================================================
// The secrecy contracts assert that a secret number never SERIALIZES to the
// wrong socket, because a renderer-side filter passes parsed-object checks
// while the bytes still carry the value under some other key. The original
// instrument was `rawBytesSentTo(ws).not.toContain("9973")` — and every frame
// also carries `lastHeartbeat: Date.now()`, thirteen wall-clock digits that
// are guaranteed to eventually spell any four-digit sentinel. On
// 2026-08-31T02:58:19.738Z the epoch was 1788145099738 — substring "9973" —
// and CI run #828 went red on byte-identical code that run #827 had passed.
//
// This walk keeps the whole catch surface and drops the coincidence:
//   - a NUMBER leaf equal to the sentinel is a leak (renamed keys included);
//   - a STRING leaf containing the sentinel's digits is a leak (the
//     embedded-in-chat channel the substring check also covered);
//   - a number that merely CONTAINS the digits — a timestamp — is clean.
// An unparseable frame falls back to the raw substring check rather than
// silently passing.

interface SendRecorder {
  send: { mock: { calls: unknown[][] } };
}

/** Every place the sentinel survives inside one parsed value — empty means
 * no leak. For asserting on a snapshot/seed object directly. */
export function sentinelHitsIn(root: unknown, sentinel: number | string): string[] {
  const digits = String(sentinel);
  const hits: string[] = [];

  const walk = (value: unknown, path: string): void => {
    if (typeof value === "number") {
      if (String(value) === digits) hits.push(`${path} = ${value}`);
      return;
    }
    if (typeof value === "string") {
      if (value.includes(digits)) hits.push(`${path} contains "${digits}"`);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) => walk(entry, `${path}[${index}]`));
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, entry] of Object.entries(value)) {
        // The KEY itself is part of the bytes too — a field literally named
        // after the secret would be bizarre, but the bar is bytes, not taste.
        if (key.includes(digits)) hits.push(`${path}.${key} (key) contains "${digits}"`);
        walk(entry, `${path}.${key}`);
      }
      return;
    }
  };

  walk(root, "$");
  return hits;
}

/** Every place the sentinel survives in this socket's sent frames, as
 * human-readable paths — empty means no leak. */
export function sentinelHits(socket: SendRecorder, sentinel: number | string): string[] {
  const digits = String(sentinel);
  const hits: string[] = [];
  for (const call of socket.send.mock.calls) {
    const frame = String(call[0]);
    try {
      hits.push(...sentinelHitsIn(JSON.parse(frame), sentinel));
    } catch {
      if (frame.includes(digits)) hits.push(`unparseable frame contains "${digits}"`);
    }
  }
  return hits;
}
