# Night flooded cave benchmark study — "smugglers' lagoon"

_2026-07-30. Third full-scene benchmark, after the island cliff village and the
lava cavern. Same method: recreate a reference battlemap's grammar with our own
generators, ship whatever the attempt proves missing, report the delta honestly._

Reference: a square, portrait-dark sea cave at night — cold blue-black water
threaded through a warm tan sand bar, ringed by ~20 warm lantern pools, a painted
fleet of small boats, plank docks, crate piles, two near-black side chambers (one
with a green bioluminescent glow), and hanging roots where the surface breaks in.

Output: `temp/benchmark/benchmark-night-cave.png` (2400×2400, ~29 s field bake)
plus the importable `benchmark-night-cave-document.json`.
Render: `BENCH_RENDER=1 pnpm --filter herobyte-client exec vitest run zz_nightCave_render`.

## Why this reference was worth doing

The first two studies were both daylight. The island village ran ambient 1; the
lava cavern deliberately *avoided* the lighting pass, because its pool tint
scales by `(1 - ambient)` and the night grade drains hot colours. This reference
is the first that is **fundamentally about light** — so it finally exercises
Light & Colour II's whole stack (ambient veil + 3-stop pools + night grade +
sparkle motes) at scale, and it is also the first study to render *lit*: the
harness now grades the palette and runs the lighting pass exactly as the live
bake does.

## The headline finding: pools could not add light

`applyBakeLighting` computed `effVeil = veil * (1 - pool)`. A pool therefore
*cancelled* darkness and re-tinted the ground, but its ceiling was **exactly the
unlit bake colour**. On a night map that means a lantern can only ever look like
a hole in the veil — "less dark" — never like a source. In the first render pass
the 20-odd lanterns were nearly invisible: the graded sand was a muted grey-tan,
cancelling the veil returned it to that same muted grey-tan, and the 45 %-of-veil
tint added barely a wash of orange.

**Shipped: `BakeLight.gain`** — an overdrive that ADDS the light's own colour,
letting the pool climb above the unlit ground. Notably it is *not* veil-scaled:
a lamp is as bright at dusk as at midnight; what changes is the dark around it.
Omitted or 0 reproduces the shipped behaviour bit for bit.

This is the exact mirror of the lava study's finding. There, no term could
brighten a family's *neighbours*, so `glow` was added. Here, no term could
brighten a *light's own pool*, so `gain` was added. Between them the renderer can
now express emission both ways.

## Also shipped

- **The night grade reached ledge courses.** `gradeFamily` graded base, rim, key
  clusters, grass, floors, walls, roofs, stairs, water dashes, canopy, sunken
  algae, depth bands, foam and caustics — but **not `ledges`**. A cliff or cavern
  wall therefore kept full daylight rock at midnight while its own base and rim
  went cool. This is the grass-decoration bug, second edition, and it is fixed.
- **`glow` is now documented as deliberately exempt** from the grade: an emissive
  spill is light the family *emits*, not light it receives, so moonlight must not
  cool it. Lava stays orange at midnight.
- **Tintable boat hulls.** The lava study made the menhir honour `tint`; the boat
  still ignored it, so a fleet could only be one colour. The gunwale now takes
  the hull colour hard and the deck planks only lightly (bare timber inside a
  painted hull). The gull still ignores tint by design.
- **Two new families**, both riding the lava study's `body` key — the payoff for
  that primitive arriving one study early:
  - `terrain:abyss-water` — near-black cave water in its **own** shore-distance
    body, so a black tarn beside the lagoon keeps its own bathymetry instead of
    reading as the lagoon's deep centre. No caustics: there is no sun down there.
  - `terrain:biolume` — a glowing algae shoal that lights the rock around it
    **cold** green via `glow`, the exact inverse of lava's warm spill, with no
    lighting pass involved.

## How close did it get

**Close:** the whole night mood — cold blue-black water against warm-lit sand —
comes straight out of the night grade plus gained pools, and the discrete lantern
pools with dark sand between them read like the reference's. The painted fleet
lands well. The braided sand-bar-through-water structure, the pale scalloped
waterline (the water's own foam lace, needing nothing new), the darker separate
abyss chambers and the green shoal all work.

**Not close — ranked for a pass 4:**

1. **No lantern PROP art.** The pools are the lanterns; there is no lamp object
   under them (`objects:lamp` has no decal spec, so the harness draws nothing).
   The reference shows a physical lamp at each light. Wants a `lantern` stamp kind.
2. **Pool tuning is delicate and undiscoverable.** `WASH_REACH` is 2.75×, so a
   3-cell lamp washes past 8 cells and a shoreline of them merges into one warm
   sheet (exactly what pass 1 did). The map had to drop to 1.5–2-cell radii with
   7-cell spacing. A per-light `washReach` — or authoring guidance — would help.
3. **No barrels or stacked timber**; crates and tables stand in.
4. **Sand loses too much chroma** in unlit areas. The grade pulls 42 % toward
   moonlight blue at this ambient, so dry sand outside a pool goes grey where the
   reference keeps a warm undertone. Wants a per-family grade resistance.
5. **No hanging roots / surface breach**, and no vignette (shared with the lava
   study's gap list).
6. **Boats sit on sand, not in water.** Placement is naive; the reference beaches
   them half-in.

## Traps confirmed

- **Lighting is a POST-pass over the bake**, so props and decals must be painted
  *before* it or a lantern glows behind the crate beside it. The harness now
  orders terrain → detail → splines → stamps → lighting → haze.
- **The harness and the live table disagree about props.** The harness paints
  stamps INTO the bake buffer, so they are veiled and lit; the live table draws
  them in Konva's `MapElementsLayer` *above* the bake, where nothing veils them.
  A night map therefore shows fully-bright day-lit crates on the table and
  correctly-dim ones in the study render. Recorded as a real divergence, not a
  harness bug — fixing it means veiling the element layer at the table.
- **The water shimmer overlay is ungraded.** `drawWaterShimmer` paints the
  asset's `animFills` at 0.12 alpha over the finished bake, and asset fills never
  pass through the night grade — so an animated water family flickers DAY blue
  over graded night water. Both new families here declare `animFills`, so they
  inherit it. Ranked with the pass-4 gaps.
- **A lit document must carry `light` ELEMENTS and a dimmed lighting layer** to
  survive JSON round-trip: the bake's `BakeLighting` is an input, not document
  state, so a fixture that only builds the former imports as plain daylight. The
  lighting layer's own opacity *is* the ambient level.
- **The grade changes the palette the FIELD is built from**, not just the final
  pixels — so a lit render must pass the graded palette into
  `buildProceduralFieldConfig` *and* `paintProceduralDetail`, or the base field
  and its interior detail disagree about the hour.
- Adding families **changes the brush deck shelves and therefore the P5 quick
  wheel's default slots**; `brushDeck.test` and `mapEditWheel.test` pin both and
  need updating. That is the derivation working, not a break.
- `nightGradeStrength` arms below ambient **0.85**, and 0.32 gives grade ≈ 0.62
  with veil ≈ 0.53 — a good deep-night working point.
