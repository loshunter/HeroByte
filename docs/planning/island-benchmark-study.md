# Island Benchmark Study — recreating a pro coastal map with our own tools

_2026-07-27. First full-scene integration test of the shipped catalog: recreate
the GRAMMAR of a Czepeku-style island/ocean reference (bridges, cliffs, farm,
island, ocean) using only HeroByte generators. Internal benchmark — the
reference is study material, never shipped content. Everything below is our
own procedural art; nothing is copied._

## What exists

- **Fixture**: `temp/benchmark/benchmark-map-document.json` — a complete,
  import-schema-valid MapDocument (44×56 cells @ 50px, 12 RLE chunks, 15-family
  palette, 4 decal stamps). 4.9 KB. Verified end-to-end: server `map-studio-
  import` accepts it, `map-studio-set-live` binds it, the client bakes it.
- **Render**: `temp/benchmark/benchmark-island-study.png` — the headless bake
  (field + detail + decals), regenerable via
  `BENCH_RENDER=1 vitest run zz_benchmark_render.test.ts` (~80 s).
- **Generator**: `apps/client/src/features/render/__tests__/zz_benchmarkMap*.ts`
  — deterministic geometry (seeded blobs/paths/rings) → document assembly.
  The `zz_benchmark_render` harness is the repo's first headless PNG pipeline:
  pure `renderTerrainField` + a ~40-line software TileRenderContext2D + the
  proto PNG encoder. No browser, no new dependencies.

## What the benchmark forced into existence (both shipped)

1. **`terrain:cliff`** — sea-crag stacked-ledge family (25f5d4c). The Pass-1
   approximation (wall-dark coast ring) read as fortress masonry — quoins and
   course ticks on every island. The new `ledges` field knob quantizes a
   family's interior into rim-within-rim courses with ink contours; priority
   3.8 puts crag toes over the foam line and its long throw on the sea.
2. **`terrain:bridge-plank`** — log-rib bridge deck (1095ab7). Pass-1 grey
   planks read as stone slabs. The new `bridge` floor kind lays boards
   perpendicular to the neighbour-mask run over a dark water-shadow base
   (sliver gaps + missing boards), mask-driven stringers, end posts.

## Honest delta — status after the delta-list pass (2026-07-27, same day)

Items 1–4 SHIPPED working the list top-down (1bd2134 ground pass, prop
stamps commit following):

1. ~~**Sand.**~~ `terrain:sand` + the second interleave pair (grass↔sand) —
   the dominant ground read landed; paths/clearings glow warm tan with
   hand-painted seams.
2. ~~**Farm furrows.**~~ `terrain:farm-furrow` (`furrow` floor kind):
   sub-cell trench/ridge rows + crop ticks, run-aware via neighbour mask.
3. ~~**Thatch at building scale.**~~ Square thatch warmed into the spiral's
   straw-gold hue family (data-only).
4. ~~**Boats, gulls, standing stones.**~~ First prop-kit pieces as decal-
   machinery kinds (`boat`/`gull`/`menhir` — zero wire impact): rowboat
   hull with wake, gull chevrons, lit/shade menhirs. The benchmark's stone
   circle is real megaliths now.

Still open, ranked:

1. **Bridge dressing.** Rope sag arcs, X-lashings, plank-striped water
   shadow — deferred to the spline arc with the rest of rank 11's ribbons.
2. **Prop-kit depth.** The dinghy/gull/menhir trio proves the route; the
   catalog's larger hull tiers, carts, racks and crop rows remain.
3. **Water dash flocks** barely appear — channels here rarely exceed the
   depth-3 gate. Not a bug; wider oceans would show them.
4. **Main-thread bake cost** — a 6.7 MPx live-bind freezes the tab ~1 min;
   a worker/chunked bake is a wanted slice.

## Traps found (and paid for)

- `INTERIOR_FLOOR_ASSET_IDS` (mapEditFamilies) is pinned against the palette
  by wallVariants.test: ANY new floor-kind family must join the Room/Hallway
  ring-protection set or the suite fails.
- The floor swatch union is still three hand-written lists + the type union
  (mapEditTypes / mapEditFamilies / MapEditToolbar) — cliff + bridge are wired
  into all of them.
- The client bakes on the main thread: a 6.7 MPx live-bind freezes the tab for
  ~a minute. Known cost, but the benchmark makes it visceral — a worker/chunked
  bake is worth a future slice.
- Dev-drive recipe for live verification without the UI file picker: serve the
  JSON from `public/`, then `window.__HERO_BYTE_E2E__.sendMessage` →
  `elevate-to-dm` (dmPassword), `map-studio-import` (document), and
  `map-studio-set-live` (documentId — the direct message path KEEPS your id;
  only the UI import button mints a fresh one).
