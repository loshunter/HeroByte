# CRT CSS polish review

Branch: `codex/crt-css-polish`. Baseline: `6a9cb811`.

## Changes

- CRT preference persists locally under `herobyte:crt`, defaults off, and still
  works in memory if storage access fails.
- Stationary 4 CSS-pixel scanline period with soft edges and peak alpha 0.28.
- Removed flicker, animated blue bloom, red/cyan edge wash, and overlay filters.
- Faint RGB tile: 3 CSS pixels at 1x; 1.5 CSS pixels at 2x and above. Retained
  after screenshot inspection at 1x and 2x; no extra blend mode.
- Full-screen desktop scope and panel softening retained: scanline opacity
  0.35, vignette opacity 0.5, phosphor mask hidden while panels are open.
- Reduced-motion preference disables CRT opacity transitions and ambient sparkles.
- Mobile now exposes CRT in the existing Tools sheet. Its overlay contains only
  scanlines and vignette; no phosphor tile, bezel, or ambient sparkles.
- No shader, curvature, image-loading, or hit-testing changes.

## Automated browser comparison

This is a **headless software-renderer comparison**, not a measurement of the
owner's normal browser/GPU or a physical phone. Chromium 141.0.7390.37 reported
ANGLE/SwiftShader. Do not infer hardware FPS or GPU execution time from it.

The built client ran against an isolated local server. A generated stone dungeon
contained 34 walls and 7 doors. The 1440x900 viewport was checked at device pixel
ratios 1 and 2. The scene was held fixed within each three-way comparison.

For each ratio, CRT off, original CSS, and polished CSS each received three
five-second camera sweeps. The real camera setter followed the same time-based
path at scale 0.6, excluding the first second from measurements. Mode order
rotated between repetitions. Original CSS was loaded from the baseline into the
same client, then removed before measuring polished CSS. Measurements use
`requestAnimationFrame` intervals, not compositor-presented-frame timestamps.

| Pixel ratio | Effect       | Mean frame interval across runs | Per-run p95 range |
| ----------- | ------------ | ------------------------------- | ----------------- |
| 1x          | Off          | 16.67 ms                        | 16.7–16.8 ms      |
| 1x          | Original CSS | 35.65 ms                        | 50.0 ms           |
| 1x          | Polished CSS | 16.67 ms                        | 16.7–16.8 ms      |
| 2x          | Off          | 16.85 ms                        | 16.8 ms           |
| 2x          | Original CSS | 36.83 ms                        | 50.0–50.1 ms      |
| 2x          | Polished CSS | 16.67 ms                        | 16.7–16.8 ms      |

The polished version added no detectable frame-pacing cost in this comparison.
This does not establish zero overhead or predict performance on other scenes.
Local captures and raw measurements are in the ignored `.tmp/crt-review/` folder.

## Verification

- 143 existing unit/component tests passed: visual effects, panel presence,
  desktop header, mobile controls/layout, and App.
- Client typecheck, workspace lint, formatting, frozen-test contracts, and
  structural guardrails passed.
- Shared/server TypeScript builds and client development/production bundles passed.
- Browser checks passed for on/off persistence, blocked preference storage,
  normal/HiDPI mask sizing, reduced motion, and unchanged panel opacity levels.
- Mobile portrait and landscape were visually inspected using Pixel 7 emulation.
  This checks layout, not real-phone performance.
- Existing navigation E2E suite with CRT enabled: pan, zoom, and snap passed;
  two existing tests skipped themselves because their expected controls were absent.

## Before merge

On the owner's normal desktop browser and one physical phone, compare the same
map pan with CRT off and on. Review text, grid, and token readability; verify the
preference after reload and panel softening. Check fractional desktop scaling as
well as 1x/2x if used. Remove the optional phosphor tile if it produces visible
interference on the target display. Hardware performance validation remains pending.
