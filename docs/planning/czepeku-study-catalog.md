# Czepeku Study Catalog — procedural art techniques, ranked

_2026-07-18. Sixteen Czepeku fantasy map previews studied (four themed passes +
synthesis) after the wall/roof/stairs repaint arc shipped. Each entry: what the
reference does, why it works, and the concrete HeroByte implementation route.
Ranked by (impact on our current look × feasibility)._

Maps studied: castle-battlements, fortress-prison, pilgrim-steps, frozen-tombs,
black-market-streets, execution-square, viking-longhouse, caravan-camp,
sacred-grove, druid-islands, haunted-hollow, verdant-oasis, coastal-caverns,
shimmering-port, jungle-lava-flow, archons-catacombs.

## Ship-next three

1. **Low-frequency value-noise mottle** — one field-pass noise term with two
   data knobs per family instantly de-flattens every family on every existing
   map; the most repeated device across all sixteen references and the cheapest
   fix for the "vector diagram" look.
2. **Shore-distance depth field** — one BFS per water region turns flat water
   into readable bathymetry (our biggest visible gap vs Czepeku) and enables
   four follow-ups: drowned geometry, moisture gradients, caustics, lava.
3. **Omnidirectional contact fields** — clone the shipped cast-shadow plumbing
   minus the direction vector, with a per-family sign: grime/AO bands seat
   walls and decks on the ground; the emissive variant gives lava banks and
   lanterns received-light. No painter or schema changes.

## The catalog

### 1. Low-frequency value-noise mottle — `field-feature`
Soft irregular tonal clouds 2–6 tiles across at ~4–8% value offset UNDER the
per-cell detail (damp patches on cobbles, sun patches in grass, drifts in
sand). Lives one spatial frequency below cell detail, so no interference — it
kills procedural flatness with one mechanism. **Route:** 2-octave
world-anchored value noise in the field pass; `TerrainFamilyPalette` gains
amplitude + wavelength/tint knobs; applies beneath every existing painter with
zero painter changes.

### 2. Shore-distance depth field — `field-feature`
Water colour is a function of distance-to-shore: pale aqua ~0.5 tile, bright
turquoise 1–2, teal, deep navy by 4–6, optionally a hard shelf-break into flat
deep water. Inverted palette = lava (white core → orange → black crust).
Forwards onto land = moisture gradient (lush fringe within a tile, wet darkened
band on adjacent sand/rock). **Route:** BFS distance per connected water/lava
region; `depthBands` list per family; grass-decoration density and land tint
read the same field. Cheap v0: lighter saturated rim band on water with high
edgeAmp = the shallow halo.

### 3. Ambient darkness veil + scenery light emitters — `new-system`
Global cool/dark veil (40–55% multiply for dungeons) punched by warm elliptical
pools around torches/braziers (1–3 tiles, amber core, radial falloff, colours
re-saturating inside, texture surviving). Pools clamp the shadow field; glow
spacing paces the eye. **Route:** map-level `ambientDarkness` + emitter data on
scenery elements (radius/colour/intensity/flicker via the animated-water frame
mechanism); the field pass subtracts darkness in radial falloffs. Pairs with,
but is separate from, privacy fog.

### 4. Omnidirectional contact fields (AO band + emissive aura) — `field-feature`
A ragged grime band ~0.1–0.25 tile hugs wall bases and deck edges on ALL sides
(distinct from the directional shadow) — one thin all-round contour is the
entire height read for a knee-high platform. The bright twin: lava warm-tints
its basalt lips; lanterns tint surrounding water. **Route:** clone cast-shadow
plumbing, drop the direction probe, add per-family sign + strength.

### 5. Nested rim rings with continuity decay — `field-feature`
Important edges get 2–5 concentric rings, continuity decaying outward: solid
foam lace → detached dashes → isolated flecks; thin pale contour lines around
cave pools; ripple rings around boulders; stacked lighter-upward cliff strata.
**Route:** generalise the single rim band into an ordered ring list, each with
width, colour, continuity mode (solid | dashed | speckle via world-lattice
hash).

### 6. Neighbour-family awareness: ecotone fringes + debris drift — `field-feature`
Boundaries react to WHICH family is across them: dying-grass fringe where dirt
meets grass (makes dirt look trodden), algae band only against water, red
canopy flecks shed onto grass, pebbles concentrating along path edges.
**Route:** extend the 8-neighbour mask to carry neighbouring family IDs + a 1–2
cell dilated ring; per-family fringe tints in the field pass + a tiny debris
painter using the neighbour's accent colour.

### 7. Edge coping course — `painter-variant`
One course of long contrasting slabs parallel to every walkable-material
boundary (pale coping on ramparts over small cobble fill, kerbs around plazas,
rubble skirts at wall bases). Reads as engineered construction. **Route:**
`edgeCourse` mode in terrainFloorDetail: boundary cells (from the mask) draw
one row of elongated slabs parallel to the boundary — reuses the wall painter's
course/lip logic keyed on floors.

### 8. Drowned geometry: submerged art tinted, never replaced — `field-feature`
Floors continue under water as depth-tinted silhouettes (outlines fade first,
contrast shrinks with depth); tells players where the bottom is wadeable and
creates drowned-city history free. **Route:** `translucentOverlay` flag on
water — underfill already paints the family beneath; the field pass pulls those
pixels toward water colour by depth band and skips detail painters past band N.

### 9. Natural rock families: strata cliffs + cave-rock mass — `new-painter`
Cliff faces as 3–6 wavy staggered bands with lit lips and crack lines (grey sea
cliffs, red sandstone terraces); cave rock as near-black mass with meandering
crack filaments and a pale lit lip along walkable edges. **Route:** two
terrainWallDetail variants: `strata` (wavy course lines, world-x hashed
jitter), `cave-rock` (crack filaments via the plank-grain chaining trick), high
edgeAmp.

### 10. Single-hue mood palettes: dread as data — `palette-tweak`
Haunted-hollow is an ordinary forest pushed into one low-saturation purple hue
window with compressed values; the few glow accents own all saturation. Mood is
a palette property. **Route:** a colour-transform script over family
definitions emitting "haunted" siblings; zero renderer code; multiplies with
technique 3.

### 11. Height- and softness-scaled cast shadows — `field-feature`
Shadow LENGTH is the only continuous height signal (towers 3–6 tiles, crates
0.3–0.5); canopy gets extra-wide soft shadows. **Route:** extend the per-family
shadow with reach + edge-softness scaled by caster/receiver priority delta.
(The reserved `band` knob from the wall arc is the natural home.)

### 12. Canopy as a lobed overhead blob family — `new-painter`
Tree cover as a top-priority family: scalloped lobed edges (edgeAmp ≈ 1 gives
the lobes free), near-black interior blotch clusters + lighter lit-side
clusters, broad soft ground shadow. Same construct = dread-hedge or bush.
**Route:** one clustered-blotch painter + technique 11's soft shadow.

### 13. Urban paver kit: runner strips + crumbling boundary slabs — `painter-variant`
Same paving lattice across zones, only tint changes — darker "runner" strips
mark walking routes; at soil boundaries whole pavers go missing with 1–2
orphans past the edge (grid-coherent perforation, the complement of edgeAmp).
**Route:** pre-darkened runner sibling families (painters already world-lattice
aligned across families); flagstone painter hash-drops boundary slabs painting
them in the underfill family's colour.

### 14. Rug and textile floor families — `new-painter`
Bounded saturated rectangles with a lighter border band (the rim!), sparse pale
motif stamps, thin outline, tiny all-round shadow. Colour-codes room function
instantly. **Route:** rug families from existing knobs (rim = border, edgeAmp
0, priority over stone) + a small motif painter; pointed at flagstones it
yields rune-carved stones.

### 15. Placement intelligence: edge-hugging clutter + corridor cadence — `new-system`
Clutter clusters 2–4 against walls/counters, never mid-lane, one member
jittered; long corridors repeat a dressed unit every ~3 tiles. **Route:**
POPULATE heuristics — weight cells by wall/scenery adjacency, cluster spawns,
zero-weight door-to-door lanes; detect long corridor runs and drop a bundle
every N cells.
