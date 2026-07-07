# Shared Tile Renderer — Migration Plan (M3, VISION Pillar 2 "An honest renderer")

Status: functionally complete (2026-07-06) — R1–R5b and R4b all shipped on `dev`;
only R4c (47-blob quarter-tiles) remains, BLOCKED on art. The adjacent /assets
hardening chip (Slice S) also landed (`b8191d3e`). Grounded in a 3-agent recon of
the editor render stack, the live-table render stack, and the bundle/timing
infrastructure (2026-07-05).

## The goal (from VISION.md pillar 2)

Migrate the Map Studio editing canvas **and** the live table onto one shared
canvas/WebGL tile renderer: atlas UVs, a **300ms shared animation clock** for
water/torchlight, budgeted inside the **175KB gzip entry guard**. SVG stays the
**export** path (raster export inherits every fidelity gain).

## What the recon established

- **Editor** (`features/map-studio/components/MapStudioCanvas.tsx`, SVG): flat
  colors, no atlas, no animation. The pure logic is already framework-agnostic
  and reusable: `terrainRender.buildTerrainRenderLayers`, `tileAutotiling`
  (occupancy + boundary paths), `gridGeometry`. Camera hook `useStudioCamera`
  is renderer-agnostic (viewBox in world/pixel coords).
- **Live table** (`ui/MapBoard.tsx`, **react-konva / HTML5 Canvas**): already a
  canvas renderer. It consumes the published map as a **rasterized data-URI
  texture** (`snapshot.mapBackground`) drawn as one `Konva.Image`. Tokens/fog/
  doors/drawings are Konva layers over it. So the live table is NOT SVG — the
  "migration" there means drawing terrain tiles live instead of a static raster,
  so water/torchlight animate at the table.
- **Bundle**: 175KB gzip entry guard (`apps/client/scripts/check-bundle-size.mjs`,
  `MAX_ENTRY_GZIP_KB=175`), current entry ~86KB gzip. `konva` is a **lazy**
  `vendor-konva` chunk and `MapBoard` is lazy — but **Map Studio is NOT lazy**
  (correction to the original recon: `App.tsx` imports `useMapStudio` and the
  layouts import `MapStudioWorkspace` statically, so the whole feature —
  renderer core included — sits in the entry chunk today). A follow-up chip
  exists to code-split it like MapBoard. The atlas image/manifest are static
  `public/` assets and never enter the JS bundle.
- **Motion**: no animation clock exists yet. Motion gating exists:
  `features/juice/juiceSettings.ts` — `motionDisabled()`, `getJuiceSettings().motion`
  ("full"|"subtle"|"off"), `subscribeJuiceSettings`, `<html data-motion>`.
- **Art**: real tile PNGs exist at `assets/images/tiles/` (dirt/stone/wood/grass/
  path, 5 variants each) — individual files, **no atlas yet**.

## Invariants (do not break)

- **Export stays pixel-identical to today.** `exportMapDocument.renderMapDocumentSvg`
  and the pure `buildTerrainRenderLayers`/`tileAutotiling` stay phase-agnostic;
  animation is applied only at live-draw time (frame 0 == current output).
- Units: tokens/props are grid **cells**; geometry is **pixels** (`gridCellToWorldPoint`).
- 350-LOC per file. Renderer core in a lazy chunk. Reduced-motion freezes animation.

## Slices (smallest end-to-end first; one verified commit each)

- **R1 — Shared animation clock (DONE this session).** `features/render/animationClock.ts`
  singleton: a monotonic frame counter advancing every **300ms** via one shared
  timer, frozen to `0` when motion is off, notifying subscribers only on step
  change. Counter (not wall-clock) so it starts at 0 and is deterministic under
  fake timers; **cross-client frame sync (wall-clock/server time) is a deferred
  refinement** — ambient shimmer doesn't need it, juice events will. Paired hook
  `useAnimationFrameIndex(frames, enabled)`. First consumer: editor water terrain
  gets a subtle 4-frame shimmer (alternate close-blue fills on the water family,
  frame 0 == base fill); export and the pure `buildTerrainRenderLayers` stay
  phase-agnostic and unchanged. Proves the clock in a real render path.
- **R2 — Pure canvas tile-render core (DONE, 5778013).** `features/render/tileRenderCore.ts`:
  framework-agnostic `drawTerrain`/`drawGrid` reproducing the SVG flat-color
  model on a 2D context; `terrainRender` refactored to emit structured
  cells/edges with the SVG paths as a byte-parity adapter (golden snapshots
  pin exact strings, including float-absorption degenerates — edge orientation
  is explicit, never inferred from coordinates). Grid tile-border segments
  draw at half width to match SVG pattern clipping; edge culls keep a
  stroke-half-width margin.
- **R3 — Editor adopts the canvas core (DONE, 6fa499f7).** MapStudioCanvas renders
  background + grid + terrain through `tileRenderCore` on a `<canvas>` underlay
  (`MapStudioCanvasUnderlay`) synced to the camera with the SVG's letterbox math;
  SVG retained above for element handles/selection/tool ghosts and export. Water
  animates via the R1 clock. Review-hardened: culling covers the full visible
  world rect (not just the viewBox), terrain draws unclipped like the old SVG,
  layer opacity composites per family via offscreen blit (SVG group-opacity
  semantics), DPR changes redraw via a matchMedia resolution listener.
  Also fixed: transparent uploads no longer punch terrain holes (73dc254 —
  image-backed tiles claim no autotile occupancy).
- **R4a — Atlas + UV manifest, flat-fill families become textures (DONE, 0e944a8).**
  `scripts/build-tile-atlas.ps1` bakes `assets/images/tiles/` (25 sources,
  1024²) into `apps/client/public/tiles/tileset-v1.png` (5×5 @128px, ~1.1MB)
  plus `tileset-v1.json` (UV variants per family, average colors, license
  metadata — provenance currently UNSPECIFIED, confirm before public release).
  Interim Windows-only bake (the pnpm store blocks adding `sharp` without a
  full relink); outputs are committed so CI never bakes. `features/render/tileAtlas.ts`
  lazy-loads the sheet once per session; `drawTerrain` gains an atlas option
  drawing per-cell sub-rects with a deterministic spatial-hash variant per
  cell; families without atlas art (water, uploads) keep flat fills, water
  keeps its shimmer; boundary strokes still draw on top. New starter terrains:
  grass, dirt, path.
- **R4b — Raster export adopts the atlas (DONE).** PNG/WebP export now composites
  through the core: new `rasterUnderlay.ts` draws background + grid + atlas-textured
  terrain (frame 0, opacity via per-family offscreen fade) onto the canvas, then
  blits an elements-only SVG on top. Gated on painted terrain — terrain-free maps
  keep the exact single-pass full-SVG raster, and the render core tree-shakes into
  the lazy DM-export chunk (entry gzip unchanged). Publish already carries terrain
  as data (R5a/R5b), so this covered the download path only. **SVG download stays
  flat-color and byte-stable BY DESIGN** — the atlas is never inlined into a
  portable SVG (that would blow `MAX_PUBLISH_BACKGROUND_BYTES`); the SVG remains
  the full-fidelity, portable export. Focused review: 0 confirmed, 1 contested
  minor accepted (hex-grid horizontals render slightly thin in the raster vs SVG;
  square terrain maps unaffected).
- **R4c — 47-blob quarter-tile composition (BLOCKED on art).** Requires
  edge/corner quarter-tile art per family; the current packs are full-tile
  variants only. Art track deliverable; also curate the `path` variants (two
  are grass-transition tiles, one has a baked-in frame border).
- **R5 — Live table adopts the core.** MapBoard draws terrain tiles live (animated
  water/torchlight) through the same core inside the Konva stage (or a sibling
  canvas), replacing the static raster background for Forge-native maps; uploaded/
  imework backgrounds keep the raster path. Player-safe render path honored.
  - **R5a — Publish carries terrain (protocol) (DONE, 01cc3764).** Publish sends
    `mapTerrain` (RLE + grid + opacity) as data, not baked pixels; server-derived
    from its stored document, persisted, back-compat.
  - **R5b — Live table draws terrain via the core (DONE).** `TerrainLayer` renders
    `snapshot.mapTerrain` under the elements-only background through
    `tileRenderCore` + the atlas; water shimmers on the shared clock; uploaded/
    legacy raster backgrounds untouched. Studio Publish flips to elements-only.
    (Follow-up: the DM-menu publish button still sends a full-render background —
    flip it for parity; see playbook §4.)

## Deferred / dependencies

- Atlas art pipeline + `palette.json` lint (art track, parallel long pole).
- Torchlight/light animation needs compiled-scene lights on the draw path (R5+).
- Transparent-upload terrain holes (spawned chip `task_6aa5c059`) folds into R3/R4
  compositing.
