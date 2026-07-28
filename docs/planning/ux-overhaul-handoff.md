# UX overhaul handoff — "the engine outgrew its cockpit"

_2026-07-28. Owner-approved pitch: the renderer became painterly (30+ families,
12 catalog techniques) but the DM meets it through a stack of tiny buttons and
flat colour swatches. Five pillars, each its own slice with its own commit.
Nothing here needs new rendering tech — every pillar reuses shipped machinery._

## The five pillars (build in this order)

### P1 — The painter's deck (biggest daily-use win; do first)
Replace the flat floor/wall/roof swatch grids with a browsable brush deck:
LIVE-BAKED thumbnails (the real painter output at ~44px), grouped by material
(ground / water / stone / wood / roofs / canopy / props), with search, pinned
favourites, recents, and a hover card (large preview + one-line grammar note).
- Thumbnails: bake each family once into a tiny offscreen canvas via
  `bakeProceduralTerrain` (features/render/proceduralTerrainSurface.ts) over a
  3×3 cell patch; cache per family id. The flat `fill` stays as the loading
  fallback.
- Current swatch UI: `MapEditToolbar.tsx` (FLOOR_FAMILIES list + swatch
  grids), `MapEditSwatchGrid`, `MapEditToolPanels.tsx`. Family metadata:
  `mapEditFamilies.ts`, `starterTileAssets.ts` (+Structure/Object siblings).
- This should DERIVE the deck from starterTiles and finally retire the
  hardcoded floor-list trap (three lists + a type union — see memory).

### P2 — Ghost-before-commit (feel)
Every gesture previews the TRUE result while the pointer is down: spline drags
show the sagged rope with posts (call `paintSpline` from
features/render/splineDetail.ts in the preview), paint strokes tint cells with
the family's real base+mottle chip, scatter/populate show their draft dots.
- Preview surface: `MapEditPreviewLayer.tsx` (today: dashed `renderSegment`
  for splines, Rect for hallway). The painters are deterministic and cheap at
  gesture scale — reuse them directly, no snapshots involved.

### P3 — Worker bake: never block the table (the known wound)
A big live-bind freezes the tab ~60s (main-thread bake). Move
`renderTerrainField` (pure, writes a transferable Uint8ClampedArray — ideal
worker fit) into a Web Worker; stream chunked regions so flat colour lands
instantly and painterly detail sweeps in, with a small progress chip.
- Bake orchestration + cache: `features/map/components/terrainBake.ts`
  (`getFieldBake`), `proceduralTerrainSurface.ts` (`bakeProceduralTerrain`,
  MAX_BAKE_DIM/PIXELS guards — keep them).
- The detail pass (`paintProceduralDetail`) draws via ctx; in a worker use an
  OffscreenCanvas or the software-ctx pattern proven in
  `render/__tests__/zz_benchmark_render.test.ts`.
- Shimmer/anim overlays stay main-thread (they're cheap frame overlays).

### P4 — Player lens (trust)
One toggle shows the DM exactly what players receive. The filter already
exists: `deriveMapElements` (packages/shared/src/scenePublish.ts) is the SOLE
privacy producer. The lens = render the DM's own view through that derived
snapshot + hide DM overlays. Never add a second producer (secrecy invariant —
see NotesOverlayLayer note).

### P5 — Quick wheel (delighter)
Right-click/long-press radial menu at the cursor: 8 slots = most-used tools +
pinned brushes. Selection state lives in `useMapEditState.ts`; tools dispatch
via `activeSubTool`/`floorFamily` setters that already exist.

## Traps (all confirmed this project — do not rediscover)
- Any new prop on `MapEditToolbarProps` must be added to ALL FOUR layout
  fixtures (CenterCanvas/FloatingPanels/Mobile/TopPanel tests). Optional
  props on the LAYOUT chain avoid churn; toolbar props always hit fixtures.
- 350-LOC cap per file, CI-enforced (`pnpm lint:structure`). MapEditToolbar
  ~342, useMapEditTool ~340 — extract new UI into sibling files (precedent:
  MapEditToolPanels, mapStudioElementValidators).
- JRPGButton variants: default | primary | success | danger (no "secondary").
- Server typechecks against BUILT shared dist — `pnpm --filter
  @herobyte/shared build` after shared changes or typecheck lies.
- Theme is JRPG/CRT (gold labels, pixel chrome) — the deck/wheel must look
  like the game, not like a settings app.

## Ritual (AGENTS.md)
Per slice: focused tests → `pnpm typecheck` → `pnpm lint:structure` →
`pnpm test:client` → commit (small, attributed). Verify visually via the dev
servers (launch.json: server 8787, client 5174; logins Fun1 / FunDM) or the
headless harness (`BENCH_RENDER=1` on zz_benchmark_render.test.ts) for
renderer-level work.

## Context to load (only this)
- This file; memory notes `island-benchmark-arc` + `s1-live-binding-shipped`
  (traps + where live authoring lives); `.agents/AGENTS.md` (ritual).
- Recon-as-needed per pillar from the file lists above — do NOT re-explore
  broad architecture; it is mapped.
