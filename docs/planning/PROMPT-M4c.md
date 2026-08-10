# Prompt for the M4c session

Paste everything below the rule into a fresh session.

---

Assess this, make changes as you see fit: Read these two files in full before touching anything,
in this order:

1. `docs/planning/mobile-shell-redesign.md` — the navigation model, the three slices M4 became,
   and §3's verified facts (trust the ✎-marked corrections over anything you'd re-derive). Its §2
   now carries SHIPPED notes for M4a and M4b recording what each actually built and where it
   deviated; read those, they are the map of what you're standing on.
2. `docs/planning/HANDOFF-NEXT.md` — §2 (the verification gate, not optional, run before EVERY
   commit), §5 and §6 (traps), §7 (the shared-barrel trap no test can see), §8 (method the owner
   expects), §9 (settled decisions — do not re-litigate), and the two "moved the baselines"
   paragraphs under §2, which also record both slices' adversarial-review outcomes and the
   unexamined areas the critics named.

Skip `docs/planning/mobile-authoring-arc.md` unless you need the original audit; its §4 M4 is
superseded and its line numbers are from 2026-08-01.

**State.** `dev` = `ace7baaf`, working tree clean apart from the owner's untracked art under
`temp/` — never `git add temp/`, never `git add <directory>`, stage explicitly by path. `dev` is
**24 commits ahead of origin/dev (NOT pushed)** and 54 ahead of `main` (= `5307d0dd`, production,
auto-deploys the moment it moves — do not push or merge anywhere unless the owner asks). Full
gate green at `ace7baaf`: shared 414, server 2057, client 44 batches, bundle 97.18 KB / 175 KB,
e2e **115 passed / 0 failed / 3 skipped**.

**Your slice is M4c, defined in the redesign doc §2: map-edit reachable — room + wall, end to
end.** The shell you need already exists: `useMobileSurface` owns which surface is open and
carries a `mode` pass-through that today merely mirrors `props.mapEditMode` — M4c is where it
grows behavior. `MobileFloatingControls` (220 LOC) owns the dock that must BECOME the palette in
map-edit mode (`[ Exit ][ Tool ▾ ][ Undo ][ Redo ][ More ]`, §1 diagram); `MobileSurfaces` (158)
hosts surfaces; `MobileLayout` (226) has ~120 lines of headroom. The work:

- Forward the **17 `mapEdit*` props** (`MainLayoutProps.ts:120-154`, anchors re-verified at
  `ace7baaf`) plus the controller in `MobileLayout` — desktop passes
  `mapEditController={mapStudio}` at `CenterCanvasLayout.tsx:297`, NOT isDM-gated there because
  the server gates the commands.
- START LIVE MAP reuses `useMapEditState.startLiveMap` verbatim. Room and Wall only — both are
  drag-shaped and already work through M2's touch path.
- A persistent **CANCEL DRAG** control: today the only cancel is a capture-phase Escape in
  `useMapEditTool`, and on touch, releasing a finger commits.
- Decide and encode the **resize-crossing rule**: `mapEditMode` survives a desktop→mobile resize
  and `useMapEditHotkeys` stays armed.

**Traps the doc already paid for:** the controller **no-ops silently** without an active
document — disable every tool until `activeDocument.id === liveMapDocumentId`. A two-finger zoom
mid-drag must **CANCEL, not commit**. `MapBoard` kills token interaction in map-edit, so the
selection sheet becomes unreachable in the mode — check a DM cannot get stranded. **Done when:**
on a tablet, `DM → Map → START LIVE MAP → drag a room → drag a wall`, and a second browser as a
player sees fog respect the wall.

**Recorded feed-ins from M4b you may fold in where natural (own commits):** alignment CAPTURE
from the phone DM screen needs close-tap-reopen to reach the map — the mode work is its natural
home; the mobile DM `Suspense` in `MobileSurfaces` has no local error boundary (a failed chunk
load replaces the whole table via the root boundary — realistic trigger is a deploy invalidating
hashed chunks mid-session); `MapStudioControl` is newly phone-reachable with no phone coverage.

**The things most likely to cost you if you skip them:**

- **Gate discipline, the exact failure mode twice paid for:** run each gate step so its real exit
  code survives (`cmd > log 2>&1 && ...`, never `cmd | tail` in a chain), capture the e2e to a
  file, and READ the summary line yourself before `git commit` — never chain the commit behind a
  display command. Two commits landed on red runs that way and had to be amended.
- **Prove every test can fail AND pass.** Break the fix, watch red, revert — and when you
  strengthen an assertion, prove it green on the healthy tree too (a paint-pin regex once failed
  only on the healthy tree: Chromium drops the default `180deg` serializing gradients).
- Mobile geometry is only observable in `mobile-chromium` (Pixel 7, `apps/e2e/mobile/`) at both
  375×812 and 812×375. `mobile-shell.spec.ts` / `mobile-dm.spec.ts` are the patterns; touch drags
  need CDP (`touch.helpers.ts`), Playwright's touchscreen is tap-only. `elementFromPoint` skips
  `pointer-events:none` elements — assert paint structurally for those.
- **e2e specs are NOT `__tests__`-exempt from the 350-LOC guard** (348 real ceiling; `prettier
--write` EXPANDS files — recheck after formatting). Don't edit the next commit's shared files
  while a background gate runs.
- A DM feature is wired ONCE in `features/dm/buildDMMenuProps.ts` — and its pinned key-set test
  will remind you by failing if you add a prop without mapping it.
- Adversarial review before declaring done, and **check `agents_error`**: session limits killed
  one run entirely and another's verify phase — a dead run returns a tidy empty result. Re-run
  after the reset (the failure message names it); if you cannot, verify findings by hand and say
  so.
- Known-broken and pre-existing, do not re-diagnose: 2 of 5 `docs:screenshots` walkthroughs
  ("player basics", "live map authoring") — verified broken at pre-M4a `0441bcfd`, a task chip is
  queued, HANDOFF §2 records it. The mobile walkthrough passes and now includes the DM screen.

Commit to `dev` as you go, each fix in its own commit, full §2 gate before every one. When M4c is
done, stop and report rather than rolling into M5.
