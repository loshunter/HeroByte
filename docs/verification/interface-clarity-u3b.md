# U3b — grouped build palette

2026-09-25. U3a was owner-accepted and committed locally as `b473a3dd`.
U3b is implemented. Round 1's two findings and round 2's five findings are repaired.
All eight gates and isolated boot pass on the unchanged repaired snapshot:
10,018 unit passes and 258 browser passes, with four and three existing skips.
The third, final review found one P3 stale audit-status sentence, corrected after
review. The owner accepted this checkpoint and its local commit on September 25.
U3b is locally complete in the commit containing this record. The earlier
incomplete ladder and latest runner interruption remain explicitly recorded.
This is a new slice, not another formal U3a review. No remote delivery is authorized.

## Behavior

- One exhaustive descriptor table supplies Terrain, Structures, Objects, Lighting
  and Generate groups for desktop and touch. It covers the existing twelve
  authoring tools plus Select/Sample and derives the nine mobile panel tools.
- Each group remembers its last tool. Quick wheel, brush favorites/recents,
  existing input handlers and phone close-to-aim behavior stay on their existing
  paths. Desktop-specific pickers remain lazy imports.
- Map name, live relationship, history and persistent controls are separate from
  scrolling tool settings. Generate and Rope / curve retain Layers and Inspect.
  Opening a document panel reveals its first controls within that scroller.
- Room/Hallway settings offer decoration for the named, outlined last placed
  region. Readiness checks floor, drafts, placement layers and pending work.
  A document switch clears the target; retained callbacks use current state;
  repeated presses consume it once. Arbitrary selected-room decoration is absent.
- Done building returns to play; the phone label is Done. Help and the map-editor
  guide describe current groups and names. Older guide images are marked as such.

## Evidence before the full ladder

All scratch artifacts below are in `output/interface-u3a-execution/`.
Characterization preceded state/settings extraction: 22 tests/4 files passed on
the original structure, then 41/5 after extraction. Eight grouping and two target
regressions had strict-clean behavioral RED before repair. The retained-callback
case also failed behaviorally after correcting its initial document-open setup.
The broad focused client run passed 531/64; two later lifecycle checks passed
with 22/4 palette tests. The final disclosure/mobile/help check passed 60/10.
These runs overlap and must not be added together as unique test totals.

`u3b-pre-gate-actual-types.json` strictly compiles all actual changed client and
E2E roots, including tests excluded by normal package builds. Setup-only failures
(unsupported RTL options, typed fixture ripple, unsolicited document message,
wrong pnpm filter and a missing union guard) are recorded in the execution ledger;
none is claimed as behavioral RED.

`u3b-generate-browser-run-report.json`: all six desktop/phone U3a Generate
journeys pass after selector adaptation, including refusal, uncertain completion
and FIFO delayed recovery. Six attempts, no retries, skips, flaky outcomes,
attempt errors or reporter errors.

`u3b-disclosure-green-report.json`: four passes/attempts, no failures, skips,
retries, flaky outcomes, attempt errors or reporter errors (95.1 seconds):

1. Desktop DM at 1280×640 and a separate player at 1440×900.
2. Touch DM at 375×812 and a separate desktop player.
3. Bound tablet palette at 820×1180 preserves at least 560px of aimable map;
   measured 582.4px after repair.
4. Bound Room and Generate panels fit phone portrait and 812×375 landscape,
   preserve the close control and 44px button floor without horizontal overflow.

Both two-client journeys draw a room, decorate, paint, generate, inspect a hit
element and Undo. Player revisions/terrain/walls are asserted at each relevant
step; private map documents never arrive at the player's socket. After scrolling,
Select/Sample/Layers/Done/Undo remain in the viewport, clipped hit areas are at
least 44px, and center hit tests reach the actual controls. Paint retains the
Room control positions; Generate and Spline each pass reach measurements.

The first tablet run exposed a real 447px map footprint. A CSS cap first lost to
the global sheet cascade; specificity fixed it without weakening the 560px floor.
The first desktop aiming fixture hit the open Entities panel; the corrected
fixture closes that panel through its button. Screenshot inspection then exposed
offscreen disclosures. `u3b-disclosure-red-report.json` records two strict-clean
Layers failures with viewport ratio zero before the reveal hook. Raw output also
contains Playwright step-ID warnings; both actual assertions and screenshots are
preserved. The repaired run opens desktop Inspect and phone Edit in view as well.

Decoded screenshots and reach measurements are in `u3b-disclosure-green-evidence/`.
The implementing agent inspected the DM target, Generate, inspector and player
renderings. The short desktop's settings area remains compact and scrollable;
the persistent controls take priority over showing all fields at once.

## Live evaluation

Achieved mode: **automated live-two-client**, Chromium mouse and emulated touch,
isolated test servers and separate authenticated contexts. Read-only state/wire
observation plus real browser input; no injected application-state writes.

| Criterion | Weight | Score | Evidence |
| --- | --- | --- | --- |
| Functionality | 0.35 | 8.0 | Complete authoring/Undo paths, inventory and invalid-target checks |
| Multiplayer integrity | 0.30 | 8.0 | Player state and private-document boundary; DM demotion removes previews |
| Craft | 0.20 | 7.5 | Named target, stable controls, visible disclosure; compact desktop settings |
| Reach | 0.15 | 7.8 | Phone/tablet/landscape measurements and touch journey |

Weighted score **7.87**, above the 7.0 evidence threshold. This does not replace
the full gates or independent review. Improved: grouped choices and preserved
controls; repaired regressions: tablet map loss and offscreen disclosures.
No remaining finding from these scoped journeys. Limits: no physical device,
WebKit, native Mac keyboard or fresh production test. This is not an exhaustive
privacy audit or a claim that later menu-relocation slices are implemented.

## First full ladder — repairs required

The first frozen ladder passed build, typecheck, lint, structure, format, all
10,003 unit tests (four existing skips), the 136.92 KB / 175 KB bundle check and
isolated fresh boot. All 76 frozen hashes and HEAD matched. Full E2E failed:
245 passes, nine failures, three existing skips, 257 attempts, no retries/flaky
cases, 14 attempt error objects and no top-level JSON reporter errors. Two raw
Playwright step-ID diagnostic lines are preserved. See `u3b-gates-report.md` and
`u3b-gate-e2e-evidence/`; this run is not green.

Seven cases failed on missed old selectors: three point tools, the live room/door
smoke, two mobile Row setups and an ambiguous Hallway/Decorate match. The finger
wall test started at x=30% on the wider palette's border; its repair asserts
the complete drag path is uncovered canvas. The desktop journey reached Undo
and player state equality, then exceeded the inherited ten-second field-worker
wait. That wait now uses the existing documentation journeys' 30-second budget,
still requiring the status to disappear; the new journey records elapsed time
and before/after statuses. This is an observation-budget repair, not evidence
of a renderer fix. Focused verification and a fresh full ladder are pending.

The targeted repairs pass strict compilation of the actual seven changed E2E
roots. `u3b-gate-repair-browser-report.json` records **13 passes / 13 attempts**
in 156.2 seconds, with no failures, skips, retries, flaky cases, attempt errors
or reporter errors. Original point-action, deletion, rotation, touch-cancellation
and player-observation assertions remain. Player view plus worker settlement took
9,226ms desktop and 8,215ms phone; each started at Painting terrain 0% and ended
with no status. No renderer change was made. A fresh full ladder is now required.

## Repaired full ladder — PASS

`u3b-repaired-gates-report.md` records all eight gates and isolated boot PASS:
10,003 unit passes/four existing skips, 136.92 KB gzip/175 KB, and **254 browser
passes/three existing skips** in 23.0 minutes. All 257 attempts are accounted for:
zero failures, retries, flaky cases, attempt errors, reporter errors or raw
step-ID diagnostics. The skips are camera reset, grid visibility and DM toggle.
The nine failures from the earlier run all pass here. The final player view/bake
waits measured 8,239ms desktop and 8,181ms phone, ending with no painting status.

The 78 frozen hashes and HEAD `b473a3dd` matched before and after verification;
the implementing agent independently reconciled unit summaries, browser JSON,
boot evidence and hashes. Isolated 5176/8789 passed module readiness and 30-second
survival, then owned-process cleanup; existing 5174/8787 were preserved. Source
and tests are unchanged after these gates. Only result/status documentation is
updated before fresh independent U3b review. The review and local commit remain
pending; U4–U10 and remote delivery have not started.

## Round 1 repair checkpoint

Four independent static reviewers completed with zero agent errors and unchanged
HEAD/all 78 hashes. UI and interaction found the same phone group-close issue;
privacy/geometry found stale decoration readiness; evidence/documentation passed.
The union is two P2 findings. The weak any-floor predicate predates U3b; its new
visible validity claim brings the repair within this slice.

The phone now closes after a group activates a remembered tool with no settings.
Decoration uses the last placement's perimeter identity, unchanged grid spacing
and complete floor footprint. Its outline, ghost preview, button and retained
callback share validity. This preserves the last-room geometry and existing
controller/wire contract. Undo over old paint, partial erase, moved geometry and
grid changes invalidate; repaint, door placement and layer presentation are controls.

Actual strict regressions: nine behavioral unit failures, four passing controls,
then **546/66 focused PASS** after repair. First strict attempt had an incomplete
door fixture; it was corrected before RED. The post-repair actual-root check found
one old layout callback type; forwarding the required alias repaired it, and the
strict recheck passes. Neither compiler issue is counted as behavioral RED.

Browser RED: direct Lighting group left the phone sheet open. The first decoration
case stopped on a public/private terrain comparison error in the test; after
correcting that observation and strict-checking, a separate run verified the real
Undo and player's surviving terrain, then failed because Decorate stayed enabled.
All three attempts remain recorded without retries. The target-only RED emitted
two raw step-ID diagnostics and zero JSON reporter errors. Browser GREEN, fresh
full gates/boot and independent round 2 are next; no U3b commit yet.

Focused browser follow-up (before final green): 31/32 passed; the sole new Lighting
case hit the bottom stacked Konva canvas. A bounded diagnostic exposed the
intercepting canvas. After switching to viewport touch input, a second incorrect
test expectation surfaced: compiled lights are DM-only by the existing server
contract. A trusted CDP touch run confirmed one authoritative DM light, then failed
only the invalid player-light expectation. The final regression now requires the
new public revision while light geometry and private documents remain redacted.
These test setup/oracle failures are preserved, not attributed to product defects.
Actual strict compilation also caught a missing ServerMessage type guard, repaired
before the final run. See the execution ledger for individual reports and counts.

Final R1 focused checkpoint: direct Lighting group now passes in 7.7 seconds
(34.3-second run), one attempt, zero failures/skips/retries/flaky/attempt/reporter
errors. Final strict test root PASS in u3b-r1-recovery-privacy-types-fixed.json.
Together with the earlier 31 passing paths (same repaired product source), this
covers all 32 focused scenarios; it is not a claim of one all-green 32-case run.
Full gates will rerun every case. Achieved mode remains automated live-two-client,
Chromium mouse/emulated touch. DM light creation plus player public revision and
redaction pass; Undo-over-painted-floor target, main desktop/phone workflows and
mobile reach pass. Existing score 7.87 retained, with the same device/browser limits.
Full eight gates plus fresh isolated boot start next on a new frozen snapshot.

## Final R1 repair ladder — PASS

`u3b-r1-final-gates-report.md` records all eight gates and isolated boot PASS:
**10,016 unit passes / four existing skips**, **137.27 KB gzip / 175 KB**, and
**256 browser passes / three existing skips** in 23.3 minutes. All 259 attempts
are accounted for, with zero failures, retries, flaky cases, attempt errors,
reporter errors or raw step-ID diagnostics. The implementing agent independently
reconciled the 85 client batch summaries and browser JSON. The two new browser
regressions and both complete desktop/phone journeys pass in this single full run.

The final Room help says perimeter walls; the None option omits painted wall rings,
not the blocking perimeter. This root P3 copy correction is separate from the two
formal R1 findings. The stopped r1-repaired ladder remains explicitly incomplete.

All 84 frozen hashes and HEAD `b473a3dd` matched. Isolated 5176/8789 passed server,
client and module readiness, 30-second survival and owned-process cleanup, while
5174/8787 were preserved. The implementing agent inspected final desktop target,
phone Generate/Inspect, player-after-Undo and both regression screenshots in
`u3b-r1-final-gate-e2e-evidence/`. Player view/bake settlement measured 8,248ms
desktop and 8,214ms phone, ending with no painting status. Live mode, score and
device/browser limits above remain unchanged. Source/tests are frozen; only result
documentation changes before the fresh R2 review snapshot. No U3b commit yet.

## Round 2 repairs — focused PASS

Four fresh independent STATIC reviewers completed with zero agent errors and all
85 frozen hashes/HEAD unchanged. Their union is **five findings**: one P2 omitted
hidden-perimeter state, plus four P3s (IA-07 wrongly marked pending; inherited
Scatter rotation claims; inherited painted-ring claim for None; Ambient-light
help pointing to sliders named Lighting opacity). The rotation finding was
duplicated by UI and interaction reviewers and counts once. Formal counts are
**2 → 5**; the third round is the final allowed round.

The hidden-perimeter regression strictly compiled before execution. Its actual
controller update and shared compiler prove that hiding a room wall or one
hallway side removes geometry but previously retained decoration readiness,
outline, ghosts and a callable action: **two intended failures, eight controls
passing**. Real desktop and phone inspectors reproduce the same defect with a
separate player: both RED cases confirm removed player geometry before failing
the intended disabled-button assertion. Two attempts, no retries/reporter errors;
two raw step-ID diagnostic lines repeat their text. No setup failure is counted
as RED. Evidence: `u3b-r2-regression-types.json`, `u3b-r2-unit-red.log`,
`u3b-r2-browser-red-report.json` and its decoded attachments.

The shared predicate now checks perimeter hidden state. Guide corrections explain
the optional painted ring, Place-only rotation, and hiding invalidation. The audit
correctly covers IA-06/07. Existing Lighting-layer sliders now visibly and
accessibly say Ambient light; commands and opacity semantics are unchanged. This
label alignment does not implement U5's setting relocation or combined Save.

Final actual-root strict check PASS (80 roots). Focused suites: **548 tests /66
files PASS**. The twelve-case focused browser run passes all attempts, with zero
failures/skips/retries/flaky/attempt/reporter errors or raw step-ID diagnostics,
in167.6seconds. It includes both full authoring journeys, both hidden-perimeter
repairs, prior Lighting/Undo regressions, Ambient-light operation and panel reach.
The implementing agent inspected both hidden-perimeter screenshots. Mode remains
automated live-two-client, Chromium mouse/emulated touch; score7.87 and existing
limits are retained. Evidence: `u3b-r2-final-actual-types.json`,
`u3b-r2-focused-green.log`, `u3b-r2-browser-green-report.json` and decoded evidence.
Fresh full gates/boot use the `u3b-r2-repaired-gate-*` prefix before final R3.

## Final R2 repair ladder — PASS

`u3b-r2-repaired-gates-report.md` records all eight gates and isolated boot PASS:
**10,018 unit passes / four existing skips** (shared 452, server 2,738, client
6,828 across 85 batch summaries), **137.29 KB gzip / 175 KB**, and **258 browser
passes / three existing skips**. All 261 attempts in 23.5 minutes are accounted
for, with zero failures, retries, flaky cases, attempt errors, reporter errors or
raw step-ID diagnostics. The final strict check covers 80 actual changed TS roots.

Gates 1–6 completed on September 24. The mechanical runner then hit a usage limit;
after the owner's resume on September 25, the implementing agent verified all 87
file hashes and HEAD before continuing gates 7–8 and boot. The same passing logs
were retained, with no intervening source/test/docs mutation or redundant rerun.
This was one recovered mechanical-runner error, not a semantic review round.
R1 and R2's completed semantic reviews retain zero agent errors; R3 has not run.

Root independently reconciled the unit and browser counts, all 87 frozen hashes,
HEAD `b473a3dd`, boot readiness, 30-second survival and owned-process cleanup.
Existing services on 5174/8787 were preserved. Final screenshots inspected in
`u3b-r2-repaired-gate-e2e-evidence/`: desktop named target, phone Generate/Inspect,
player after Undo, both hidden-perimeter cases and tablet Select. The invalid
desktop target loses its gold decoration outline; its cyan selection remains.
Player render settlement took 9,203ms desktop and 8,158ms phone, ending idle.
The tablet retains 582.4px of map above the sheet. These checks retain the recorded
automated live-two-client mode, score 7.87 and browser/device limits. Only result
documentation changes before the fresh final R3 freeze; source/tests are unchanged.

## Final review and owner checkpoint — 2026-09-25

All four fresh, independent, pinned R3 reviewers completed in STATIC mode with
`agents_error: 0`. UI/state and privacy/geometry passed. Evidence/documentation
and interaction each flagged the same P3: the IA-06/07 audit disposition still
said R2 repairs were undergoing verification despite the completed gate record.
There is **one distinct finding**. No additional product defect was found.
Reports: `u3b-r3-{ui,privacy,evidence,interaction}-review.md` beneath the scratch
evidence directory. All 87 hashes and HEAD `b473a3dd` matched before and after;
root independently confirmed the freeze before releasing it.

Formal finding counts: **2 → 5 → 1** over three rounds, 12 completed reviewer
assignments, zero semantic agent errors. The one recovered mechanical-runner
usage interruption is separate. This was not a unanimous final PASS. The
[review-convergence rule](../../.claude/skills/review-convergence/SKILL.md) says
“Cap the rounds at 3. Round 4 is escalation to the owner, not another loop.”
No fourth review ran. The cap is reached; the finding count did decrease in R3.

The implementing agent made the bounded documentation correction and recorded
this checkpoint after review. The audit now states that all eight gates and boot
passed and that the owner checkpoint/local commit remain pending. Source and
tests are unchanged from the verified snapshot; these result-only edits do not
claim a new formal PASS or require another browser run. No unresolved product
finding is being hidden by this documentation correction.

**Owner decision:** accept this verified U3b checkpoint and authorize its scoped
local commit despite the non-unanimous capped review. The concrete commit covers
the 87 reviewed source/test/docs paths with the audit correction and result/status
updates. It preserves U3a `b473a3dd`; no push, merge, deployment or U4 work is
included. Until acceptance, the implementation remains uncommitted in this tree.

**Accepted:** on September 25 the owner explicitly replied **“Accept and commit
locally”** to the verified U3b checkpoint and corrected audit sentence. This
satisfies the cap checkpoint and authorizes the scoped local commit containing
this record. It does not change the historical two PASS/two FAIL verdicts or
claim a fourth review. Final post-review edits are only the audit correction and
result/acceptance documentation; all source/test hashes still match the green
gate and review snapshots. U4 is next and was not implemented here. No remote
push, main merge or deployment was performed.
