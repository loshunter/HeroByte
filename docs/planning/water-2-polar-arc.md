# Next arc: Water II (shore grammar + sunken architecture) → Polar-course engine

_Handoff plan written 2026-07-18 at the end of the wall/water/lighting arcs.
The paste-prompt for a fresh session is at the bottom; everything above it is
the context that prompt references._

## Why this arc

The renderer now ships: procedural wall/roof/stairs bands with contact AO and
height-scaled shadow throws, value-noise mottle, depth-banded water over a BFS
shore-distance field, and the lighting system (ambient veil + torch pools).
The two highest confidence-to-impact items left in
`czepeku-taxonomy-catalog.md` are:

1. **Water II** (catalog ranks 4 + 5): the shore-grammar suite — foam lace,
   saturated shallows, caustics, deep-water dash flocks — plus the
   sunken-structure ghost layer. Nearly all of it rides the shipped BFS field
   and palette-as-data machinery: data + painter-variant work, spectacular on
   every lake/harbour/river map.
2. **Polar-course engine** (catalog rank 6): one parametric painter over a
   point-source distance field that yields round tower cones, domes, dais
   rings, spiral thatch and fan stairs as pure palette entries — the biggest
   *capability* unlock left (circular landmarks are currently impossible).

Ship Water II completely (tests, review, live visual proof, commit, push)
before starting the polar phase.

## Slice plan — Phase 1: Water II

Reference specs (sampled from the 26-map study; see the taxonomy catalog):

- **S1 — Foam lace collar.** In the water family's shallowest zone (BFS
  distance ≲ 0.8 cells, i.e. before the first depth band), replace the flat
  band colour with a cellular foam mask: near-white `#d9ebf3` web with rounded
  holes punched through to the shallow colour, hugging every land contact,
  dissolving outward into sparse 2–6 px spray speckles. Route: per-pixel in
  `colorAt` for water pixels — threshold the existing `valueNoise` at a cutoff
  driven by the bilinear shore distance (solid web → holes → speckle as
  distance grows). Keep the thin `rim` waterline as the innermost contact
  line. New palette knobs on `depthBands`' owner (e.g.
  `foam?: { color, reach }`), defaults off so non-water banded families (none
  today) are unaffected.
- **S2 — Sunlit shallow saturation.** The innermost depth band gains
  SATURATION, not just value (study: mint `#94f9e8` against `#1c7d61`).
  Data-only: retune `terrain:water`'s first band toward a brighter, more
  saturated turquoise now that foam sits on top of it.
- **S3 — Caustic web.** Ridge-thresholded value noise (|n−0.5| < ε) drawn as a
  pale web over water pixels, amplitude fading to zero past ~3 cells of shore
  distance. Per-pixel in the field pass next to the mottle term; one palette
  knob (`caustics?: { color, reach, strength }`).
- **S4 — Deep-water dash flocks.** 5–15 short parallel darker dashes sharing
  one diagonal orientation per ~6×6-cell region, only where distance > 3.
  This is a CELL painter, not per-pixel: add `paintWaterDetail` (fillRect-only,
  world-lattice deterministic, hash-picked per-region angle) routed from
  `paintFamilyDetail` for families with depth bands; clip machinery already
  keeps it inside the water.
- **S5 — Sunken-structure ghosting.** Architecture continuing beneath the
  waterline: recommended mechanism is *sunken sibling families as data* — a
  `sunken?: { of: assetId }` field on `TerrainFamilyPalette`; such a family
  renders the referenced family's painter output (base + detail), then the
  field pass pulls those pixels toward the water hue with strength keyed to
  its own BFS depth (shallow ≈ 40 % tint / contrast halved, deep ≈ whisper
  contrast), and skips detail past the deep band. Ship `terrain:sunken-stairs`
  and `terrain:sunken-flagstone` as the first two (paintable swatches under
  Floor), with olive algae `#6a7a34` ticks on cells within ~1 cell of land.
  If sibling-families prove awkward mid-implementation, the fallback design is
  a compositing flag on water itself — but keep whichever is chosen pinned by
  tests the way `underfill: false` is.
- **S6 — Verify + review + ship.** Full ritual (below), live visual proof
  (paint a harbour: lake + docks + sunken steps + boulder in the water), an
  adversarial review workflow over the diff, commit + push to dev.

## Slice plan — Phase 2: Polar-course engine

- **P1 — Point-source distance field.** In `buildProceduralFieldConfig`,
  for families flagged `polar`, compute each connected painted region's
  centroid + radius; expose `polarOf(assetId, cx, cy)` alongside `depthOf`
  (angle + normalized radial distance, bilinear-smoothed per pixel like
  `bilinearDepth`).
- **P2 — The painter/field hybrid.** Per-pixel: quantized radial distance
  selects a palette row (course bands); tangential joint ticks at a pitch
  parameter; per-course value ramp; optional sun-sector luminance split
  (angle vs the light direction, for cones/domes); edge jaggedness via the
  existing displacement noise. Params as data:
  `polar?: { courseWidth, jointPitch, jagged, ramp, sunSplit }`.
- **P3 — First four families as data.** `terrain:roof-cone` (slate cone,
  sun-split), `terrain:roof-dome` (cobalt dome + highlight crescent),
  `terrain:dais-stone` (pale ring courses + radial keystone ticks, floor
  priority), `terrain:roof-thatch-spiral` (straw spiral, jagged tuft edges).
  Wire as paintable swatches (Roof/Floor groups).
- **P4 — Verify + review + ship** as in S6 (paint a round tower + dome +
  dais scene).

## Architecture you inherit (read these before coding)

All in `apps/client/src/features/render/` unless noted:

- `proceduralTerrain.ts` — THE field: `colorAt`/`sampleField` are the only
  field math (bake and detail-clip share them). Per-family knobs: `edgeAmp`,
  `rimWidth`, `shadow {band,strength}` (band>default ⇒ soft long throw),
  `contact {reach,strength}`, `mottle {amp,scale,cool}`, `depthBands`,
  `underfill`. Families composite low→high priority; darkening terms compose
  multiplicatively.
- `proceduralTerrainSurface.ts` — orchestrator: builds the field config
  (computes BFS distances per depth-banded family via
  `terrainDistanceField.ts`), bakes base+rim+bands, then the fillRect-only
  detail painters clipped by `sampleField` ≥ per-family rim, then the
  `terrainLighting.ts` post-pass (ambient veil + light pools).
- Painters: `terrainFloorDetail` (plank/flagstone), `terrainWallDetail`
  (courses/quoins/lips), `terrainRoofDetail` (shingles + stair treads),
  `terrainDetail` (grass). All fillRect-only (the clip ctx forwards nothing
  else), deterministic via `hash2` on the world lattice.
- `terrainPalette.ts` — palette-as-data (`VILLAGE_TERRAIN`); shade sets in
  `terrainMaterialPalettes.ts`. starterTiles fills must match family bases
  (pinned by floorVariants/wallVariants tests).
- Live-edit wiring: `apps/client/src/features/map-edit/` — paint families are
  the `MapEditFloorFamily` union + `mapEditFamilies.ts` lists + toolbar
  swatch groups (`MapEditSwatchGrid`); eyedropper via
  `floorFamilyFromAssetId`.
- Table rendering: `map/components/TerrainLayer.tsx` + `terrainBake.ts`
  (bake cache keyed on layers identity + grid + lighting signature; water
  shimmer = translucent overlay on interior cells only).

## Traps (each one bit us already — do not relearn them)

- `terrain:water` is `underfill: false` (exact region + extend-only bumps) and
  priority 3.5. Removing either grows phantom water fringes around every
  building or leaks slivers at map edges — pinned by containment tests.
- Daylight lighting (ambient 1, no lights) must remain a bit-identical no-op.
- Families WITHOUT new knobs must render byte-identically — every new field
  term needs a default that reduces to the old arithmetic.
- 350-LOC cap per source file; prettier --fix can push a file over it. Split
  into sibling modules early (precedent: terrainMaterialPalettes,
  terrainLighting, terrainDistanceField).
- The four layout characterization fixtures all take MainLayoutProps — a new
  MapBoard prop touches all four test files.
- Paint-family state is shared across Paint/Room/Hall — new swatch groups must
  render for all three (hidden-state leak fix; comment in MapEditToolbar).
- The dungeon golden fixture is an owner-sign-off contract — this arc must not
  touch generation output.
- SVG export stays the flat path (colors from starterTiles) — never consult
  VILLAGE_TERRAIN there; goldens are byte-pinned.

## Ritual

- Verify: `pnpm --filter herobyte-client typecheck`, `pnpm lint` (in
  apps/client), `pnpm test` (client), `pnpm test:shared`, `pnpm test:server`.
- Visual proof in the app: `.claude/launch.json` has `server` (8787) and
  `client` (5174); login room password `Fun1`, elevate DM via entity card ⚙ →
  DM Mode → `FunDM`; MAP button opens the live tools. The browser pane's
  synthetic drags don't reach Konva — dispatch real MouseEvents on
  `.konvajs-content` (mousedown → stepped mousemoves → mouseup); plain clicks
  work for click tools. Undo test edits when done.
- Review: run an adversarial multi-agent review workflow over the diff before
  committing (reviewer probes have caught one shipped-blocking bug per arc).
- Commit conventional style to `dev`, push `origin dev` (dev does NOT deploy;
  `main` is production — never push main). End commits with the Claude
  co-author line. Update the memory directory + MEMORY.md index after
  shipping.
