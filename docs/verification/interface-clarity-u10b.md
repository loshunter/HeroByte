# U10b — keyboard, focus and touch

**Status: ACCEPTED by the owner 2026-10-02, with one fresh read first (done, below), then committed.** Review ran
to the 3-round cap, then one fresh read of the round-3 and Verdana repairs (owner's rule: repair, verify, no round 4).
The `PROMPT-*.md` files stay untracked.

U10b is the second of U10's three parts (U10a the words, done; U10c journeys, audit ledger, comparison report and
the arc-level review, not started). Goal: every changed surface is operable by **keyboard and touch**, with named
controls, visible focus, a sensible focus order in and out of popovers, readable text and a 44 px floor.

## Owner decisions (2026-10-01; answered before building)

- **Popover focus (Q5):** both header popovers (Table menu, Help): take focus on open; return it to the launcher
  **only** on Escape or the toggle; an item that opens something else hands focus to that thing; never trap Tab.
- **Phone ✕ (Q6):** fix, scoped to `.jrpg-button.mobile-screen__close`; test the computed font size.
- **Q9 (DM header is multi-row):** a limit unless a control is unreachable at 200% zoom (measured below: none is).
- **Height-capped sheet:** reserve the tool line's height, **fill it when nothing is armed** with a general
  instruction, trim each description to two lines at 320 px, and test it by measuring every chip before and after.
- **Chat text:** the body face (`.jrpg-text-body`, 13 px), not a bigger pixel size; the phone composer 16 px (iOS
  zooms the page when a focused field is under 16 px); SEND and "Send to" keep the pixel face at 11 px.
- **Microphone failure:** a persistent inline status line (not a toast, not an alert), worded for the failure:
  denied, no device, **in use by another app**, no `navigator.mediaDevices` (needs https:// or localhost); the raw
  error stays in the console; the control reads off; Safari's own route only for Safari.
- Unchanged from earlier: Q11, Q14 left; "table" in copy only; no identity changes; Main Hall public on purpose.

## What U10b changes

| Surface | Before | Now |
| --- | --- | --- |
| Table menu, Help | focus stayed on the launcher; Escape left focus on the page | focus goes in; Escape/toggle return it; "Table settings…" focuses the DM menu's Table tab (desktop and phone); Tab off the last control closes and carries on after the launcher; Shift+Tab off the first (or the container) lands on the launcher; movement keys (arrows, WASD) pressed inside no longer step the token; if the focused control is removed while open (a connection blip) focus falls back to the menu |
| Leave DM mode dialog | nothing took focus | Cancel (the safe choice) takes focus, and again after a failed attempt |
| Phone ✕ (every screen) | 10 px glyph, 6 px 12 px padding (`.jrpg-button` won on load order) | 18 px, no padding, 44×44 |
| Chat | 8 px pixel face | messages and composer 13 px body face; SEND 11 px; composer and "Send to" 16 px on a touch device |
| Character name | `<label>` with no control | associated (`htmlFor`/`useId`) |
| Microphone failure | blocking `alert` with the raw error and a Safari hint on every browser | persistent `role="status"` line under the pressed mic button, per failure kind; one line even for a player with several characters |
| Phone drawing sheet | a template's line appeared above the chips (~46 px shift when height-capped) | an always-present line of at least two lines: the general instruction, or the template's description (≤ 66 characters; the snapping detail lives in the help topic); compact landscape layout from **640 px** (was 700) so the history row is on screen at 667×375 |
| Phone dice roller | ROLL below the fold at 375×450 and 812×375; audience line 1–2 lines | ROLL and CLEAR pinned to the bottom; the refusal message sits inside the pinned block; audience line a two-line minimum; `scroll-padding-bottom` so focus is not scrolled under the pinned block |
| Names and groups | unnamed groups, colour-only pressed state | Generate (desktop) Theme/Density groups with visible labels and `aria-pressed`; desktop Decorate rows labelled; `MobileSwatchRow` requires a name; Tools sheet tiles `aria-pressed`; Table button's name contains its printed "DM" (speech input); roll audience line a status, pressed button described by it and without a duplicate tooltip; range inputs show keyboard focus; curly apostrophes in the Ping tooltip match the help |

Phone surface: every change above ships on the phone in the same slice, **except the microphone**, which has no phone
control at all (the mic button is on the desktop Party card only).

## Found on the way

- **`DEPLOYMENT.md` failed `format:check`** at HEAD (a table row padded by hand in the unpushed server commit
  `f71ad5e5`). Not U10b's; formatted with prettier (a root file, not `docs/**`). It wants its own commit.
- **The microphone could be started twice** by a second press while the browser's prompt was pending (two streams, two
  level loops, a mute that stopped only the second, so the browser's mic light stayed on). Pre-existing; fixed with a
  one-start-at-a-time guard, own tests.
- **A stream leaked** when the audio setup after `getUserMedia` threw (the browser's mic light stayed on with no way to
  turn it off from the app). Found while reading the hook (the owner's lead); fixed, RED first.
- **My own regression, caught in review:** the round-1 repair `.player-card-mic-notice:empty { display: none }` took the
  always-mounted live region out of the accessibility tree (three lenses). Repaired with a visually-hidden empty state
  and a browser test that asserts a role query finds the empty region.
- **Load-order grep (`herobyte.css` classes that lose to `.jrpg-button`):** only `mobile-screen__close` lived in
  `herobyte.css` and it is fixed. Three more classes sit on a `.jrpg-button` in component stylesheets, listed, **not
  fixed**: `.table-menu-button` (`table.css` asks 8 px; measured **10 px**, and the header was tuned and tested at 10 px,
  so the comment there is wrong and the "fix" would shrink it), `.map-edit-decoration__fire` (order unverified, lazy
  chunk), `party-bar__hide` (no rule at all).
- **Wide fonts found two defects in what I had just built** (the Verdana pass, after review): a template description
  needed three lines in the 640 px landscape Tool column, so the reserved slot grew and the chips moved; and the History
  chips' labels spilled into their neighbours at 320 px and 640 px. Descriptions shortened to ≤ 66 characters;
  `overflow-wrap: anywhere` on the **History** chips. CI's Linux fonts are as wide as Verdana: those checks would have
  been red there.
- **The fix for that broke the freehand-stroke spec** (`mobile-draw.spec.ts:40`, 3 of 3 runs), caught by the final
  ladder, not by review: I had put `overflow-wrap: anywhere` on every chip in the sheet, which erased the Tool chips'
  minimum width (they are sized by their longest word on purpose, so "Freehand" never breaks mid-word). Scoped to the
  History chips; the mutant that removes that rule fails the History spec under Verdana.

## Measured bars

- Bundle **159.64 KB of 175** (`build:check`, separate from e2e); U10a 157.94 (+1.70).
- Units: shared 29 files / 452 tests; server 166 / 2,792; client 550 files / 7,813 tests (4 skipped). The contention
  canary (`npx vitest run`, every client file at once): 550 files passed + 4 skipped, 7,813 tests passed.
- e2e: **358 passed + 3 accepted skips**, 0 flaky (U10a 321 + 3): 8 new specs and extra viewports. The three skips are
  `map-navigation.spec.ts:138`, `:191` and `ui-state.spec.ts:91`, unchanged.
- Structure guard passes (the gates ran it). New e2e specs are 36–224 lines, all under the 350 guard.
- Strict e2e `tsc`: not run by me (the owner's review ran it for U10a: 61 older errors, none on added lines).
- Verdana: the touched specs (13 files) run with a style forcing Verdana on every element, from temporary copies that
  are deleted. After the two fixes above, all pass except one assertion, the chat spec's "SEND is in the pixel face",
  which a style that overrides every font-family cannot satisfy by construction.

## Live evaluation (`evaluate-live`)

**Mode: live-two-client.** The dev server's Main Hall (`Fun1` / the DM password), a DM tab and a player tab with pinned
uids (`evalDM`, `evalPlayer`). Scored **before** the review repairs; the targeted re-check after them is below.

Driven: the DM through the Table menu, Enter DM mode and Table settings… with **real key presses** (focus landed on
"ENTER DM MODE", then the password field, then the DM menu's pressed Table tab; never the launcher); the DM's button
name read "Table menu: Main Hall, DM, Dungeon Master, online"; a real `NotAllowedError` from the pane produced the blocked
line, `aria-describedby` wired, the control off; chat DM → player (13 px, composer 16 px, one row with SEND, at 375×450);
the roller at 375×450 (ROLL bottom at 428 of 450; the audience line 31 px for TABLE, DM and ME; ROLL's y constant);
the drawing sheet at 375×450 (the line 31 px in all six states, no chip moved, toolbar bottom 348); the Tools tiles'
pressed state; the Table screen's ✕ (18 px, padding 0, 44×44).

| Criterion | Score | Why |
| --- | --- | --- |
| Functionality (0.35) | 8.5 | every changed control worked, by keyboard and by touch |
| Multiplayer integrity (0.30) | 8 | chat reached the player; nothing changed what is sent or redacted |
| Craft (0.20) | 8 | the mic line is readable on a 132 px card; the roller and sheet hold still |
| Reach (0.15) | 8 | phone checked at 375×450 and the desktop popovers by keyboard; no real device |
| **Weighted** | **≈ 8.2** | U10a 8.0 |

### Zoom, reduced motion, emulation (the record the owner asked for)

- **200% zoom was emulated by halving the viewport, not by browser zoom** (neither `style.zoom` nor an emulated size is
  a real zoom). The app takes its phone layout whenever the viewport is ≤ 700 px wide, or ≤ 520 px tall and ≤ 900 wide,
  so a real 200% zoom reaches the **desktop** header only on larger screens. Measured as a DM: **960×540**
  (a 1920×1080 window at 200%): 14 header controls, all in view and hittable, 210 px of map band. **768×540** (a
  1536×1080 window): the header wraps to 8 rows, 43% of the height (234 px), 177 px of map band, **all 14 controls in
  view and hittable**. 720×450 and 768×432 are the phone layout (the pane also emulates touch below 768 px), so they say
  nothing about the header. By the Q9 condition this is a **limit, not a bug**; U10c records the 1280/1366 numbers.
- **Reduced motion:** no transition, animation or `scrollIntoView` was added (grep of the diff); nothing new to respect.
- Every phone and touch figure is a Chromium emulation; **no iOS, Safari or WebKit run, no physical device**.

## Proof the tests can fail

About **90 hand-made mutants**, one per rule a new test claims, each restored byte for byte (sha256 checked), run in
batches (popover 12, chat and ✕ 7, drawing sheet 10, mic 14, labels/groups/names 14, and the three repair rounds 15, 11
and 6). All were killed except, recorded and explained: (a) two popover mutants survive the **browser** spec only (a
stray `launcher.focus()` after a click elsewhere is overridden by the browser's own mousedown focus; the DM menu takes
focus after "Table settings…"), both killed by the unit tests; (b) restoring `align-self: end` on the Tool column does not
fail the heading-alignment spec (the Tool column is now the tallest, so it makes no difference): the spec guards the
outcome only; (c) the Populate chips at 320 px needed no change (the added 320 viewport passes). Two things the
mutants found wrong in the tests themselves and I fixed: the composer's 44 px floor was redundant (SEND stretches the
row; the rule was removed) and a vacuous "not on someone else's card" test.

## Review (`review-convergence`)

Four fresh read-only `opus` lenses a round (keyboard and touch, content and honesty, state and permissions, test
quality), the tree's fingerprint identical before and after every round.

| Round | Result | Union (unique) |
| --- | --- | --- |
| 1 | 4 FAIL | 1 P1 (the roller's refusal message hidden behind the pinned ROLL), 14 P2 |
| 2 | 4 FAIL | 1 P1 (my `display: none` regression), 10 P2 |
| 3 (the cap) | 3 FAIL, 1 PASS | 0 P1, 5 P2: the focus-recovery repair never armed on the default opening focus (two lenses; my tests had re-focused by hand), a mic restart after a mute untested, the modifier-key exemption untested, the filled notice's size/tree presence unproven, the roller's padding check measured against CLEAR rather than the pinned block |

All three rounds' P1 and P2 are repaired, each with a failing test or a killed mutant first; the round-3 repairs and the
Verdana fixes (above) are the only code **no fresh lens has read**. Plateau check: P2 14 → 10 → 5, converging.
Escalated at the cap; the owner answered 2026-10-02: spend the one fresh read.

**The fresh read** (one read-only `opus` lens on the round-3 and Verdana repairs, tree fingerprint identical before and
after; mode: static read plus 8 unit files, 89 tests, no e2e): **FAIL, 0 P1, 4 P2, 5 P3**. Repaired, each with a mutant
killed (restored byte for byte, sha256-checked):

- the roller's `scroll-padding-bottom` (96 px) was smaller than the pinned block with a two-line refusal (about 114 px),
  and the spec could not see it: padding is 120 px and the spec asserts the reserved padding is at least the block's
  height (a 40 px mutant fails 6 of 6);
- nothing checked that a mute stops the stream, the audio context and the level loop: the restart test now asserts all
  three and the last `mic-level` 0 (three mutants killed);
- the Alt and Meta exemptions in the popover key handler were untested (both mutants killed by the added keys);
- nothing checked that a one-word Tool chip never breaks its word: the template spec measures the chip's line count
  (moving `overflow-wrap: anywhere` onto every chip fails 3 tests).

Also fixed from the P3s: a failed first level read left the stopped stream in `micStream` (cleared; own test, mutant
killed). **Not fixed, recorded as known limits:** a popover can pull focus back after focus was moved out and the moved-to
element unmounted; a notice can appear under the wrong card for a player with two characters who starts both before the
first prompt settles; an unmount during a pending start leaks the stream (the hook lives in App); the Burst and Bolt
descriptions could say more about where the shape sits.

## Last checks (final tree)

- After the fresh read's repairs: the whole ladder again (`/verify-gates e2e`): shared 452, server 2,792, client 7,814
  units, **358 passed + 3 skips**, 0 failed, 0 flaky; the strict gates were red on the first pass only because my edit
  script wrote CRLF line endings (735 prettier errors); normalised with prettier, lint and format green, the touched
  units re-run (1,639 tests), typecheck clean. Before that the ladder was green on the tree (the fifth full run: lint, format, structure guard, both
  typechecks, 452 / 2,792 / 7,813 units, **358 passed + 3 skips**, 0 failed, 0 flaky). The fourth run failed one spec
  (the freehand stroke, see "Found on the way"); it was repaired and the whole ladder run again.
- **Targeted live re-check after the repairs** (live-two-client, **not scored**): the empty mic status region is mounted
  (1×1, `display: block`, `role="status"`), then a real refusal filled it (102 characters, 109 px wide, 96 px tall, in
  view, `aria-describedby` wired, the control off, a second press ignored); at 375×450 the roller's refusal
  ("formula has more than 16 terms") sat inside the pinned block at y 324–360, above ROLL, in view; at 667×375 all five
  history controls were in the window and inside the sheet, 44 px tall, no label spill. **Not re-driven live:** the
  focus recovery after a connection blip and the popover keys (covered by the real-socket-drop browser spec and the
  unit tests, not by the pane).
- The dev server and the pane's extra tab were stopped.

## Known limits and U10c's starting list

- **A reserved tool line costs 31 px on a 320×568 phone:** the sheet (433 px of controls in a 412 px box) now scrolls
  inside itself in every drawing state, where before it fitted unless a template was armed. At 375×450 it scrolled
  anyway (384 px in 294; 59 px without the line). Its last controls are reachable by scrolling the sheet (a spec
  measures reachability at either end). **Question 2.**
- Landscape screens narrower than 640 px (568×320, an iPhone 5/SE 1) still stack the drawing sheet in one column; its
  history row is below the fold there.
- **Q9 for U10c:** record the measured map space at 1280×720 and 1366×768, and the IA-01 deferral.
- Quick wheel still says "Paint" / "Erase" (its hub is 88 px wide; "Paint terrain" would be cut). Desktop Decorate says
  "Decorate from", the phone says "From". Not done: the Ping phrase "players who can see that spot" lacks "right now";
  `SessionTokenService.ts`'s comment omits the two help entries that quote six hours; `DEPLOYMENT.md` L93 vs L253.
- `.table-menu-button` runs at 10 px against a stylesheet that says 8 (fix the comment, or decide); `.map-edit-decoration__fire`
  order unverified.
- DM tabs use `aria-pressed` (not `role="tab"`); fixed element ids in `GeneratePanel` and `TemplateToolHint` (single
  mount today); a notice claimed by a card that unmounts while the prompt is pending shows nowhere; `useDMMenuState`
  under StrictMode (the app mounts none); `tabbablesIn` filters only `hidden`; the "Send to" 16 px value was not
  browser-measured (it needs a second player); the 11 px inline select on a mouse device.
- **Not observed:** real iOS zoom on focus, Safari's real menu path, a real 200% browser zoom, WebKit, a physical
  device, a screen reader (the live regions are asserted in the tree, not heard).
- Still open and **not U10's:** Q1 (two-table session lockout), Q4 (characterless-seat phone row), Q7 (Reset to
  default on a private table), Q10 (a restore brings back a seat's record), Q13 (DM-authority frames queued by the
  transport).

## Owner answers (2026-10-02)

Accept and commit (one commit per cleanly separable part: `DEPLOYMENT.md`; the rest of U10b as one commit, because the
microphone, the ✕, chat and focus rules share `herobyte.css`; then the docs); keep the always-present tool line (the
31 px is a known limit; a 320x568 phone's sheet scrolls but everything stays reachable, and a spec checks it); push
`dev` and watch CI before U10c starts.
