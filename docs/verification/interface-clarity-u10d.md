# U10d — phone parity

**Status: BUILT, REVIEWED, PUSHED (`c3ed4851`, CI #918 green).** Seven commits on `dev` after `3c4f659c` (the pushed U10c): `99c09cf9`,
`22f1621e`, `60ff0f60`, `2394d105`, `971f5fde`, `209bb19c`, `4ef5a21e`, then this record (`c3ed4851`). CI #918 passed on the pushed tip. Merge to
`main` is the owner's word alone.

U10d is a small slice the U10c arc review asked for (owner answered "Yes, as the review proposed", 2026-10-02): close
the phone-parity gaps the U10 "Done when" (no capability orphaned) found open. The rule stays the arc's own: a part that
changes a surface ships its phone surface in the same slice, or says it does not.

## Owner decisions

- **Build:** Temp HP editing, and Clear Initiative on your own character, on the phone.
- **Rule desktop-only, Help says so:** Player View; correcting an **older** roll from the log.
- **Delete a selection:** check first. Result below: not an orphan; Help gets a phone path.
- **A player's own token cannot be deleted on a phone:** desktop-only, on two conditions: Help says what to do ("…ask
  the DM to remove it, or use a computer"), and the phone's drawings are confirmed not orphaned (pinned with a spec).
- **Delete on a selection of props (desktop):** say so, with the app's toast, not `alert()`: "Props are deleted in the
  Props panel." The existing blocking alerts in the same handler were first left alone; at the owner's later word they became the toast
  too (commit `909e4373`). The partial-delete "Continue?" stays a `confirm()`, because it asks.
- **Later, not now:** reduced motion's infinite CSS loops and the ~36 `disabled`-while-saving buttons go first into an
  accessibility pass; IA-01 (the DM header regrouping) is its own design job.

## What U10d changes

| Surface | Before | Now |
| --- | --- | --- |
| Phone Party row | Temp HP could not be edited (a no-op was passed) | Tap the Temp HP number on your row (a DM: on any row): a number field, Enter saves. Field is 16 px (no iOS zoom), min 44 px wide. |
| Phone character sheet | Initiative Status had no Clear | **Clear Initiative** on your own character (a DM: any) |
| Temp HP editor (desktop and phone) | opened at "0" regardless of the value, so Save with no typing wiped Temp HP | opens at the current value |
| Help: Delete | "press Delete" with no phone path | names the phone routes: Erase drawings / Undo drawing, Props → Delete, DM routes; says a phone player's own token cannot be deleted there (ask the DM or use a computer); says props are deleted in the Props panel |
| Help: HP, Correct a roll, INIT | no phone words | name the real buttons ("✋ THAT'S NOT WHAT I ROLLED"), say the older-roll correction is desktop-only, and the phone's Temp HP / Clear Initiative |
| Desktop Delete on props | a silent no-op | the toast "Props are deleted in the Props panel." (after deleting the tokens of a mixed selection too) |

## Found on the way

- **The Temp HP editor opened at "0"** (`handleStartTempHpEdit` only started the edit; the input state kept its last
  value). Pre-existing on desktop; the phone made it reachable by a new route. Found by the code lens. RED first: a spec
  showed "0" where "7" was expected. Fixed in `App.tsx`, commit `2394d105`. Both mutants of the fix turn the spec red.
- **Drawings are not orphaned on a phone.** Checked rather than assumed: `mobile-erase-drawing.spec.ts` draws two
  strokes by real touch, Undo drawing takes back the latest (2 → 1), Erase drawings rubs the other out (→ 0). It fails
  when the eraser tap is removed. Help's Delete entry says so (`4ef5a21e`).
- **The Delete key on props says nothing** (above), and `useKeyboardShortcuts.ts` had two blocking `alert()`s ("Cannot
  delete locked objects…", "You can only delete objects you own."). Converted to the toast afterwards (`909e4373`;
  `notify` is now required, one caller). The big `useKeyboardShortcuts.test.ts` tests a local copy of the handler, not
  the real hook, so the real coverage is `useKeyboardShortcuts.editableGuard.test.ts`; four mutants turn it red.
- **`helpTopics.ts` reached 358 lines** (guard 350); the three phone entries moved to `phoneHelpEntries.ts` (346).

## Checks

- **Mutants** (restored byte for byte, hash-checked): Temp HP editor (field, submit, who may edit), Clear Initiative
  (who is offered it, what it sends), the opening-value fix, each prop-Delete notice and the prop test. All killed. One
  first-draft test used `confirm → false` and let a mutant live; rewritten, then killed.
- **Specs added:** `mobile-temp-hp.spec.ts`, `mobile-clear-initiative.spec.ts`, `mobile-erase-drawing.spec.ts`; unit
  tests `MobilePlayerRow.tempHp.u10d`, `MobilePlayerRow.clearInitiative.u10d`, `MobileEntitiesList.u10d`,
  `useKeyboardShortcuts.editableGuard` (Delete and props), `helpText.u10c`.
- **Review** (read-only lenses, two): code lens 1 P2 (the Temp HP wipe, fixed) and P3s (one still open: a test that
  `onClear` is not offered to a row the viewer cannot act on); docs lens 3 P2 (stale statements across the U10c record,
  the report and the banner; all repaired in this commit).
- **Gates / e2e:** see "Last checks" at the end of this file.

## Deferrals (named, with reasons)

- Reduced motion's infinite CSS loops: first into the accessibility pass; which loops are essential is the owner's call.
- The 36 `disabled`-while-saving buttons: second into that pass.
- IA-01, the DM header's regrouping: its own design job.
- **Desktop Delete does not remove props** (owner, 2026-10-02: not now; on the follow-up list). The toast says where
  props are deleted. A `delete-prop` message already exists in `packages/shared/src/index.ts` (line 992), so making the
  key remove them later is small.
- Phone dialogs' focus in and out; names that do not say which item; "Objects" naming (unchanged from U10c).
- Unlocking a locked map element on a phone is desktop-only; Help now says so (`c5bb27b9`).
- The user guide's phone screenshots still show the dock's old "VIEW": regenerate with `pnpm docs:screenshots`.

## Owner's answers (2026-10-02) and what is left

1. **Push `dev`:** done (`c3ed4851`), CI #918 green.
2. **Help on unlocking a map element:** desktop-only, said in Help: done (`c5bb27b9`).
3. **Delete removing props:** not now; follow-up list.
4. **The two blocking alerts:** converted to the toast: done (`909e4373`).
5. **Order of the deferred accessibility work:** first animations that keep running under reduced motion, then the 36
   `disabled`-while-saving buttons; the DM header regrouping (IA-01) separately, as its own design job.

Nothing is left open in U10d except the follow-up list above.

## Before merging to `main`

The U10c record's list stands (read "what to do before merging to `main`" there). **Added by the owner, kept here
verbatim in meaning:** before deploying `f71ad5e5` (the server password fix), check what `HEROBYTE_ROOM_SECRET` and
`HEROBYTE_DM_PASSWORD` are set to on Render. If they match what is in use now, nothing changes. If they are **unset**,
Main Hall falls back to Fun1/FunDM. If they hold **old values**, the passwords change silently. Then
`/verify-gates` → `evaluate-live` → `review-convergence` → the owner's word. Players reload after any main deploy.

## Last checks

Full ladder on the committed tree (commit `4ef5a21e` plus this record's docs), `gates-runner` with e2e, 2026-10-02:
shared build, lint, `format:check`, structure guard, both typechecks **pass**; unit: shared 452, server 2792, client 7860
passed / 4 skipped. Bundle (measured separately): **160.72 KB gzipped** of 175 (U9: 157.08).

**e2e: 2 failed, 3 skipped, 360 passed (27.5 min). NOT GREEN.** The three skips are the baseline ones
(`map-navigation.spec.ts:138`, `:191`, `ui-state.spec.ts:91`). The two failures are the character-file download specs:

- `interface-table-backups.spec.ts:164` (chromium): timed out at 90 s; the reported error is `browserContext.close: Test ended.`
- `mobile/mobile-table.spec.ts:323` (mobile-chromium): `page.waitForEvent("download")` never fired after tapping Save character.

**Not caused by U10d, cause unknown.** Both fail identically on `79830044`, the tree that was green before U10d began
(re-run during this slice). Notes from the investigation: on this machine a download started by a user gesture in the
mobile project raises no download event, while a script-started download does; delaying `revokeObjectURL` did not help;
Playwright 1.56.0 and its browsers are unchanged; the experiment was reverted. It needs a look on a clean machine or on
CI before anyone calls it environmental for certain. **CI result (pushed 2026-10-02, `c3ed4851`): run #918 succeeded**, including the `e2e-full-suite` job's "Run full E2E
suite" step (read from the GitHub API; the step log itself needs authentication, so the per-spec counts were not read here).
A full suite that exits clean on CI means the two character-file download specs did not fail there: the failures are
specific to the machine the local ladder ran on, not to U10d. **The local ladder above was not green; CI's is.**
(Original note, written before CI ran: **Do not read the local ladder as green.** Dev boot was not requested
(`packages/shared` gained no export).)
