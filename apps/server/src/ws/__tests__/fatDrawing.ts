/**
 * One freehand drawing heavy enough to put a room's export past the mint
 * ceiling BY ITSELF (~0.9 MB on the wire at 40,000 points): a table's
 * drawings ride the session file verbatim, so this makes a room heavy for a
 * reason no document COUNT can see. Every byte-ceiling test uses it, so the
 * count cap's tests — which never call it — stay green when the byte check is
 * sabotaged, and each site is pinned on its own.
 */
export function fatDrawing(points = 40_000) {
  return {
    id: "fat-drawing",
    type: "freehand",
    points: Array.from({ length: points }, (_, i) => ({ x: i, y: i })),
    color: "#ffffff",
    width: 2,
    opacity: 1,
  };
}
