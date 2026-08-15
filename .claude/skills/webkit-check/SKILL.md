---
name: webkit-check
description: Run HeroByte's mobile layout spec under WebKit locally, to check the mobile shell still renders on Safari's engine. Use whenever the user asks to check WebKit or Safari, wonders whether a mobile CSS change breaks on iPhone/iOS, or after touching the mobile shell, dock, or tool sheet styles. Also read this before claiming the mobile E2E suite "isn't a real mobile test", and before adding any webkit project to playwright.config.ts — CI installs chromium only, so that change goes red on push.
---

# WebKit Check

A local, on-demand answer to one question: **does the mobile shell still render under Safari's engine?** It is deliberately not wired into CI — run it by hand when mobile CSS changes and you want reassurance, then forget about it again.

## Run it

```bash
node .claude/skills/webkit-check/scripts/webkit-check.mjs --headed
```

Any extra flags pass straight through to Playwright (`--headed`, `--ui`, `--debug`, `--repeat-each=3`). Drop `--headed` for a quiet pass/fail. Expect ~20s including the server build; the two tests themselves take about 3s.

First run on a new machine needs the browser, installed through the project's own Playwright so the revision matches what `playwright-core` expects (1.56.0 wants webkit rev 2215 — a global `npx playwright` pulls a newer Playwright and the wrong build):

```bash
pnpm exec playwright install webkit
```

## What it proves, and what it doesn't

It runs [apps/e2e/mobile-layout.spec.ts](../../../apps/e2e/mobile-layout.spec.ts) — two mouse-driven tests asserting the dock (Party/Dice/Log), the tools sheet (Ping/Measure), the map board, and the dice roller all render and toggle at 390×844.

That catches engine-level CSS divergence: `100vh` vs `dvh`, `-webkit-` prefixes, flex/grid quirks, `backdrop-filter`. It is a coarse net — it would catch "the dock vanished in WebKit", not "the sheet is 8px off".

Its first real run found something, and not a rendering bug: the room reset refuses while a client
is still authenticated, and WebKit closes the previous test's socket later than Chromium does, so
the second test died on a bare 500 from `/__e2e/reset`. Fixed in
[fixtures.ts](../../../apps/e2e/fixtures.ts) (a bounded retry) and
[routes.ts](../../../apps/server/src/http/routes.ts) (409 with the reason). If this run ever fails
in the join step rather than an assertion, suspect that race again before suspecting WebKit.

It is **not iOS Safari**. Playwright's WebKit build shares WebCore but not the iOS shell, so it will never reproduce address-bar collapse resizing the viewport, safe-area insets, real touch, or pinch-zoom. When someone needs certainty about those, the honest answer is a real iPhone, not a louder test. Say so rather than implying this run covered it.

## Why the script exists instead of a plain command

`--browser=webkit` is rejected outright whenever the config defines projects, which [playwright.config.ts](../../../playwright.config.ts) does:

```
Error: Cannot use --browser option when configuration file defines projects.
```

So the engine has to be swapped through a config. The script writes a throwaway one at the repo root — root specifically, because a spread `baseConfig` re-resolves `testDir: "./apps/e2e"` relative to whichever directory the new config lives in, so a config parked inside this skill folder would resolve to a path that doesn't exist. It overrides `browserName` and nothing else, so a failure is unambiguously WebKit's fault rather than a viewport or touch difference, and it deletes the temp config in a `finally` plus on SIGINT so a crashed or interrupted run can't leave the working tree dirty.

## Do not point this at apps/e2e/mobile/

All 14 specs there route gestures through `page.context().newCDPSession(page)` ([touch.helpers.ts:30](../../../apps/e2e/mobile/touch.helpers.ts:30)), and CDP is Chromium-only — the session throws on a webkit context. This is not a gap to close: the header comment at [touch.helpers.ts:4](../../../apps/e2e/mobile/touch.helpers.ts:4) explains that `page.touchscreen.tap()` is single-point with no touchMove, so it cannot satisfy the drawing tool's `>1 point` gate at `useDrawingTool.ts:192-195`, and `evaluate`-synthesized `TouchEvent`s arrive `isTrusted === false`. Porting that suite to WebKit would prove strictly less than it proves today.

The script hardcodes the one portable spec for exactly this reason. If you widen it, you are re-litigating a settled decision.

## The Pixel 7 suite is not fake

If an agent flags `mobile-chromium` as "not a real mobile test", that framing is wrong and worth correcting. `devices["Pixel 7"]` under chromium *is* Blink — the same engine every Android user runs. The genuine gap is iOS, and this skill is how you probe it. Do not let the complaint talk anyone into rewriting a working suite.

## Before making it permanent

CI installs chromium only, at [ci.yml:162](../../../.github/workflows/ci.yml:162) and [ci.yml:214](../../../.github/workflows/ci.yml:214). Adding a webkit project to `playwright.config.ts` without editing both lines passes locally and fails on push. It also adds ~60s of browser download per job to guard two visibility assertions — decide that tradeoff deliberately, and run `/verify-gates` before pushing it.
