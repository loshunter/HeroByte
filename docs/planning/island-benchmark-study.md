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

1. **Bridge dressing.** Rope sag arcs SHIPPED with the spline arc
   (`dafd72a` elements, `91dfe72` drag-a-span sub-tool): rope and chain hang
   with per-segment parabolic sag and post dots, so a deck can be dressed on
   the live table today. Still open: X-lashings at the ends and the
   plank-striped water shadow under the deck.
2. **Prop-kit depth.** The dinghy/gull/menhir trio proves the route; the
   catalog's larger hull tiers, carts, racks and crop rows remain.
3. **Water dash flocks** barely appear — channels here rarely exceed the
   depth-3 gate. Not a bug; wider oceans would show them.
4. ~~**Main-thread bake cost.**~~ SHIPPED as UX overhaul P3 (`d663786`,
   2026-07-29): `renderTerrainField` runs in a Web Worker and streams bands
   over an instant flat-colour prefill, with a progress chip; the synchronous
   path is kept as the fallback when Worker/OffscreenCanvas are absent.
   Measured against THIS 6.7 MPx document: worst main-thread stall 1.98 s,
   versus the ~60 s solid freeze.

## Traps found (and paid for)

- `INTERIOR_FLOOR_ASSET_IDS` (mapEditFamilies) is no longer hand-kept: since
  the painter's deck (`cbf13e4`) it DERIVES from the palette — every
  ground-level family (priority < 20) carrying a floor, stairs, sunken or
  polar painter joins the Room/Hallway ring-protection set automatically. What
  a new family still forces you to update are the LITERAL pins in
  `wallVariants.test` and `brushDeck.test` (and, since the quick wheel,
  `mapEditWheel.test`).
- ~~The floor swatch union is three hand-written lists + a type union.~~ That
  trap is DEAD as of the painter's deck (`cbf13e4`): paint families are
  DERIVED from `MAP_STUDIO_TILE_ASSETS` ∩ `VILLAGE_TERRAIN` in
  `mapEditFamilies.ts`, `MapEditFloorFamily` is now a plain `string` alias, and
  the deck reads the derivation — a new family is a palette entry plus an asset
  entry (with `material` + `brushNote`) and nothing else.
- ~~The client bakes on the main thread.~~ FIXED by the worker bake
  (`d663786`): the field streams from a Web Worker band by band (banding is
  byte-identical to the whole render, pinned by test) and the table paints a
  flat-colour prefill immediately. This document is the one it was measured
  against — worst stall 1.98 s, was ~60 s. No Worker/OffscreenCanvas ⇒ the
  exact pre-P3 synchronous path.
- Dev-drive recipe for live verification without the UI file picker: serve the
  JSON from `public/`, then `window.__HERO_BYTE_E2E__.sendMessage` →
  `elevate-to-dm` (dmPassword), `map-studio-import` (document), and
  `map-studio-set-live` (documentId — the direct message path KEEPS your id;
  only the UI import button mints a fresh one).
