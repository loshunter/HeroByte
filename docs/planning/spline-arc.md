# Spline arc — persistent curves: ribbons, filigree, sag lines

_2026-07-27. Pays down the catalog's largest recorded deferral pile: rank 11's
persistent splines + sag arcs, rank 7's path ribbons + filigree causeways, and
the log-rib bridge-dressing IOU from the island benchmark arc. First arc since
the live-toolbar rebuild to grow the WIRE schema (a new element type), so the
schema slice leads and everything else rides it._

## What the arc owes (from the catalog + status notes)

- **Rank 11 (repeat-along-line)**: the shipped Row tool emits plain stamps
  along a straight gesture and forgets the line. Owed: a PERSISTENT spline
  element — editable anchors, curved runs — and sag-arc rendering between
  fixed points (chains, ropes, drying lines) with post dots at anchors.
- **Rank 7 (floor decals)**: authored path ribbons — 0.8–1t pale inlay
  ribbons sweeping plaza-scale arcs with perpendicular cross-tick stones —
  and the gold filigree causeway inlay.
- **Log-rib bridge dressing**: rope side-lines with sag + X-lashings (the
  plank-striped water shadow stays with the bridge family, not this arc).

## Wire design (S1)

New element type `spline` (the union's first growth since the toolbar arc):

```ts
interface MapSplineElementData {
  points: { x: number; y: number }[]; // document px, 2..64 anchors
  kind: "ribbon" | "filigree" | "rope" | "chain";
  tint?: string; // optional hue override, like stamps
}
```

- `ribbon`/`filigree` interpolate a smooth Catmull-Rom through the anchors —
  sweeping arcs from few clicks. `rope`/`chain` treat each segment as a
  hanging span: parabolic sag scaled to span length, post dots at anchors.
- Validated `.strict()` server-side like every element; sanitized in shared;
  passes the privacy filter to players (set dressing, never blocks/vision).
- Width is per-kind bundled data (like decal art), NOT wire — one fewer knob
  to validate, and the corpus widths are constants anyway (ribbon ~0.9t,
  filigree ~0.15t, rope/chain ~0.08t).

## Painters (S2) — one module, fillRect-only, deterministic

`splineDetail.ts` (render): arc-length stepping over the sampled curve.
- **ribbon**: pale stone band with edge-dark contour dashes + perpendicular
  cross-tick stones every ~0.5t, tone jitter per tick (rank 7's grammar).
- **filigree**: thin gold double-line with bead dots at inflection steps.
- **rope**: 2–3 px line following the sagged path, X-lashing tick pairs at
  anchors, post dots.
- **chain**: rope with link dashes (alternating gap) and heavier posts.

Same contract as the wear stamps (`fillStyle`/`globalAlpha`/`fillRect`), so
Konva, SVG export, the headless harness and tests share one implementation.

## Integration (S3) + authoring (S4)

- S3: snapshot mapping (scenePublish), MapElementsLayer, SVG export, the
  benchmark harness; benchmark gets a filigree on the causeway, a ribbon
  sweep on the main sand path, and a rope line on the SE island dock edge.
- S4: map-edit sub-tool `spline`: click anchors, Enter/double-click commits
  one element via add-elements; kind swatches beside the tool; select tool
  hit-tests the polyline for delete/inspect.

## Slices

S1 shared+server schema+tests → S2 painters+tests → S3 render integration +
benchmark re-render → S4 authoring tool → ritual + per-slice commits. The
new-element-type integration checklist (every switch that must grow, every
site that silently drops unknown types) comes from recon before S1 lands.
