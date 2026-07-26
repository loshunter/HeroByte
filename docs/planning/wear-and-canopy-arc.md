# Wear & Canopy arc — taxonomy ranks 8 + 9

_Planned and executed 2026-07-26, straight after the Light & Colour II arc
completed (ad0d0af8) and the catalog was marked current (dad076c4). Source
of truth for what these techniques are: `czepeku-taxonomy-catalog.md` ranks
8–9. Rank 7 (floor decal & inlay system) is deliberately skipped for now —
it is the biggest remaining swing and deserves its own arc; 8+9 are the two
`new-painter` items that ride shipped machinery._

## Why this pairing

- **Rank 8 — groundDecal wear stamps.** Human activity written into the floor
  with zero objects: sparring rings, scorch craters, process stains. Cheap:
  deterministic fillRect art over the existing stamp/scatter/POPULATE
  machinery. Also the FIRST procedural prop art — today every bundled
  tile/stamp renders as a flat colour rect, so this opens the road the
  catalog's whole "prop kits (fillRect anatomies)" section wants to drive.
- **Rank 9 — foliage canopy painter.** Trees/bushes are the most visible gap
  in the corpus grammar and wholly absent from HeroByte. Their grounding
  prerequisite — the cool shadow pass — shipped in Light & Colour II P1, so
  a canopy family now casts a plum long-throw for free.

## Phase 1 — wear stamps (`decal:*` assets)

**Architecture decision:** wear marks are SCENERY STAMPS, not terrain-bake
features. They ride the existing element pipeline (privacy filtering via
deriveMapElements, undo, select/inspect, POPULATE) and render procedurally at
draw time; baking them into the terrain image would force a full re-bake per
stamp drag. MapElementsLayer sits between TerrainLayer and GridLayer — exactly
the floor-decal z-slot — so a painted stamp reads as ground damage.

- `features/render/wearStampDetail.ts` — NEW pure painter. Three kinds:
  `ring` (jittered ring of scuff dabs + red splatter arcs breaking the
  circumference), `scorch` (umber core, dab-chain radial streak spokes, pale
  displaced-earth rim lumps, translucent cool interior wash), `stain` (2–4
  irregular translucent blobs in a prop-declared colour). Deterministic from
  a seed hashed off the element id; geometry emits ONLY
  fillStyle/globalAlpha/fillRect so one painter drives Konva (live), an SVG
  recording shim (export), and the test recording context.
- `features/render/wearStampSvg.ts` — NEW: runs the painter against a
  rect-recording context and returns `<rect …/>` markup for the exporter.
- Asset data: `MapStudioTileAsset` gains `decal?: { kind; color? }` and a
  `"decals"` category. The objects/decals entries move to a NEW sibling
  `starterTileObjectAssets.ts` (starterTileAssets.ts is at 348/350).
  Assets: `decal:wear-ring` 3×3, `decal:scorch` 3×3, `decal:stain-dye` 2×2
  `#ad315d`, `decal:stain-ink` 2×2, `decal:stain-wax` 2×2. A stamp tint
  (inspector) overrides a stain's declared colour; ring/scorch ignore tint.
- Renderers: MapElementsLayer gets a decal branch (Konva `Shape` sceneFunc →
  painter); exportMapDocument gets a decal branch (SVG shim) before the
  flat-rect fallback. The drag ghost stays a flat rect.
- POPULATE: `PopulateCategory` + picker CATEGORIES + panel segment gain
  `"decals"` ("Wear") so a battle-worn room is one click.
- **Deferred:** the catalog's "automatic under-prop stain pass" — props carry
  no kind knowledge yet; revisit with the prop-kit arc.

## Phase 2 — canopy families (`terrain:canopy`, `terrain:canopy-blossom`)

A canopy is a terrain FAMILY riding the levels illusion above roofs
(priorities 40/41; roofs are 30–34), with the catalog's five cues:

1. **Two-scale scalloped edge** — organic edgeAmp ~1.3 plus a NEW per-family
   sub-lobe displacement octave (`canopy.sub`), gated so every existing
   family's field math is untouched (shadowTint.test's frozen FNV pin).
2. **Two flat tones split by a noisy diagonal boundary** — sun side vs shade
   side. Implemented with asymmetric depth probes: compare the edge distance
   sampled up-right vs down-left of the pixel; whichever side is nearer its
   edge faces the light. Noise jitters the boundary.
3. **Interior darkening toward the crown centre** — mix toward a `core` tone
   with BFS edge distance. Canopy families get their OWN combined body BFS
   (all canopy variants = one crown mass), merged into `depthOf` alongside —
   NEVER into — the water∪sunken body.
4. **Thin ink contour** — thin rimWidth with a dark rim colour.
5. **Tick texture + edge-biased highlights** — NEW `terrainCanopyDetail.ts`
   cell painter (leaf ticks everywhere, highlight clusters where edge
   distance ≤ 1.5), palette-routed like every other painter.

Long plum shadow throw + contact AO are pure data (shipped machinery).
`terrainPalette.ts` is at 348/350, so the architectural block (walls, roofs,
stairs, dais + their tuning consts) moves to a NEW sibling
`terrainPaletteStructures.ts`, spread into VILLAGE_TERRAIN — headroom for the
catalog's 25-family roster.

## Invariants that could silently break

- **Frozen FNV parity** (shadowTint.test 644308733): all field changes must
  be opt-in per family — no canopy knob ⇒ bit-identical bake.
- **Night grade completeness** (nightGrade.test): every new colour field
  (canopy shade/core/detail) must be walked by gradeFamily — the GrassDetail
  lesson. Decal/prop colours are deliberately UNgraded (props keep warmth at
  night, catalog rank 3).
- **Combined-BFS fusion**: computeBodyDepths merges every id it is given
  into ONE body. Canopy gets a separate call; water∪sunken keeps its own.
- **350-LOC structure guard** (`pnpm lint:structure`): starterTileAssets 348,
  terrainPalette 348, proceduralTerrainSurface 342, exportMapDocument 333,
  MapEditToolbar 331 are all near the cap — the two file splits above are
  part of the plan, and every touched file must stay ≤ 350.
- **SVG parity**: the frozen terrainRenderParity test pins existing exports;
  decal markup is a NEW branch keyed on `asset.decal`, unreachable for every
  existing document.
- **Populate determinism**: the 3-roll-per-cell RNG stream is order-stable;
  adding a category adds no rolls.

## Verification ritual (per phase)

Focused new tests → `pnpm test:client` → `pnpm typecheck` → `pnpm lint`
(includes frozen-test check) → `pnpm lint:structure` → live browser proof on
the dev rails (paint canopy / place decals, screenshot) → commit per phase.
