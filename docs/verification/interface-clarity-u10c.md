# U10c — the journeys, the audit ledger and the arc's close

**Status: ACCEPTED, PUSHED (`3c4f659c`, CI #917 green); the phone-parity gaps below were closed by [U10d](interface-clarity-u10d.md).** U10b was accepted, fresh-read, committed (`51ef5bf3`) and pushed with `dev`
(`335bf94f`); CI #916 passed on it before U10c began. U10c is the last part of U10: the five plan section 7 journeys, the
audit's disposition ledger, the comparison report and the arc-level review. It found and fixed real defects on the
way (own commits, below). `main` is `7f63156b` (2026-09-22) and holds none of this arc.

Deliverables: [the comparison report](interface-clarity-report.md) (journeys, before/after images, measured map space,
the name-and-size sweep, findings, limits), [the disposition ledger](interface-audit-2026-09-22.md) (every `IA-xx`),
this record, the plan banner (the arc is marked built, with its deferrals and the unmet phone-parity "Done when" named), and the list at the end of what
to do before merging to `main`.

## What U10c did

- **Ran the journeys live with two clients** (a DM tab and a player tab, one disposable private table, pinned uids):
  desktop 1366×768 and 1440×900, phone 375×812 (touch emulation), tablet 768×1024. The step-by-step results, the gaps
  no spec or live pass covers, and what was not run are in [the report](interface-clarity-report.md) section 3. Mode
  achieved: **live-two-client**, all of it Chromium emulation.
- **Swept every visible control** on the phone's surfaces and on the desktop's windows and tabs for a name and (on
  touch) a 44 px target. It found two unnamed sliders on the DM's Maps tab (both layouts) and the NPC card's two icon
  buttons (desktop), and nothing under 44 px on the phone; **it could not see** hidden controls that stayed focusable,
  or names that do not say which item (the review found both).
- **Filled the audit's disposition ledger** (all 20 findings; 17 fixed, three fixed in part with a named deferral,
  none "not reproduced").
- **Wrote the comparison report** with 10 before/after pairs (only two share the before's viewport; the report says so).
- **Ran the arc-level review** (below).

## Defects found (each its own commit, RED first)

Mutants were run and killed for `9a4e1456`, `40d59a42`, `42782656`, `94e67d92`, `7d5bc64e`, `9034503c` and `6504cc19`; the whisper (`1ff39cd5`), dock (`bd910344`) and help (`b058f30b`) commits have tests that assert their rule but no recorded mutants.

| Commit | Defect | Proof |
| --- | --- | --- |
| `9a4e1456` | The DM's **Ambient light** slider, and the two Layers sliders, were `disabled` while saving; a browser takes focus off a control that becomes disabled, so after one arrow-key step the next key landed on the page. Reproduced live (two quick keys: one step, focus on the page). | New `interface-ambient-focus.spec.ts` holds the DM socket's replies back (a local server settles in ~1 ms, which is why single presses never showed it): RED on the old code (`Expected: focused, Received: inactive`; the first version of the spec, before `6504cc19` rewrote it to stop `press()` focusing the slider first, and the rewrite was not re-run RED on the old code), GREEN after; a live burst of four presses kept focus. Four mutants (each slider back to `disabled`; the onChange guard removed) turn unit tests red; the U5 test that pinned `toBeDisabled` pins `aria-disabled` and "a change while saving is ignored". |
| `40d59a42` | The NPC card's visibility toggle and settings button were an eye and a gear with the state in a hover title. | "Hide Goblin scout from players", "Show … to players", "NPC settings: Goblin scout"; titles kept. Six mutants turn `NpcCard.names.u10c.test.tsx` red. The ladder caught four unit tests and two browser tests (one spec file) that found the button by its glyph name; they use the new name (the one that asserts a player gets **no** such button would have passed vacuously). `NpcCard.tsx` went 6 lines over the 350 guard, so the names live in `npcButtonNames.ts` (16 lines; `NpcCard.tsx` is 344). |
| `42782656` | The Grid size and Square size sliders had a caption and no name. | Named, with units in `aria-valuetext`; four mutants turn `GridControl.names.u10c.test.tsx` red. |
| `94e67d92` | **Collapsed "locked" sections stayed focusable and operable** (`maxHeight: 0` alone): a keyboard user could change a LOCKED grid, press an invisible **Clear Zone** (no confirm), or turn the "locked" map's rotation and scale. Found by the arc review, not by the name sweep. | Collapsed content is `visibility: hidden` (transitioned, so the 150 ms fade stays) and `aria-hidden`. Four mutants (the visibility, its inversion, the aria-hidden, the grid's collapsed flag) turn the tests red; three characterization tests that pinned the exact transition string now pin the new one. |
| `7d5bc64e` | Layer **Move up / Move down** and **Undo edit / Redo edit** (a saved map) dropped focus while saving, like the sliders; walking back through a history meant finding the button after every press. | `aria-disabled` and an ignored press while saving; a true `disabled` stays for "nothing to undo / end of the stack". Seven mutants turn the tests red. |
| `9034503c` | Glyph-only or unnamed controls: the dice chips' "×", the roll log's "⋯", Generate's "⟳", the stamp "↺ 90°" / "↻" pair, the three HP number fields. | "Remove 2d20", "Remove modifier +3", "Show the whole formula", "Roll a new seed", "Rotate clockwise", "Rotate counter-clockwise, now 90°", "Current HP" / "Max HP" / "Temp HP". Seven of eight mutants turn a test red (the eighth, on the counter-clockwise label, did not apply: the file's degree sign differs, so it is unproven). Tests that found the buttons by their glyphs use the new names. |
| `1ff39cd5` | The whisper "Recipient unavailable" line appeared already filled, which a live region does not reliably announce. | Mounted empty (clipped, still in the accessibility tree), filled when a recipient goes away; a test asserts it is mounted and empty. |
| `bd910344` | The phone player dock's fifth button said **View** and reset the camera, with the meaning only in a hover title a phone never shows. (This record first deferred it for a label that "needs to fit"; the review showed "Reset" is five letters.) | Says **Reset** (named "Reset view"); the tests, one e2e spec (it now scopes to the sheet's own tile, which shares the name) and two user-guide lines use it. |
| `b058f30b` | Help text that was false or incomplete: Build map taught ambient light as "Lighting opacity"; Place on map "moves that same token" (it replaces it); Undo did not say erasing a whole shape cannot be undone; "DM Menu → NPCs" (the tab is "NPCs & Monsters"); Table-tab entries with no phone path; Player View with no "desktop only". | `helpText.u10c.test.ts` pins each sentence. |
| `708fd4fe` | Locking the grid **mid-alignment** hid the wizard's Cancel and Apply (the collapsed-section repair `94e67d92` takes a collapsed section out of reach, and the wizard collapses on a locked grid). Found by the fresh read of the repairs. | It now collapses only when no alignment is active; the "under way" case was RED first and a mutant on the condition turns it red. |
| `79830044` | Polish from the same read: the stamp rotate buttons carry the same names on desktop and phone; layer Move looks inert while it waits; Place on map's help and the DM guide say size and sight radius reset too (and no longer "relocates that same token"); Undo's help is exact; the guide says "NPCs & Monsters"; three weaker tests tightened. | Mutants on the Move look and the rotate name turn tests red. |
| `6504cc19` | Two assertions that could not fail: the mute test's "mic-level 0" matched the start's own first read (the fake analyser read zeros); the ambient-focus spec's `slider.press()` focuses its target first. | The analyser reads 128, the meter reset is asserted (two mutants killed); the spec uses the keyboard, reads focus once inside the saving window, and keeps its held replies in order. |

**A class left as a known limit:** **36 controls** still use `disabled` while saving and drop keyboard focus after a
press (`InitiativeModal` 5 (including "Roll d20 now"), `MapStudioControl` 5, `ImageField` 5, `ElementPropertiesForm` 4,
`NPCEditorActions` 3, `MobileSelectPanel` 2, `MobileLayersPanel` 2, `MapEditLayersPopover` 2, `BuildEntryPrompt` 2,
`ViewedMapDetails` 2, and four single sites; one of `ElementPropertiesForm`'s four is the inspector's whole
`<fieldset disabled>`). That is **36 sites** (the grep gives 37 hits; `CancelGestureButton.tsx:24` waits on an
unfinished gesture, not a save). The repeated-press controls were fixed (the sliders, layer Move, Undo/Redo); these are
pressed once. (The first count here, "about 25", was wrong: the review's grep found 44 sites in 16 files before the
repairs.) Keys pressed while a slider saves are ignored, so
a quick burst of four steps once.

## Measured bars

- Bundle **159.73 KB of 175** (`build:check`, separate from e2e; measured before the review repairs, re-measured in the
  final ladder: **159.99 KB**, see "Last checks").
- Units, on the final ladder: shared 29 files / 452 tests; server 166 / 2,792; client 7,843 tests, 4 skipped (U10b
  7,814 on its final tree).
- e2e: **359 tests + 3 accepted skips** after the first U10c fixes (U10b 358 + 3); on the next ladder one spec failed,
  `mobile-dock.spec.ts:56` (a locator `/Reset view/` now matched two buttons after the dock label fix), repaired and
  re-run alone (2 of 2 pass); the final whole-ladder result is in "Last checks". The three skips are the same as
  U10b's (`map-navigation.spec.ts` twice and `ui-state.spec.ts` once). New spec: `interface-ambient-focus.spec.ts`.
- On the ladder before the review repairs: structure guard passes (1,011 files, the same 22 allowed); lint, format and
  both typechecks green; dev boot passed (`Server running on port 8787`, Vite ready, no export error: `packages/shared`
  changed in this arc).
- The first ladder run on this tree was red for good reasons (the structure guard, four unit tests, two browser
  tests, all from the NPC button rename); each red was a real collision and the whole ladder was run again.
- Verdana (CI's Linux fonts): U10c's repairs add names and one focus attribute, no layout; the new spec asserts focus and
  values, not widths. Not forced.

## Live evaluation (`evaluate-live`)

**Mode: live-two-client** (DM tab and player tab on the dev server's private table; phone and tablet by emulation).
Scored from the journeys **before** the repairs; F1 was re-checked live after its repair (four rapid presses: one step,
focus still on the slider). The later repairs (collapsed sections, the dock's Reset, the names) were not re-driven live.

| Criterion | Score | Why |
| --- | --- | --- |
| Functionality (0.35) | 8.5 | every driven step worked on both input models; the keyboard walk found one real defect (F1) |
| Multiplayer integrity (0.30) | 8.5 | the private roll never reached the other client (desktop and phone), combat state agreed after Next, Previous, Remove and End, the DM's chat log carried the whisper and the DM's Party bar the rename |
| Craft (0.20) | 7.5 | overprinting nameplates for two tokens at one cell, the roller's scrim showing an open Draw sheet, Help opening on World, the dock's "View" (since fixed) |
| Reach (0.15) | 8 | the phone sweep found no control under 44 px; **a DM cannot preview Player View on a phone (ruled desktop-only in U10d) and could not edit Temp HP there (built in U10d)**; no real device |
| **Weighted** | **≈ 8.2** | U10b 8.2, U10a 8.0 |

## Review

**Arc-level review (`review-convergence`)**, run on the committed tree with the U10c deliverables, against the journeys
and the whole arc (commits `7f63156b..HEAD`), not only U10c's diff. Round 1: **six fresh read-only `opus` lenses**, tree
fingerprint identical before and after (discoverability and content; keyboard and touch; state, history, permissions
and privacy; test validity; doc-versus-code honesty; phone parity and orphaned capabilities). All six returned a
verdict; `agents_error` 0; none edited the tree.

| Lens | Verdict | P1 | P2 | P3 |
| --- | --- | --- | --- | --- |
| State, history, permissions, privacy | **PASS** | 0 | 0 | 3 |
| Discoverability and content | FAIL | 0 | 6 | 9 |
| Keyboard and touch | FAIL | 0 | 7 | 10 |
| Test validity | FAIL | 0 | 1 | 6 |
| Doc-versus-code honesty | FAIL | 0 | 6 | 16 |
| Phone parity | FAIL | 0 | 2 | 8 |

Reported: **0 P1, 22 P2 (about 17 distinct once duplicates are merged), 52 P3**. The owner's rule for U6–U10b applies: repair P1 and P2, verify,
one fresh read of the repairs, no round 4.

**Repaired** (each code repair its own commit, RED first, mutants killed; see "Defects found" above): collapsed
sections left focusable and operable (the one real defect, F4); repeated-press buttons that drop focus (F5); glyph-only
and unnamed controls, the HP fields, the late-mounted whisper status (F6); the phone dock's "View" (F7); help text that
was false or incomplete (F8); the vacuous "mute sends level 0" assertion, and the ambient-focus spec's `press()` that
hid what it tested; and the documents: the plan banner that was claimed and not written, the before/after "same
viewport" claim, the downloads claim, the "none unnamed" claim, the `disabled` inventory (25 → 43 sites, 37 now), IA-20
and IA-01's ledger cells, wrong baselines and counts.

**Recorded as deferrals, not built** (each is product work, listed in the report section 5 with its reason): Player View
on a phone (later ruled desktop-only) and Temp HP editing on a phone (later built; both in U10d); phone dialogs' focus in and out; names that do not say which item; "Objects" naming;
the remaining `disabled` buttons; the infinite CSS loops under reduced motion; Help's topic order.
Server P3s the state lens raised, **not U10 and not changed**: changing a character's owner skips the claim path's
legacy temp-HP/portrait settling; a malformed default record in the secret file drops private tables' passwords; the
phone combat strip shows "Turn: —" during a hidden NPC's turn (the wire already carries it).

**Round 2 (the one fresh read of the repairs):** two fresh read-only `opus` lenses, `agents_error` 0, tree untouched.

- *Code repairs* (the seven commits after the review): **PASS**, 0 P1, 0 P2, 12 P3. Repaired: **locking the grid
  mid-alignment hid Cancel and Apply** (a real consequence of the collapsed-section repair; `708fd4fe`, RED first, mutant
  killed); the layer Move buttons that wait with `aria-disabled` now look inert; the stamp rotate names match the
  phone's; three weak tests tightened; Place on map's help and the DM guide say the size and sight radius reset too, and the
  guide no longer says "relocates that same token"; Undo's help is exact; "DM Menu → NPCs" in the guide
  (`79830044`). **Not repaired, recorded:** `JRPGButton` ignores `aria-disabled` (a waiting Undo still blips and shows a
  pointer cursor); the user guide's phone screenshots still show "VIEW"; focus drops to the page if a lock flips from the
  server while focus is inside the section it collapses (rare).
- *The repaired documents*: **FAIL**, 1 P2, 14 P3. The P2: three phone gaps (Clear Initiative on your own character,
  deleting a selection, correcting an older roll) appeared only in the report, not in the record's owner question, the
  plan banner or the known limits, while the banner said the arc was complete — all three now name them, and the banner
  says the U10 "Done when" (no capability orphaned) is **not met on a phone**. The P3s repaired: the `disabled` count
  (36 sites, 44 before the repairs), the sweep sentence, two missing after-image links, the ledger's commit cells, the
  mutant and RED claims (now exact), the check-live-session command, the stale skip line numbers, contradictory
  sentences, the commit count. **Not repaired:** U10b's own record carries both 7,813 and 7,814 (U10b's inconsistency,
  not changed here).

After round 2 there is no round 3: the owner's rule for U6–U10b is "repair P1 and P2, verify, one fresh read of the
repairs, no round 4"; the remaining items are P3 or deferrals, listed above and in the report.

## Known limits (new this pass; the older list is in the report section 6)

- **Not driven live and not covered by a spec:** a failed upload; Export map image and Export editable map; the phone's
  Previous turn, Remove participant, library batch, NPC placement, rename, self-condition and terrain Sample;
  click-outside on a phone; the Cancel stroke button for Draw; a hands-off keyboard-only run of all five journeys; any
  short-landscape viewport in U10c.
- **Not run live because they download a file** (the owner's permission is needed first): Save character, table backup,
  map export. Save character and the table backup are downloaded by specs; **no spec downloads a map export**.
- The Invite button's clipboard write never settled in the built-in pane; the manual-link fallback appeared.
- **At U10c's close a phone had no Player View, no Temp HP editor, no Clear Initiative on your own character, no way to delete a selection and no way to correct an older roll from the log** (all settled in U10d: [the record](interface-clarity-u10d.md)), and its dialogs (Party, Table, Props, Kick, Help, Tools) do not
  move focus in or return it (report section 5).
- Reduced motion: the infinite CSS loops (shimmer, glow-pulse, the low-HP flash, bounce, the loading spin) are not gated
  by `prefers-reduced-motion`; the CRT, the sparkle and the Game-feel default are. **Deferred:** which loops are
  essential (the spinner) is the owner's call.
- The user guide's phone screenshots (`docs/user-guide/img/mobile-table.jpg`, `mobile-tools.jpg`) still show the dock's
  old "VIEW"; regenerate them with `pnpm docs:screenshots`.
- Observed and left: Help opens on World first; the roller's scrim shows an open sheet faintly; two tokens at one cell
  overprint their nameplates; names that do not say which item; "Objects" names three things.

## Questions for the owner

1. **Accept U10c**, and when to push `dev` (about a dozen fix commits and the docs; the owner decides).
2. **Phone parity** (answered 2026-10-02: build Temp HP and Clear Initiative, rule Player View and correcting an older roll
   desktop-only, Help for the Delete path: done in [U10d](interface-clarity-u10d.md)). The question as asked: build a **Player View** and a **Temp HP editor** on the phone (each is a small feature, in the arc's
   own rule "every part ships its phone surface"), or leave them documented as desktop-only (Help now says so for Player
   View)? There are also three more capabilities with no phone route (report section 5): Clear Initiative on your own character, deleting a selected token or drawing (Help's "press Delete" gives no phone path), and correcting an older roll from the log. The plan's U10 "Done when" (no capability orphaned) is not met on a phone
   until these are built or ruled desktop-only.
3. **The deferrals.** IA-01 (a further regrouping of the DM header: three rows at 1280/1366, no control unreachable at
   200 %), IA-19's remainder (Help's topic order, the quick wheel's Paint/Erase, "Decorate from" vs "From", Ping's "right
   now", the Delete entry's missing phone path, since given in U10d), `.table-menu-button` at 10 px against a stylesheet that says 8,
   "Objects" wording, names that do not say which item, reduced motion's infinite loops, phone dialogs' focus.
   Take them into a later arc, or ask for one now?
4. **The remaining 36 `disabled` controls** (a list above). Leave them, or give them the same `aria-disabled` treatment?
5. **Merge to `main`?** Only after the list below; production is the owner's word alone.

## What to do before merging `dev` to `main` (the owner's list)

`main` is production: Render and Cloudflare deploy the push whether CI is green or not. `main` is `7f63156b`
(2026-09-22); the merge brings the whole arc (125 commits and 987 files before the last repairs and the docs, a few more with them; `packages/shared`
and 61 server files included).

1. **Gates on the exact commit that goes to `main`**: `/verify-gates` with `e2e`, **and with `boot`** (`packages/shared`
   changed an export in this arc: the barrel-const trap passes every other gate and boots a dead server).
2. **CI green on that commit** (Linux fonts are as wide as Verdana). `dev` at `335bf94f` was green (#916); watch the
   run for the final push.
3. **`evaluate-live` on the merged tree** with two real clients, and **`review-convergence`** with the arc's lenses
   (this record's review covers the journeys; the merge needs its own, per the plan section 8.1).
4. **The owner's decisions above**, and the still-open, not-U10 items: Q1 (two-table session lockout), Q4
   (characterless-seat phone row), Q7 (Reset to default on a private table; note it stores the server password's hash as
   it was then, so rotating `HEROBYTE_ROOM_SECRET` after a leak will not reach such a table), Q10 (a restore brings back
   a seat's record), Q13 (DM-authority frames queued by the transport). Three server points the state lens raised, not
   U10 and not changed: changing a character's owner skips the claim path's legacy temp-HP/portrait settling; a
   malformed default record in the secret file drops private tables' passwords; the phone combat strip shows "Turn: —"
   during a hidden NPC's turn.
5. **Production settings.** The default table's passwords now follow `HEROBYTE_ROOM_SECRET` / `HEROBYTE_DM_PASSWORD`
   on every start (`f71ad5e5`): set them on Render before the deploy (a saved secret file no longer wins). Private
   tables' passwords are unchanged.
6. **After the deploy**: probe the live site for a string that differs between the commits plus a control (the eager
   bundle), expect HTTP 200 from the server, run the live-session check (`HEROBYTE_ROOM_SECRET='<prod room password>' pnpm check:live-session -- --url 'wss://<render host>' --room <a scratch private table id>`; without `--room` it leaves a seat on the default table), and **tell players to reload** (stale tabs
   blank); DMs re-enter the DM password after the server restart.

## Last checks (final tree)

- **The full ladder on the final tree** (`/verify-gates` with `e2e` and `boot`, after round 2's repairs, `79830044`):
  shared build, lint, format, structure guard, both typechecks green; units shared 29 files / 452 tests, server 166 /
  2,792, client **7,843 tests**, 4 skipped (the runner sums batches, so its client file count differs from earlier
  runs); **e2e 359 passed + 3 accepted skips, 0 failed, 0 flaky**; dev boot passed (`Server running on port 8787`, Vite
  ready, no export error). Bundle **159.99 KB of 175** (`build:check`, run separately; 15.01 KB left; U10b 159.64).
- **Not on the final tree:** CI. `dev` is pushed only through U10b (`335bf94f`, CI #916 green); the owner decides when
  the rest is pushed, and the run for that push is the Linux-fonts check.
- **Not re-driven live after the repairs:** the collapsed sections, the dock's Reset, the names and the help text were
  checked by unit tests and the ladder's browser specs, not by a second pass in the pane.
- The pane's dev server had already exited (the ladder's builds restart the watch server) and its extra tab was closed.
