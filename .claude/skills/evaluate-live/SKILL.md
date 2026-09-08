---
name: evaluate-live
description: Score the running table in a real browser instead of reading the diff. Use after shipping a slice, before any merge to main, and whenever the user asks "does it actually work", "check it in the browser", "try it at the table", or wants proof beyond green gates. Green gates prove the code builds and the specs pass; they cannot see a feature that is unreachable, unreadable, or silently one-sided across two clients. Pairs with review-convergence, which gates the verdict.
---

# Evaluate Live

Adapted from ECC's GAN evaluator. The premise worth stealing: **a reviewer that reads the diff, and a reviewer that drives the product, find disjoint sets of bugs.** Every HeroByte review to date has been the first kind. The gizmo drift bug, the party drawer's missing second character, and the door players could not click were all diff-clean.

## The rule that makes it worth anything

**Two clients or it did not happen.** HeroByte's product is what a DM and a player see *simultaneously*. A single-window pass cannot see fog divergence, nameplate or monster-HP redaction, whisper leakage, hidden-NPC names in the log, or a broadcast that never arrived. Open both:

1. `preview_start` with `{name: "dev"}` — client on 5174, server on 8787.
2. `tabs_create` a second tab; pin identity with `?sessionUid=` per tab, because two tabs otherwise fight over the same session. **`navigate` strips query strings** — set the URL once and do not re-navigate.
3. Log in as `FunDM` in one and `Fun1` in the other, same table.
4. Drive the DM tab; assert in the **player** tab. A change that only looks right in the tab that made it is unverified.

## Driving the canvas

- **Konva ignores synthetic drags.** Dispatch real `MouseEvent`s on `.konvajs-content`; `computer` clicks work for buttons and panels but not for stage drags.
- `window.__HERO_BYTE_E2E__` is the dev-build seam — use it to read state, never to *cause* the behavior you are evaluating.
- Mobile: `?mobile=true` forces the layout, `resize_window` with the mobile preset gets the touch emulation. Check the 44px floor against real rendered boxes, not the CSS rule.

## Edge cases that have actually bitten

Test these, not a happy path:

- **Rapid repeated taps** on any map-edit tool — compat-mouse doubling measured two paint commands per tap.
- **Reconnect mid-session** — snapshot-derived `isDM` has read FALSE on reconnect.
- **A gesture during a save** — there are two saving gates (drag and placement); a dropped gesture must toast, not vanish.
- **Long and unicode text** in names, chat, and nameplates.
- **A lazy chunk that fails to load** — React caches the rejection forever and one failed fetch kills the whole module graph blank.

## Scoring

Weighted, with an explicit threshold — a number forces a verdict where prose lets everyone off. Re-weighted from ECC's design-heavy greenfield rubric for a live product:

| Criterion | Weight | Asks |
|---|---|---|
| Functionality | 0.35 | Does every path in the slice work, including its error and empty states? |
| Multiplayer integrity | 0.30 | Is what each client sees correct *and* correctly redacted? |
| Craft | 0.20 | Feedback on every action — loading, saving, failure. No silent drops. |
| Reach | 0.15 | Does it work with a finger, at 375px, on the mobile shell? |

**Pass at 7.0.** Anchor the scale or it drifts: 1–3 broken; 4–5 works but visibly unfinished; 6 unremarkable, missing polish; 7 solid; 8 professional, rough edges; 9 polished; 10 shippable as-is.

Score against the **JRPG/CRT identity** the project already has — Press Start 2P headings, the established palette — not against generic "modern web" taste. A change that looks clean but off-theme is a finding.

## Report the mode you achieved

State plainly which of these actually happened, never which was requested:

- `live-two-client` — both tabs driven. The only mode that can clear a multiplayer finding.
- `live-single` — one client only. Says nothing about redaction or sync.
- `static` — browser or dev server unavailable, diff read only.

A `static` run reported as a live one is worse than no run, because it launders an unverified change as verified. If the dev server will not boot, say so and stop — and remember a `packages/shared` export can boot-fail the server while every gate stays green.

## Output

Score table, then findings ranked critical / major / minor. **Every finding carries a concrete fix with real values**, the exact reproduction (which tab, which click, which order), and a screenshot for anything visual. Then what improved and what **regressed** since the last evaluation — round-2 fixes break round-1 passes, and only a fresh pass over the whole surface sees it.

Hand the result to `review-convergence` for the gate. This produces evidence; it does not decide.
