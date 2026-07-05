# Shared Tile Renderer — Migration Plan (M3, VISION Pillar 2 "An honest renderer")

Status: in progress. Grounded in a 3-agent recon of the editor render stack, the
live-table render stack, and the bundle/timing infrastructure (2026-07-05).

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
  `MAX_ENTRY_GZIP_KB=175`), current entry ~101KB gzip, ~74KB headroom. `konva`
  is a **lazy** `vendor-konva` chunk; `MapBoard` and Map Studio are lazy. The
  renderer core must live in a **lazy chunk (with MapBoard/Map Studio), never
  the entry bundle.**
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
- **R2 — Pure canvas tile-render core.** `features/render/tileRenderCore.ts`:
  framework-agnostic `drawTerrain(ctx, layers, camera, frame)` and
  `drawGrid(ctx, grid, camera)` that reproduce the SVG flat-color model on a 2D
  context, pixel-checked against the SVG output. Unit-tested with a mock
  `CanvasRenderingContext2D` recording draw calls. No UI wiring yet.
- **R3 — Editor adopts the canvas core.** MapStudioCanvas renders terrain (and grid)
  through `tileRenderCore` on a `<canvas>` underlay synced to the camera viewBox;
  SVG retained for element handles/selection/tool ghosts and export. Water animates
  via R1 clock. Verify export parity untouched.
- **R4 — Atlas UVs.** Build a tileset atlas (pack `assets/images/tiles/` into one
  sheet + a UV manifest, license metadata per roadmap). Core draws atlas sub-rects
  instead of flat fills; 47-blob quarter-tile composition. Editor + export adopt.
- **R5 — Live table adopts the core.** MapBoard draws terrain tiles live (animated
  water/torchlight) through the same core inside the Konva stage (or a sibling
  canvas), replacing the static raster background for Forge-native maps; uploaded/
  imework backgrounds keep the raster path. Player-safe render path honored.

## Deferred / dependencies

- Atlas art pipeline + `palette.json` lint (art track, parallel long pole).
- Torchlight/light animation needs compiled-scene lights on the draw path (R5+).
- Transparent-upload terrain holes (spawned chip `task_6aa5c059`) folds into R3/R4
  compositing.
