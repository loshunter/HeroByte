# CRT CSS polish review

Branch: `codex/crt-css-polish`. Baseline: `6a9cb811`.

## Changes

- CRT preference persists locally under `herobyte:crt`, defaults off, and still
  works in memory if storage access fails. The store reads once and writes only
  a changed preference; mounting the app does not create a storage entry.
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

## Original verification (before review)

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

These original checks did not pin the new behavior in committed tests. The
one-off browser script and performance data remain historical evidence, not a
reproducible regression gate. The review follow-up below closes that test gap.

## Review follow-up

- Added nine `useCrtPreference` tests: saved true, absent/false/malformed storage,
  writes on change only, fresh reads of both states, shared consumers/remounts,
  and throwing storage reads, writes, and property accessors.
- Added two mobile layout cases for overlay mounting/removal and App callback
  forwarding; two mobile controls cases check the tile in both toggle states.
- All 89 tests across those three files pass. Replacing the hook with plain
  `useState(false)` makes three tests fail. Removing the mobile overlay
  and toggle wiring makes two tests fail. Both mutations were restored;
  the failures were behavioral assertions, not compilation errors.
- Restored the full mobile server-status rationale. Extracted turn navigation
  into `MobileCombatStrip`, leaving `MobileLayout` at 332 lines. Existing combat
  visibility and next/previous-turn tests continue to cover the extraction.
- Added `apps/e2e/crt-preference.spec.ts`: four passing browser tests cover real
  reloads, blocked storage, 1x/2x mask sizing, stationary overlays, panel softening,
  reduced motion, and a DM/player session with mobile touch interaction.
  The mobile test checks the **computed** `::before` content, not a jsdom guess.

Reproduce the targeted checks with the repository's pinned pnpm version:

```sh
pnpm --filter herobyte-client exec vitest run src/components/effects/__tests__/useCrtPreference.test.tsx src/components/layout/__tests__/MobileFloatingControls.test.tsx src/layouts/__tests__/MobileLayout.test.tsx
pnpm test:e2e apps/e2e/crt-preference.spec.ts --project=chromium
```

The browser spec attaches desktop, panel, mobile portrait/landscape, and shared
drawing screenshots to its report. The initial dev-client run used isolated
ports 5177/8790; logs and captures are under `.tmp/crt-review-fixes/`. The built
client repeat and full suite used isolated ports 5175/8788.

The full verification ladder passed after correcting one browser assertion:
CSS minification spells `0.5px` as `.5px`, so the test now checks the numeric
length and pixel unit instead of literal spelling. No rendering change was
needed. The corrected spec passed all four cases against the built client,
then the complete Playwright suite passed **210 tests, with 3 skipped** (9.7m).

Shared build, workspace lint, formatting, structure guard, both typechecks,
and isolated dev boot passed. Unit results: shared **449 passed**, server
**2,510 passed**, client **5,910 passed / 4 skipped** across all 38 batches.
Gate logs are in `.tmp/gates-crt-review-fixes/`, including the original failed
assertion and the corrected run. Installed binaries were invoked directly
because the local runner could not spawn `pnpm`; dependencies were not changed.

### Live evaluation

Mode achieved: **live-two-client**, automated Chromium with touch emulation,
not a physical phone. DM elevation, CRT toggles, repeated mobile taps, and map
drawing used actual UI input. The development seam only read snapshots/camera.
The player's independent preference survived reload, the DM's drawing arrived
on the player, and turning the DM's CRT off left the player's effect on.

| Criterion             | Weight | Score / 10 | Evidence                                        |
| --------------------- | ------ | ---------- | ----------------------------------------------- |
| Functionality         | 0.35   | 8          | Both states persist; blocked storage works      |
| Multiplayer integrity | 0.30   | 8          | Local toggles; drawing reaches the other client |
| Craft                 | 0.20   | 8          | Stable treatment; panel softening retained      |
| Reach                 | 0.15   | 7          | 375px touch UI, 44px tile, landscape verified   |

Weighted score: **7.85/10** for the tested scope. No new functional or visual
regressions found in this run. Persistence and reproducible coverage improved;
the CRT CSS itself is unchanged since the original comparison. Physical-device
frame pacing and fractional-scaling appearance remain unverified. This evidence
supports another review; it is not merge approval.

## Before merge

On the owner's normal desktop browser and one physical phone, compare the same
map pan with CRT off and on. Review text, grid, and token readability; verify the
preference after reload and panel softening. Check fractional desktop scaling as
well as 1x/2x if used. Remove the optional phosphor tile if it produces visible
interference on the target display. Hardware performance validation remains pending.
