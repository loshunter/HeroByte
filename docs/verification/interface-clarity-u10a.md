# U10a — the words

**Status: ACCEPTED by the owner (2026-10-01) and committed on `dev` (see `git log`), not pushed.** The
four `PROMPT-*.md` files stay untracked. The slice is one commit by explicit paths; the server password
fix the owner ruled in between U10a and U10b is a separate commit (see "Found on the way").

U10 was split into U10a (words), U10b (keyboard, focus, touch) and U10c (journeys, ledger, report,
arc review) on the owner's word. This is U10a. U10b and U10c are not started.

## Owner decisions (2026-10-01, before building)

- **Split:** U10a / U10b / U10c, each with its own ladder, acceptance and commit.
- **Q2 (Table button):** drop the role word for players; a DM keeps a "DM" mark; the accessible name
  keeps the role.
- **Q3 (wrong file):** name a file that matches none of HeroByte's kinds, **only** then. A file that is
  recognisably a table backup or a character with one bad field keeps its field message. The test must
  show an old-format backup still loads.
- **Q5 (popover focus), Q6 (phone ✕):** yes, both, in **U10b** (conditions in "U10b's list" below).
- **Q8 (playtest guide, "To Change Passwords"):** the owner gave the procedure; one part is held back
  (see "Found on the way").
- **Q9 (DM header is three rows), Q11 (mute mark), Q14 (toast over the reconnect notice):** leave, with
  conditions U10b and U10c carry.
- **Token shelf chip:** "This table", badge "ADDED" (not "My uploads": the tokens can be links, and the
  badge cannot say who added one).
- **Recenter:** rename to "Reset view". The desktop button's visible text is "Reset" (accessible name
  and tooltip "Reset view") because the longer word wrapped a DM's Play tools to a second row at 1280 px.
- **Review close:** at the 3-round cap, repair P1+P2, one fresh read of the repairs only, no round 4.
  Fix the P1 by keeping tooltips short and putting the seat caveat in the help once.

## What U10a changes

| Term / control | Before | Now |
| --- | --- | --- |
| Template shapes | no description; help said "Circle / Square / Line", "Rect" | a one-line description under the active template (desktop under the buttons, **phone above the chips**) and as a desktop tooltip; help names Burst (a circle), Cone, Cube (a square), Bolt (a line) and how the map labels them |
| Ping | header tooltip "Point at locations…"; "everyone sees it" | one shared tooltip (`components/layout/viewWords.ts`): a player's ping reaches the DM and players who can see the spot, a DM's ping reaches everyone (what `recipientFilter.ts` does); phone buttons got it too |
| Recenter | "Reset camera to center of map" (false: it is x0 y0 at 1×) | **Reset view** everywhere; tooltip and help say "the origin (0, 0) at the top-left of your view, at 100% zoom, not the middle of the map" |
| Populate chips | desktop raw ids ("structures", "decals"), phone "Structs", "Wear", "Med" | one list (`map-edit/populateLabels.ts`): Objects / Structures / Terrain / Decals, Low / Medium / High, both layouts, Generate's density too |
| Rope / curve | "Curve (rope)" / "Curve"; selected element "Curve" | "Rope / curve style"; element label "Rope / curve" |
| My Stuff | `starterTiles.ts` label "My Stuff" | "My uploads" |
| Token shelf | chip "Custom", badge "MINE", preview "Shared with this table" | chip "This table", badge "ADDED", preview "From this table's shelf (players never see the shelf)"; help and guide say players never receive it |
| Private dice | ME: "the DM included" (false); no audience on a phone | ME "Only you see this roll. No other player or DM is sent it."; DM "Only you and whoever is in DM mode, now or later, see this roll."; the chosen option's sentence is printed under the buttons (a phone has no hover; its buttons carry no duplicate title); roll-log badges "TO DM" / "ME ONLY"; the seat-claim caveat lives once, in the dice help |
| Table button | "MAIN HALL PLAYER ▾" | "MAIN HALL ▾"; a DM sees "MAIN HALL DM ▾"; offline and unknown role still show |
| Wrong file | "tokens must be an array", "missing a valid name" for a JSON that is none of ours | "That is not a table backup…" / "That is not a character file…", only when the file has none of a backup's parts (`snapshot`, `tokens`, `players`) or none of a character's (`name`, `hp`, `maxHp`) |
| Guides | old words, wrong claims | player, DM, map-editor, running-a-game, getting-started guides, `docs/playtest-setup-guide.md`, README brought in line; 43 guide screenshots regenerated and read |

Forwarders: **nothing removed.** Encounter's "+ Add NPCs…" and "Change in Table" are live links to
their new homes, the natural path, not obsolete entries.

Phone surface: every change above ships on the phone in the same slice (Tools/Build sheets, drawing
sheet, roller, Populate/Generate chips, Table screen unchanged in structure).

## Found on the way

- **Docs harness broke on the new tooltips** (four `getByTitle` selectors in
  `docs-screenshots.*.ts`). Fixed; the harness now passes for all four files.
- **The drawing sheet's history row is below the fold at 667×375** (a short single-column landscape).
  Pre-existing: it fails with a freehand tool and no hint. **Not fixed here;** U10b fixes it in its own
  commit (a red spec was not added to U10a).
- **Server finding, not U10a's, not fixed.** On a server whose `herobyte-room-secret.json` exists,
  `HEROBYTE_ROOM_SECRET` / `HEROBYTE_DM_PASSWORD` changes are ignored (`secretPersistence.ts`
  `loadSecretRecords` returns the persisted record before it reads the env). Read and confirmed in
  code by two review lenses; **never run.** The owner asked for it to be its own item: RED test first,
  then a fix, with the owner's go-ahead. The playtest guide therefore says only that the default
  table's passwords "are set on the server (see DEPLOYMENT.md)" and cannot be changed in the app.
  `DEPLOYMENT.md` lines 93 and 253 also disagree with each other.
- Pre-existing doc-image doubts the reader of the regenerated screenshots found, none from U10a:
  `mapedit-door.jpg` (door not on the east wall band), `mapedit-night-lights.jpg` (daylit, no torch
  pools), `pointer-ping.jpg` (no name label on the ping), `dm-menu-npcs.jpg` (a dropdown over a field).

## Measured bars

- Bundle **157.94 KB of 175** (U9: 157.08).
- Units: shared 29 files / 452 tests; server 165 / 2,786; client 537 files / 7,703 tests (4 skipped)
  — U9: 531 / 7,635; six new test files. The contention canary (`npx vitest run`, every file at
  once) passed (533 ran + 4 skipped files, 7,699 passed).
- e2e: **321 passed + 3 accepted skips**, 0 flaky (U9: 318 + 3): one new DM contrast test and a new
  `mobile/mobile-draw-template.spec.ts` (portrait and landscape).
- Structure guard: 22 baselined files, no new. `mobile-draw.spec.ts` is back to its committed content
  (359 lines with my additions tripped the guard; the checks moved to the new spec).
- Strict e2e `tsc`: **not run** (61 pre-existing errors at handoff).
- Verdana: the touched specs (table geometry, token library, phone token library, map-edit panels,
  drawing-template) pass with a style forcing Verdana on everything, run from temporary copies that are
  deleted. I did not independently confirm the injected style applied to every element.
- Header geometry with the longer label: "Reset view" wrapped a DM's Play tools to a second row on a long-named
  private table at 1280 px; the visible word is "Reset" and `interface-table-geometry.spec.ts` (9 tests,
  player and DM) passes.

## Live evaluation (`evaluate-live`)

**Mode: live-two-client**, on a fresh dev server's Main Hall (`Fun1`/`FunDM`), not a private table
(the Main Hall had no old seats on a fresh server). DM and player in separate tabs with pinned uids.
The scored pass was taken **before** the review repairs; a targeted re-check followed them (below).

Driven: the player's Table button (no role word) and the DM's ("DM"); Draw → AoE Cone on desktop (the
description appears) and AoE Bolt on a 375×450 phone; the dice roller on both layouts with the audience
line; a private roll **in both directions**: the DM rolled ME and the player's snapshot had no roll; the
player rolled ME and the DM's snapshot had none; the DM menu → NPCs & Monsters → Library with the
"THIS TABLE" chip.

| Criterion | Score | Why |
| --- | --- | --- |
| Functionality (0.35) | 8 | every changed control worked on both layouts |
| Multiplayer integrity (0.30) | 8.5 | the private-roll claim verified both ways on the wire |
| Craft (0.20) | 7.5 | on a 375×450 phone the roller's ROLL is below the fold (pre-existing; the new audience line adds ~21 px) |
| Reach (0.15) | 7.5 | phone drawing sheet and roller usable; short landscape still tight |
| **Weighted** | **≈ 8.0** | U9 8.0 |

### Re-check after the repairs (targeted, **not scored**; the owner asked for exactly this)

Mode **live-two-client** again (a DM on a 1280 px desktop tab, a player on a phone-layout tab at 375 px,
the Main Hall, pinned uids). U10c runs the full scored journeys and the `main` merge repeats the checks.

- **Header:** the DM's Table button reads "Table menu: Main Hall, Dungeon Master, online" with a "DM" mark
  (the player's showed no role word); the camera button shows "🧭 Reset", accessible name "Reset view",
  tooltip "Reset the view: the origin (0, 0)…". The DM's Play tools wrap to two rows at 1280 px: that is
  Q9, older than U10a.
- **Private roll, both ways:** the DM rolled ME and the player's snapshot held no roll; the player rolled
  ME on the phone and the DM's snapshot held only its own roll. The audience line read "Only you see this
  roll. No other player or DM is sent it." on both layouts; the phone's ME button carries no `title`.
- **Phone template hint:** the hint renders above the chips. At **375×667 the AoE Cone chip stayed at
  y 288.4 through freehand → cube → burst → freehand** (the sheet grows upward by ~46 px). At **375×450
  the chip moved 46 px**: the sheet is height-capped there, so the line pushes the chips down inside it.
  The e2e measures only 375×812 and 812×375, so it could not see this. **Known limit, U10b's list:** a
  height-capped sheet (a short portrait window, or a phone with its keyboard up).
- **Shelf:** the chips read All / Monsters / Townsfolk / This table; the empty shelf says "Nothing on this
  table's shelf yet."
- **Reset button's effect:** **not proven live.** A synthetic wheel did not zoom the Konva stage, so there
  was nothing to reset. It is covered by the header unit tests and `mobile-dock.spec.ts`, which asserts a
  real camera reset on the phone.

## Proof the tests can fail

Hand-made mutants, one per rule, each restored byte-for-byte (sha256 checked):

- **23 unit mutants** (template hint on each layout and the desktop tooltip; help "Rect" and the old
  template names; Recenter and Ping tooltips, incl. the phone dock; Populate "Structs"/"Med"/raw ids on
  desktop; Rope / curve label on both layouts; "My Stuff"; shelf chip and badge; ME title; the audience
  line; both wrong-file guards, the non-object message, the character guard and an over-eager variant;
  the Table button's role word). **All killed.**
- **11 more after the repairs** (ME title absolute; preview text; Generate desktop label and phone "Med";
  MobileSwatchRow constant id and missing group role; help Recenter term, origin wording and seat
  wording; header and phone-sheet label back to Recenter). **All killed.**
- **Browser mutants:** deleting the `.jrpg-button-primary .table-menu-button__role` colour rule fails the
  new DM contrast test (ratio 1 against 4.5); putting the template hint back below the chips fails the
  chip-shift spec by **50.2 px** portrait and **43.6 px** landscape.
- **Not mutant-proven:** the selected-element label "Rope / curve" in `ElementPropertiesForm.tsx` and
  `MobileSelectPanel.tsx` (reverting it passes every test).

## Review (`review-convergence`)

Four fresh read-only `opus` lenses a round (content, keyboard and touch, state and privacy, test
quality); the tree's fingerprint was identical before and after every round, so every round is valid.

| Round | Result | Union |
| --- | --- | --- |
| 1 | 4 FAIL | 2 P1 (docs harness titles; the legibility spec's fallback), ~18 P2 |
| 2 | 4 FAIL | 1 P1 (the ping copy was wrong for a DM), ~10 P2 |
| 3 (the cap) | 4 FAIL | 1 P1 (DM-roll line lacked the seat caveat), 9 P2 |
| Repair check (one lens, not a round) | FAIL | 0 P1, 3 P2 (hint position in help; snap-point words; restart gap in the seat caveat) |

Escalated at the cap; the owner chose "repair P1+P2, one fresh read of the repairs, no round 4". The
three repair-check P2s and the cheap P3s are fixed; the ladder was re-run after them.

Findings that mattered: the ping and DM-roll copy overclaimed who sees what (fixed to match the server);
a docs harness that would have failed silently outside CI; a legibility spec that stopped testing the
thing it was written for once the role word left the button (now a player name test plus a DM role test);
a phone sheet whose chips moved ~50 px when a template was armed (hint moved above the chips, spec added).

## Known limits and U10b's starting list

Handed to U10b by name (the owner asked for a named list, not a generic pile):

- **Owner's U10b conditions.** Popovers (Table menu, Help): take focus on open; return it to the launcher
  **only** on Escape or the toggle; an item that opens something else passes focus to that thing; **do not
  trap Tab** (tabbing out closes it). Update `TableMenu.u2.test.tsx` deliberately. Phone ✕: scoped
  `.jrpg-button.mobile-screen__close`, measure the glyph's computed size and prove it fails when the fix
  is reverted; grep for other herobyte.css classes losing to `.jrpg-button`, fix only on surfaces U10b
  touches, list the rest. Zoom decides Q9: if a header control is unreachable at 200% zoom it is a bug.
- Also U10b's: the 8 px chat text, the unassociated label in `CharacterCreationModal`, the microphone
  failure messages, reduced motion, the 44 px floor on every changed surface.
- **Review leftovers that are U10b's scope:** a live region or `aria-describedby` for the template hint and
  the roll audience line; Generate's groups (desktop group and label, Stone/Wood `aria-pressed`);
  `MobileSwatchRow`'s group is unnamed when it has no label (`MobileFloorPicker`); the active template
  button and the pressed roll-audience button repeat their line as a desktop tooltip; a sticky ROLL and a
  stable-height audience line on the phone roller; `aria-pressed` on the phone Tools sheet tiles; the Table
  button's visible "DM" against its accessible name "Dungeon Master"; the landscape Tool heading sitting
  lower than its neighbours (`align-self: end`) and the hint's height in 812×375; 320 px chips and a 320
  case in `mobile-map-edit-panels.spec.ts`; the phone `title` tests named "is described on the phone too".
- **Bug for U10b's own commit:** the drawing sheet's history row below the fold at 667×375.
- **Height-capped drawing sheet** (375×450 portrait): arming a template moves the chips ~46 px (measured
  live). Options for U10b: reserve the hint's height, or fold the description into the sheet's existing
  header row.
- **Copy leftovers:** "Paint"/"Erase" in the quick wheel (`mapEditWheel.ts`); the desktop Decorate chips
  have no visible "Decorate from"; the Ping phrase "players who can see that spot" does not say "right now"
  (explored ground is dimmed but sends nothing); straight and curly apostrophes differ between the
  tooltip and the help; `SessionTokenService.ts`'s "change both together" comment omits the two help entries
  that quote six hours; `DEPLOYMENT.md` L93 against L253.
- Pre-existing, from earlier slices and unchanged: Q9 (a DM's header is three rows at 1280 px — U10c
  records the measured map space and an IA-01 deferral), Q11 (no mute mark), Q14 (a toast covers the
  reconnect notice; revisit if the app ever raises a toast for a lost connection).

## Questions for the owner

1. ~~Accept U10a?~~ **Answered:** yes; committed by explicit paths.
2. ~~A live re-run after the repairs?~~ **Answered and done** (the targeted re-check above).
3. ~~The server password finding~~ **Answered:** its own small server commit between U10a and U10b, a
   failing test first. Rule for the fix: on every start the default table's passwords come from the server
   settings (the app cannot change them); private tables' saved passwords stay untouched; also check that
   `apps/server/src/http/routes.ts:80` reads the setting rather than the saved file and so may already
   disagree with what the server accepts.
4. Still open and **not U10's** (do not fold in): Q1 (two-table lockout), Q4 (characterless-seat phone
   row), Q7 (Reset to default on a private table), Q10 (a restore brings back a seat's record), Q13
   (DM-authority frames are queued by the transport).
