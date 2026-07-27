# Catalog Closer arc — taxonomy ranks 10 + 11 + 12

_Planned and executed 2026-07-26, after the Floor Decals arc (32853711).
These are the last three ranked techniques in
`czepeku-taxonomy-catalog.md`; shipping them completes the catalog's whole
ranked list (1–12). All three are `field-feature` work over shipped
machinery — no new pipelines._

## Phase 1 — rank 10, scatter bias modes

Czepeku debris obeys physics: crates hug walls, corners collect double,
sparring rings need open floor. POPULATE's per-cell placement probability
gains a per-asset weight:

- `MapStudioTileAsset.scatterBias?: "wall" | "open"` — data beside the prop.
- `buildPopulateDrafts` classifies each region cell (corner / edge /
  interior from the region bounds — rooms are wall-ringed, so region edge ≈
  wall base) and multiplies the fill probability by the chosen asset's
  weight: wall-bias 2.0 / 1.5 / 0.35, open-bias 0.25 / 0.4 / 1.25,
  undefined 1 everywhere.
- **Stream parity invariant:** the 3-roll-per-cell RNG sequence is
  untouched; an unbiased asset's drafts are byte-identical to today
  (the existing populateRoom suite is the pin). Bias data: crate + lamp
  "wall", table + sparring ring + scorch "open"; stains stay uniform.
- **Deferred:** directional-cone and radial-emitter biases (need an anchor
  concept POPULATE's UI lacks) and host-prop surface constraint (needs prop
  kits). Recorded here so the catalog entry's annotation can say so.

## Phase 2 — rank 11, repeat-along-line rows

The catalog route asks for a new persistent spline element type. The
80%-value, zero-schema version: a **row placement GESTURE** — a new "row"
drag sub-tool that emits ordinary stamps along the dragged segment as ONE
add-elements command (one undo), exactly how scatter emits a cluster.
Elements stay plain stamps: selectable, privacy-filtered, renderable, no
wire change. The drag machine, the dashed segment preview, and the commit
plumbing all exist (wall/door use them).

- `buildRowDrafts(document, asset, start, end, layerId)` in
  placementDrafts: interval = footprint long side × per-asset `rowSpacing`
  (default 1 = butt-to-butt; the street lamp ships 3 — the dock-pile /
  lamp-post idiom), stamps centred on the path, rotated to the segment
  angle ± jitter, deterministic skips (~8%) from a seed hashed off the
  endpoints. Capped by the add-elements budget.
- Wiring: `MapEditSubTool` + DRAG_TOOLS + toolbar button gain "row"; the
  asset-picker section shows for row like place/scatter; commitDragTool
  gains the row branch (it already receives the controller; it gains
  `selectedAssetId`).
- **Deferred to a future spline arc:** persistent path elements, sag arcs,
  vertex posts, and rank 7's inlay ribbons / filigree causeways.

## Phase 3 — rank 12, paired-family interleave + micro-grunge

- **Interleave (echo islands):** per-family field knob
  `interleave?: { with: assetId }`. One shared low-frequency noise field,
  thresholded with a hysteresis band, decides ownership near the pair seam:
  inside the partner within ~2.4 cells of it, noise above the band EXTENDS
  this family's signed field (an island over the partner); inside itself,
  noise below the band CARVES it (the partner shows through — underfill
  paints it free). Strength fades with the member's own edge distance, so
  islands sit 1–2 cells beyond the seam and cores stay solid. Needs
  per-MEMBER own-body BFS — computeBodyDepths([oneId]) each, never the
  combined-body call. Ships as data on grass: `{ with: "terrain:dirt" }`.
- **Micro-grunge speckle:** `speckle?: { amp, chance }` — sparse 1px
  darker speckles at bake resolution over the mottle (mixRgb toward black),
  on the stone floors + dirt + path.
- **Registration refactor:** the surface's three depth registrations
  (water∪sunken combined, canopy crowns combined, interleave members
  per-id) move into `terrainDistanceField.computeFieldDepths(familyByCell,
  ids, palette)` — proceduralTerrainSurface is AT the 350 cap and this
  nets it negative lines. One depthOf slot per assetId: a family cannot be
  water-banded AND canopy AND interleave at once (documented there).

## Invariants

- **Frozen FNV parity** (shadowTint 644308733): its fixture builds LOCAL
  families — VILLAGE data changes can't touch it; the new field knobs are
  absent-gated, so knobless configs stay bit-identical.
- **Populate determinism + stream stability:** 3 rolls per cell, always,
  in order; bias only scales the comparison threshold.
- **The 0.5 field saturation ceiling:** the interleave amplitude must
  exceed it near the seam to actually flip ownership (islands/holes) —
  tuned as amp × falloff ≈ 1.4 max, well past ±0.5.
- **350-LOC caps:** proceduralTerrainSurface 350 (goes DOWN via the
  helper), useMapEditTool 331 (+2), MapEditToolbar 333 (+2),
  placementDrafts 113 (+~55), populateRoom 166 (+~35).
- Night grade: interleave/speckle/scatterBias/rowSpacing are structural
  knobs — the `...fam` spread passes them through untouched.

## Verification ritual (per phase)

Focused new tests → `pnpm test:client` → `pnpm typecheck` → `pnpm lint` →
`pnpm lint:structure` → live browser proof → commit per phase. Closing
commit annotates ranks 10–12 in the catalog: the ranked list is COMPLETE.
