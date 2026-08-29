# Handoff — the mobile authoring arc is built; deciding how it ships

Written 2026-08-27 at `dev` = `36633e14`. Everything below was measured in this repo, not
recalled. Read `docs/planning/HANDOFF-NEXT.md` §2 (the gate), §5 (traps), §8 (method) and §9
(settled owner decisions) before touching anything — this file does not repeat them.

> **UPDATE (2026-08-29) — fork A is DONE, and it earned its keep.** The adversarial review of
> `16499eb2..c17e0ab7` ran clean (35 agents, `agents_error: 0`, tree audited unmutated): 22 raw
> findings merged to 8 distinct, **all 8 survived 3-of-3 adversarial verification**, and the
> completeness critic added a 9th (Ctrl-sample stole the armed tool). Every finding was
> hand-verified against the source before being believed, and **all nine are FIXED on `dev`**
> (`40c38179..45ead008`), each in its own commit behind the full §2 gate, every new test
> sabotage-proven independently. The two worst: ⨯ Abort did not stop a touch-aimed
> Place/Scatter/Light drop (`touchAim.cancel` had ZERO call sites), and both new mobile panels
> gated on `busy` where they meant `saving`. Baselines moved: e2e **165 passed / 3 skipped**,
> client unit **5416 tests / 36 batches**, all green at `45ead008`.
>
> Two of this file's own claims were WRONG and are corrected in place below: the map-studio
> controller **QUEUES** a command that arrives mid-flight (one in flight at a time,
> `useMapStudio.ts` `applyMessage`→`dispatchNextCommand`); the silent drop is the CLIENT-side
> `saving` gate in useMapEditPlacement/useMapEditTool, before the queue. And the 44px floor is
> THREE rules, two deliberately unscoped — `.jrpg-button` and chat's `.jrpg-text-small` inputs
> reach the whole document on coarse pointers, only the middle rule is scoped to
> `[data-mobile-surface]`.
>
> **B IS DONE TOO — this is IN PRODUCTION as of 2026-08-29.** The owner called it, and the
> recorded order held: push `dev` (CI **#819** green, `e2e-full-suite` confirmed RUN with its
> step at `success` — not the #796 skip) → fast-forward merge to `main` → push
> (`6a605af4..6dd9e864`) → CI **#820** green, whose `e2e-full-suite` checked out **main** at
> the pushed SHA, so the `ref: dev` conditional resolves correctly on a push → probe.
>
> **The probe, for the next person who has to do one.** Cloudflare had NOT published yet two
> minutes after the push, and the tell was not the markers reading zero — it was the entry
> bundle still being byte-identical to the pre-deploy baseline (`index-BRg7T1dK.js`). Poll
> the entry hash until it CHANGES, then probe; a zero read before that is a build that has
> not landed, not a failed deploy. After it published (`index-bl2h1vX2.js`): marker
> `dice-token__remove` **4 hits** across the JS _and_ the CSS asset, marker
> `Turn element clockwise` **1 hit**, control `Table password` **6 hits** (so the zeros
> earlier were real absences, not a broken method). A pre-deploy BASELINE run is what makes
> that argument — take one before merging. Server HTTP 200 after its usual restart 502s; the
> app mounts with "Connected" and zero console errors.
>
> **C's three items are untouched** and are now the only open work here.

## 0. Where things stand, exactly

_Superseded by the UPDATE above — this table is the 2026-08-27 snapshot, kept as history.
Both branches are now `6dd9e864` and that is in production._

| Branch | Commit     | State                                                    |
| ------ | ---------- | -------------------------------------------------------- |
| `dev`  | `36633e14` | 18 commits ahead of `main`. **Local only — not pushed.** |
| `main` | `6a605af4` | PRODUCTION, deployed 2026-08-26, CI #814 green           |

The working tree is clean apart from untracked files under `temp/`. Those are the owner's art
assets. **Never `git add temp/` and never `git add <directory>`** — a broad add swept them into
main once, and untracking them then deleted them off disk. Stage by explicit path, always.

The 18 commits, in order:

```
7083914a test(e2e): the initiative spec that asserted nothing now asserts five things
deb82b4c feat(map-edit): a finger can paint and erase terrain
cfa60f95 feat(map-edit): the phone's brush deck remembers what the desk pinned
6afbb90e docs(map-edit): the guides stop saying a phone cannot paint
edf7ec13 refactor(map-edit): the drag machine moves out of the tool hook
e9d6000a feat(map-edit): a finger places, scatters and lights — press aims, lift drops
bc694dd7 fix(mobile): three new tools must not cost the DM a row of map
79f91b1a docs(map-edit): every map tool is now reachable by finger
7b28f576 feat(map-edit): stamp-vs-tile and rotation get controls, not just keys
2e0ec737 feat(map-edit): the eyedropper becomes a tool, so a phone can sample
7c2f6c18 docs(map-edit): the three modifiers a phone has no key for
98045bc9 feat(map-edit): a touch DM can edit what they placed, and dim the lights
15dae9ae docs(map-edit): editing, layers, and what a phone costs you
c41a240d fix(mobile): the last two window.prompt() dialogs go
d32d12c5 fix(mobile): the 44px floor reaches the panels, not just the shell
0bdb498e fix(mobile): the touch floor covers the DM menu too
96c68da4 feat(vision): a token that inherits the table default says what it inherited
36633e14 docs: the mobile authoring arc is complete, and the handoff says so
```

**Full gate green at `36633e14`, e2e included.** Measured, not assumed:

| suite               | count                                            |
| ------------------- | ------------------------------------------------ |
| shared              | 424 tests / 24 files                             |
| server              | 2185 tests / 115 files                           |
| client              | 5403 tests (5399 passed, 4 skipped) / 278 files  |
| e2e chromium        | 90 passed / 3 skipped / 0 failed                 |
| e2e mobile-chromium | 71 passed / 0 skipped / 0 failed                 |
| entry bundle        | 107.20 KB of a 175 KB budget (67.80 KB headroom) |

Previous recorded baselines were client 5302 / e2e 134 / bundle 103.05 KB, so the deltas are
+101 client tests, +27 e2e, +4.15 KB — and the bundle figure includes the initiative and dice
slices as well as this arc. **Do not mix that number with a `gzip -9` figure**; it is
`build:check`'s own measure.

## 1. What to do next — this is a FORK, nothing is queued

### A. Adversarial review before shipping (recommended)

§8 makes this the house rule: "adversarial review before declaring done — and check
`agents_error`. A review that never ran returns the same shape as a clean one." Every arc of
this size has had one: S8's ran 70 agents and found 7 real defects; M5's ran 39 and found 2.
This arc is 18 commits and touches the input layer every tool depends on, which is the part
most likely to have a defect no single-slice test would see.

If you run one, the range is `16499eb2..36633e14`. Lenses worth having, given what this arc
actually changed:

- **The compat-mouse claim.** `useTouchGestureRouter` now calls `preventDefault()` on the
  touchstart a tool takes ownership of. That is a change to the input layer EVERY touch tool
  shares — drawing, marquee select, the camera. What else did it quietly change?
- **`select` and `eyedropper` are deliberately NOT `TouchTool`s** and depend on the compat
  pair still firing. Is anything else in that position?
- **Optional forwarding props.** `mapEditPlacementDials` and `tableVisionDefault` both ride
  optional props through 3–7 components. §5 and the vision plan both record that shape as the
  M4b defect: deletable with a green typecheck and every suite passing.
- **The touch floor is now a broad CSS rule**, matching every button, select, textarea and
  text input inside `[data-mobile-surface]`. What did it resize that nobody looked at?
- **Batching vs the in-flight queue.** The mobile inspector batches into one `update-element`
  on Apply because per-tap commands would each round-trip and land as their own undo entries —
  the controller QUEUES one-in-flight (the premise "it drops" was wrong; the drop is the
  pre-queue `saving` gate). Are there paths that still fire per-tap? _(Answered: the panels
  gated on `busy`, so their throttles were inert — fixed, see the UPDATE above.)_

Review agents must be read-only, and `git status` must be audited afterwards — a past run left
a mutation probe in the tree.

### B. Push and merge

Push is safe on its own; **merging to `main` deploys**. Render watches `main` from its own
dashboard, so the deploy is NOT gated by CI (`DEPLOYMENT.md:24-26`), and players holding a tab
open from before must reload or they blank silently.

The order that has worked: push `dev` → `/watch-ci` → merge → `/watch-ci` again → probe
production with a discriminating string (see the deploy-probe note in §5; a bundle-hash
comparison cannot work here, because Cloudflare bakes `VITE_WS_URL` in). **Do not merge without
the owner's word.**

### C. The three items this session deliberately did not close

1. **`docs:screenshots` fails partway, and the Map Setup shot is wrong.**
   `apps/e2e/docs-shots.helpers.ts:114` does `expect(page.getByText("saving…")).toBeHidden()`
   and "saving…" now resolves to TWO elements — `MapEditToolbar.tsx:145` and
   `MapStudioControl.tsx:279` (` · saving…`). Strict-mode violation, so the map-authoring
   walkthrough dies and `mapedit-*.jpg` are only ever partially re-recorded. **Verified
   pre-existing** by reproducing it with this session's client changes stashed out. Separately,
   `dm-menu-map-setup.jpg` is meant to document the Map tab but the harness leaves the panel
   scrolled to the Player Staging Zone, so it never shows the Default sight radius control the
   vision slice added — a re-record does not fix it; it needs a new step. This is the last open
   vision-default follow-up.
2. **A server test flake.** `TokenMessageHandler.test.ts` › "should recolor token when owner
   requests it" failed once in a full `pnpm test` run on 2026-08-27 and passed on an isolated
   re-run (23/23) and on a second full run. Most likely a random-colour collision against an
   assertion that the colour CHANGED. Seed or inject the RNG rather than loosening it —
   `cryptoDiceRng` is the one-RNG-caller pattern this repo uses.
3. **My Stuff uploads in the mobile asset picker.** The phone's Place/Scatter picker offers
   every BUNDLED asset; a DM's own uploaded art still needs a desktop. Deliberate: uploads need
   the pipeline and its quota errors, and when it lands it wants `ImageField` — the surface
   every other mobile upload already goes through — not a port of the desktop popover.

## 2. What the arc actually changed, if you have to touch it

**The mechanism that unlocked everything.** `useTouchGestureRouter` cancels the touchstart a
tool claims. Before it, a touch TAP synthesised a compat mouse pair that re-ran the same
handlers — **measured at 2 `paint-terrain` commands for one tap, 1 after.** Only when a tool
owns the finger, so `mobile-draw.spec.ts`'s idle-tap recorder is unchanged and `select` /
`eyedropper` still resolve on the compat path exactly as before.

**Every "cannot be armed on touch, it would double-fire" comment in the tree is now history.**
What keeps a tool off touch is aiming, never doubling. If you find such a comment, it is stale.

**Click tools have a DIFFERENT gesture from a mouse**: press AIMS, release DROPS
(`useMapEditTouchAim`). The map-edit handlers take an `input: "mouse" | "touch"` discriminator;
the touch router is the only caller that knows which device is driving, and nothing else cares.

**Two extractions, both predicted by the handoff:**

- `useMapEditTool.ts` (347 of a 350 cap) → `useMapEditDragGesture.ts` takes the drag lifecycle.
  Behaviour unchanged; the characterization suites are what say so.
- `useMapEditState.ts` (348 of the cap) → `usePlacementDials.ts` takes the armed asset, the
  picker flag, stamp-vs-tile and rotation. Alt and R still work and now write the SAME state
  the on-screen buttons do.

New files worth knowing: `commitClickTool.ts`, `useMapEditTouchAim.ts`,
`useMapEditDragGesture.ts`, `usePlacementDials.ts`, and under `features/map-edit/mobile/`:
`MobileAssetPicker`, `MobileElementInspector`, `MobileLayersPanel`.

## 3. Traps this arc paid for — these will recur

- **Adding a tool tile costs MAP.** The sheet is bottom-anchored, so a new grid row is ~56px a
  DM can no longer tap. It matters most in Select, the one mode where you must tap the map WITH
  the sheet open. Measured: three tiles moved an 820×1180 tablet's sheet top from 588px to
  533px and broke a spec that tapped "empty canvas" at 566px — which read as a selection bug.
  The column count is now DERIVED (`repeat(auto-fill, minmax(120px, 1fr))` at ≥700px) because a
  hand-picked five columns fixed it and broke again one commit later.
  `mobile-map-edit-panels.spec.ts` holds a floor on the MAP, not a ceiling on the sheet.
- **A tile snaps to the NEAREST cell corner**, so the point that PLACED it is not inside it —
  doc (176, 295) on a 50px grid lands the tile at (200, 300). Aim any sample or select at
  `firstElementScreenPos` (in `apps/e2e/mobile/mobile.helpers.ts`), never at the placing point.
  A first version of the eyedropper spec tapped where it had placed and sampled nothing.
- **Select cannot tap the map on a PHONE with the sheet open** — measured, the sheet spans
  y 79..742 of 844. The selection SURVIVES closing and reopening, so the phone workflow is
  arm → ✕ → tap → ⚒ Tool. Tablet specs use 820×1180 and keep targets in the upper third.
- **An e2e can pass for a neighbour's reason.** Two cases this session: (1) "a second finger
  abandons the drop" stayed GREEN with `useMapEditTouchAim.cancel` sabotaged, because the
  router stops calling `commit` either way — the ghost half needed a unit test; (2) chat's SEND
  and its message box share a flex row at default `align-items: stretch`, so whichever has a
  44px floor lifts the other, and removing either CSS rule alone left the assertion green.
  Sabotage each rule INDEPENDENTLY, not just the pair.
- **`git checkout -- <file>` during a sabotage pass destroys uncommitted real work**, and does
  nothing at all for an untracked new file (the sabotage silently survives). Copy the file to
  `$TEMP` first and restore from there.
- **The 350-LOC guard is not exempt for e2e specs.** `mobile-map-edit-place.spec.ts` crossed it
  and had to split; the exemption is the `.test.` filename pattern, not the directory.

## 4. Non-negotiables

- Run the FULL §2 gate before every commit. `pnpm lint:structure:enforce` is **not** part of
  `pnpm lint`, and `format:check` covers e2e specs and markdown that `pnpm lint` does not.
- Prove every test can fail before you commit it. When a sabotage stays green, suspect the test
  first — but check the sabotage too, and watch for one that goes red for the wrong reason.
- Fix bugs you find regardless of origin, each in its own commit. This session found two that
  way: the DM's own card had never been given the sight-radius control despite
  `PlayerSettingsMenu`'s own note saying it should, and the tool sheet was eating map.
- Ship the mobile surface in the same slice, and measure it in a browser rather than computing
  it.
- Do not poll a background agent or a Workflow. They notify.
- Commit to `dev` as you go. **Do not push and do not merge to `main` unless the owner asks.**
