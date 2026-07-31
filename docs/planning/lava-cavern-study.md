# Lava cavern benchmark study — "classic dungeon / natural cave"

_2026-07-30. Second full-scene benchmark after the island cliff village
(`docs/planning/island-benchmark-study.md`). Method unchanged: recreate a
reference battlemap's GRAMMAR with our own generators, ship whatever tooling the
attempt proves missing, and report the delta honestly._

Reference: a portrait volcanic cavern (tags: cavern, cellar, dungeon, lava,
volcano, workshop) — a molten lake feeding rivers through a basalt cave, four
forge platforms over vents, gold/teal mineral clusters, a dark stone hall, timber
workshop cellars, and a heavy smoke veil over the lower half.

Output: `temp/benchmark/benchmark-lava-cavern.png` (2100×3000, ~62 s field bake)
plus the importable `benchmark-lava-cavern-document.json`.
Render with `BENCH_RENDER=1 pnpm --filter herobyte-client exec vitest run zz_cavern_render`.

## The headline finding: lava is water

Almost none of this needed a new painter. The reference's molten rock is the
**Water II machinery with a hot palette**:

| Water concept | Lava reading |
| --- | --- |
| shore-distance `depthBands` | heat bands — bright at the rock, deep red in the middle |
| `foam` lace at land contact | the incandescent white-hot lip |
| `caustics` web over shallows | glowing crack web |
| deep-water `dash` flock | floating crust rafts |
| `underfill: false` | exact region + extend-only bumps (identical need) |
| `animFills` shimmer | the molten pulse, free on the live table |

Likewise a **crystal cluster is the canopy painter** (organic two-scale blob, a
lit side and a shade side split by a noisy diagonal, darkening toward a core),
and a **cavern wall is the sea-crag `ledges` knob** underground. Seven new
families, all pure data.

## Tooling actually shipped

Three additions, each small, additive and gated so every existing family renders
bit-identically:

1. **`glow` — emissive spill (new field primitive).** The exact inverse of
   `contact` AO: instead of darkening the ring around a family, brighten it
   toward a colour. This is what makes molten rock *light the stone beside it*.
   The catalog designed this as rank 4's "emissive twin" and never shipped it
   (`czepeku-study-catalog.md`); it is now shipped.
   **Why not the lighting pass:** its pool TINT scales by `(1 - ambient)`, so at
   daylight ambient the tint is a numeric no-op — a lava cavern would have to
   run ambient < 1 to glow at all, which simultaneously arms the night grade and
   drains the lava's heat to khaki. Baking the spill into the field sidesteps
   both. **Superseded in part (`fc8dcff`, night cave study):** `BakeLight.gain`
   ADDS the light's own colour and is deliberately NOT veil-scaled, so a placed
   light does brighten at full ambient now. The reasoning above still holds for
   FAMILY emission — `glow` is a palette knob, not a light element — but "the
   lighting pass is a daylight no-op" is no longer true of the pass as a whole.
2. **`body` — liquid body grouping.** Every depth-banded family previously fused
   into ONE shore-distance BFS, so a lava lake touching a water pool would lose
   the shore between them and drowned architecture could tint toward magma.
   Families now group by body key (default `"water"` — the shipped single-body
   behaviour, bit for bit).
3. **`haze` — atmospheric ash veil (new bake post-pass).** The one thing the
   palette genuinely could not express: mottle is per-family and value-only, and
   the lighting veil only darkens, but haze must *lighten and desaturate across
   family boundaries* in soft drifts. Two-octave world-locked noise, squared so
   it is thin in most places and dense in banks, with a vertical ramp so smoke
   pools low. Wired into `bakeProceduralTerrain`, not just the harness.

Plus one gap-closure the study surfaced: **prop stamps silently discarded
`tint`** (`paintPropStamp` dropped the parameter), so a menhir was always pale
granite. The menhir now honours a tint and became the map's basalt boulders.

## New families (all data)

`terrain:lava`, `terrain:lava-crust`, `terrain:cave-floor`, `terrain:ash-drift`
(interleaved with the floor, the grass↔dirt grammar in greys), `terrain:cave-wall`,
`terrain:crystal-gold`, `terrain:crystal-verdigris`. Two new deck shelves:
**Molten** and **Crystal**.

**Priority finding:** the cave wall belongs at **3.9, beside the cliff — not in
the 20+ masonry block.** Natural rock is terrain, so a laid floor or cut stair
reads as carved *into* it; and `wallVariants.test` rightly pins built walls above
every ground family, which a 24-priority cave wall broke. The test caught a real
design error, not a stale expectation.

## How close did it get

**Close:** the molten lake's depth and thin hot lip; the forge platforms (dais
collar + molten core + radiating timber, which land almost exactly); the overall
composition and silhouette; the basalt floor with ash drifts interleaving; the
smoke veil; the dark hall and timber cellars; tinted boulders.

**Not close — ranked gaps for a pass 3:**

1. **Cave-wall interiors are flat.** `ledges` quantizes on the *signed field*,
   which saturates near ±0.5, so courses only appear within about half a cell of
   the silhouette; a thick rock mass renders as one flat plateau. The reference's
   walls are contoured throughout. **Fix:** drive ledge courses off the family's
   shore-DISTANCE (the `depthOf` sampler, as bands do) so thickness maps to
   courses, and give the wall its own body.
2. **No scree/rubble carpet.** The reference's floor is densely littered; ours is
   sparse decals. Wants a per-family debris knob (a `scree` sibling of `speckle`
   at cell scale) rather than thousands of stamp elements.
3. **Glow cannot bloom.** The spill is sub-cell by construction (same saturation
   ceiling), so we get a hot rim, not the reference's wide halo. Wants a
   distance-driven bloom — the honest fix is making the lighting pass work at
   full ambient so a self-lit family can emit without the night grade draining
   it. Half of that ingredient shipped in `fc8dcff`: `BakeLight.gain` lets a
   PLACED light add colour at any ambient. What is still missing is a FAMILY
   emitting its own pool.
4. **No vignette.** The reference frames the map with a dark red edge; a cheap
   post-pass beside the haze.
5. **Crystals have no facet geometry** — the canopy painter yields a lobed blob;
   real crystals want straight-edged planes.
6. **Lava area/brightness still overshoots** the reference, whose molten regions
   are smaller against much more rock, with near-black crust.
7. **Prop vocabulary** — no barrels, anvils or forge tools.

## Traps confirmed (do not rediscover)

- **The ±0.5 field saturation ceiling now bites three knobs**: shadow length,
  `ledges` course depth, and `glow` reach. Any new field term measured in field
  units must stay under 0.5 or it degenerates into a flat floor value everywhere.
- **A new family needs `material` + `brushNote` on its asset** or
  `brushDeck.test` fails — and `base` must equal the asset `fill`.
- **`waterFamilyOf` is a singleton search** over the palette; without the body
  filter the first banded family wins, whatever its temperature.
- `seed = priority * 97 + 3`, so **changing a family's priority changes its art**.
- The benchmark render's software canvas needed `rgb()` fillStyle parsing once
  prop tints emitted mixed colours; hex-only parsing silently painted black.
