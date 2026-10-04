# U4a — drawing settings and terminology

Started 2026-09-25 on existing `dev` at `351b5485`. Status: **bounded post-cap
repairs verified and owner-accepted for the scoped local commit**.
The owner authorized continuation on 2026-09-26 with “Can you continue on now?”
after the acceptance requirement was presented. No push, merge or deployment is authorized.

U3a and U3b remain owner-accepted and closed. This slice aligns drawing controls;
U4b terrain footprints/sample routing and U4c collection browsing remain separate.

Latest verification: all eight gates and isolated fresh boot PASS, **10,027 unit
passes/four existing skips**, **263 browser passes/three existing skips**, zero
browser failures/retries/errors, and **137.53 KB gzip / 175 KB limit**. All three
final-review findings have bounded repairs and verification. Formal review remains
**3 → 3 → 3**, 12 completed STATIC assignments, zero semantic agent errors, with
UI/tests PASS and docs/state FAIL in R3; the repairs do not turn those verdicts into
unanimous PASS. The owner has accepted the capped checkpoint; no fourth round will run.

## Behavior

Desktop and phone share names for all nine drawing tools and one settings component,
backed by the existing App-level state. Both show Tool, Settings, History and Done
drawing. Width labels distinguish Stroke width (px) and Eraser width (px). Opacity
and shape fill now reach the phone. Color/opacity disappear for Erase drawings;
Filled appears only for Rectangle/Circle. Templates keep their automatic fill and
grid-based drag geometry. Active tools expose pressed state; form controls have labels.
The phone's Hide controls keeps drawing active with a compact history/disclosure
row; Show controls restores the existing settings. Hidden controls remain hidden
through temporary Tools/Help sheets. Done drawing exits the mode; starting Draw again
expands the controls.

The implementation retains server-owned annotation history, cancellation, clear-all
authority/confirmation, native text editing, the one drawing state and map controller,
and drawing/terrain separation. There is no wire, renderer or terrain change. Settings
survive a responsive layout swap; this does not add persistence across reloads.

Whole-shape erasure remains a deletion without an Undo entry, as the existing server
characterization explicitly records. Partial freehand erasure is undoable. The guide
now states that distinction. The existing eraser preview's zoom behavior was inspected
in source only; this slice makes no new exact-footprint guarantee for that preview.

## Verification evidence

All scratch artifacts are in ignored `output/interface-u3a-execution/` and do not
automatically travel with a new checkout.

- Strict characterization before extraction: **136 passes / six files**, including
  one new real-controller responsive-remount case.
- Strict behavioral RED: five expected new failures, with 53 passing controls;
  refined selectors then isolate the missing accessible opacity control. The runner's
  initial sandbox failure and later formatting syntax error are setup failures, not RED.
- Focused unit/component/lifecycle/rendering checks: **425 passes / 21 files**.
- Eleven actual authored TypeScript test roots strictly compile, including browser
  journeys and existing selector adaptations.
- First browser run: **10 passed / three failed**, 13 attempts, no retries, flaky cases
  or reporter errors; five attempt-error objects. Two new journeys wrongly expected
  whole-shape erasure to be undoable and timed out on the disabled Undo button; teardown
  added an error object in each. Existing characterization confirmed the test-oracle
  error. The third failure revealed the taller sheet covering an existing stroke path.
- Compact-layout run: **20 passed / 20 attempts** in 100.7 seconds, zero skips,
  failed attempts, retries, flaky cases, attempt errors or reporter errors. This includes
  two distinct-context DM/player journeys, actual mouse and Chromium-emulated touch,
  phone setting changes, return to desktop, shared drawing state, erase, creation
  history, clear permission/confirmation, partial-erase history and area templates.
  The old freehand test passes at its original coordinates after the layout repair.
- All 17 Rectangle controls fit with at least 44px effective touch targets at 375×812,
  812×375, 1024×768 and 720×450. The last is a 200%-equivalent CSS viewport, not a
  native browser-zoom test. Checkbox reach measures its associated label hit area.

Screenshot inspection found uppercase phone text extending toward button borders,
which box-only reach checks missed. A strictly compiled text-bounds regression failed
on Freehand, Rectangle and Erase drawings. The same run used a compile-valid opacity
handler no-op: both drawing journeys failed at the intended 40%-versus-100% assertion.
All three failed attempts remain in `u4a-browser-discriminating-red-report.json`, with
zero retries, flaky cases or reporter errors and three attempt-error objects. Three
raw step-ID diagnostic lines are retained. The handler was restored byte for byte;
`u4a-opacity-probe-restoration.json` records matching SHA-256 hashes.

Normal capitalization repairs the phone text fit. Restored actual roots strictly
compile, and `u4a-browser-final-green` passes **three tests / three attempts** in
43.0 seconds, with zero failures, skips, retries, flaky cases, attempt/reporter errors
or raw step-ID diagnostics. The stronger text-bounds assertions pass at all four
viewports. Root inspected final phone, landscape and observer screenshots; settings,
labels and the synchronized filled shape are visible. Earlier compact-layout coverage
remains applicable: the subsequent production change is only phone text capitalization.

Live evaluation mode is **automated live-two-client Chromium**, mouse and emulated
touch in two authenticated browser contexts. Function 8/10, multiplayer integrity
8/10, craft 7.5/10 and reach 8/10 yield **7.9/10** using the house weights
0.35/0.30/0.20/0.15, above its 7/10 threshold. Shared settings and
readable reachable controls are evidenced; desktop styling still uses the existing
floating window. This is not physical-device, WebKit, native-Mac or native-zoom
coverage. Eraser preview/zoom was inspected only in source, not live pixel-matched.
Full scoring and screenshot references are in `u4a-live-evaluation.md`.

All eight house gates PASS in order: build, typecheck, lint, structure guard,
format check, full tests, client build:check and full E2E. The full unit log has
**10,024 passes / four existing skips**: shared 452, server 2,738 and client 6,834
across all 87 batches. Root independently reconciled every summary. Bundle gate:
**137.43 KB gzip / 175 KB limit**. Browser gate: **261 passes / three existing skips**,
264 attempts in 24.0 minutes, zero failed attempts, retries, flaky cases, attempt
errors, reporter errors or raw step-ID diagnostics. All three new U4a cases pass.
Prefixes are `u4a-gate-*`; build's passing capture is `u4a-gate-build-access`.

Isolated fresh boot on 5176/8789 passes server health, client page and module readiness,
30-second survival, final health/module requests, empty error scan and owned-process
cleanup. Existing 5174/8787 services were preserved. See `u4a-gates-report.md`,
`u4a-devboot-report.json` and `u4a-root-unit-audit.json`.

The initial sandboxed build capture failed before pnpm could start; its log is retained
beside the passing normal escalated run. A tool authentication interruption occurred
after all eight gates and before fresh boot executed. On resumption, root confirmed
HEAD and all 22 frozen hashes; only the remaining boot/report work ran. These are
mechanical interruptions, not semantic review results. No executed failing gate was
blindly retried. Final gate/boot audits match all 22 hashes and HEAD `351b5485`.
Only result/frontier documentation changes after that freeze, before formal review.

## Review round 1 and bounded repairs

Four fresh pinned reviewers completed independently in STATIC mode: UI/input and
state/authority PASS; test validity and documentation FAIL. Union: **three findings**,
four completed assignments, **zero semantic agent errors**. Root verified all 24
frozen paths and HEAD unchanged before repairs. Reports are `u4a-r1-{ui,state,tests,docs}-review.md`.

The P2 oracle gap was real: only button text was measured, while the four setting
controls reported `textFits: true` from empty ranges. Earlier claims that all 17
controls had measured text were too broad. The helper now measures each input's
associated label and the Filled label, requires nonempty text ranges, and compares
them with clipped label bounds. Buttons retain their inner-border bounds. The four
viewport case uses maximum width 50 and opacity 100 to include their full labels.

A compile-valid temporary transform shifted only the width label 120px. The new
assertion failed on its three measured text ranges while the slider retained its
44px target, full exposure and center hit. `u4a-r1-label-red` records one intended
failure/attempt, no retries/flaky/reporter errors and one attempt-error object.
Exact original DrawingSettings bytes were restored and independently hash-checked.
Restored actual roots strictly compile; `u4a-r1-label-green` passes all three browser
cases in 43.9 seconds, with no failures/skips/retries/flaky/attempt/reporter errors.
All 17 controls now have nonempty text measurements at all four viewports.

Two P3 copy findings are corrected: the audit explicitly dates its old Brush Size
observation, and the guide limits template opacity to outline/wash while its size
label remains visible. Renderer behavior is unchanged. No production code changed
after round 1; only two browser-test files and result/user documentation changed.

## Round-1 repeated verification

The repaired snapshot passes the full eight gates and isolated boot under
`u4a-r1-repaired-gate-*`: **10,024 unit passes/four skips**, **137.43 KB gzip**,
**261 browser passes/three skips**, 264 attempts in 23.5 minutes, zero failures,
retries, flaky cases, attempt/reporter errors or raw step-ID diagnostics. Root
independently reconciled counts and all 24 frozen hashes at HEAD `351b5485`.
Fresh boot passes readiness, 30-second survival, empty error scan and owned cleanup.
No gate was skipped or retried. See `u4a-r1-repaired-gates-report.md`,
`u4a-r1-repaired-devboot-report.json` and `u4a-r1-root-unit-audit.json`.

## Review round 2 and bounded repairs

Four fresh independent STATIC reviewers completed: state/authority PASS; UI/input,
test validity and documentation FAIL. Union: **three findings**, cumulative counts
**3 → 3**, eight completed assignments and **zero semantic agent errors**. Root
verified all 24 frozen hashes and HEAD before releasing the freeze. Reports are
`u4a-r2-{ui,state,tests,docs}-review.md`.

- P2 landscape obstruction: the expanded sheet left only about 85px above it at
  812×375. Earlier control-reach checks did not establish drawing reach there.
  A strictly compiled regression failed at the uncovered-canvas assertion for a
  fixed stroke from (450,55) to (550,155), spanning two 50px grid cells vertically.
  Hide controls now keeps the current tool active and exposes that same path;
  five compact buttons retain disclosure, Undo, Redo, Cancel and Done. Only local
  disclosure state was added; drawing settings remain in the existing controller.
- P2 missing-state oracle: the helper fabricated an empty array when the snapshot
  was absent. A real uninstrumented-page regression failed because it resolved
  to `[]`. The helper now rejects a missing/non-array drawing state, so erasure
  assertions compare an actual observed array. No application seam is written.
- P3 evidence status: the linked live evaluation described button-only text
  measurement and contained undated obsolete pending-gate statements. Its current
  table now distinguishes button text and associated setting labels; dated
  verification history replaces those stale statements.

Before repair, `u4a-r2-browser-red` has **two intended failures/two attempts** in
42.6 seconds, two attempt errors, zero retries/flaky/reporter errors; two raw step-ID
diagnostic occurrences share one log line. The collapse
unit regression has one intended failure and six passing controls. Initial strict
checking caught two invalid Testing Library options; these were corrected before
the successful strict check and behavioral runs. That compile failure is setup,
not RED. All failed captures remain intact.

The repaired focused component run passes **192 tests/seven files** and all four
changed actual test roots strictly compile. `u4a-r2-browser-green` passes **15 tests /
15 attempts** in 81.5 seconds, zero failures/skips/retries/flaky/attempt/reporter errors
or raw step-ID markers. All five U4a cases and ten original mobile drawing cases pass.
The original mobile stroke coordinates remain unchanged. Eighteen expanded targets
and five collapsed targets pass size/exposure/hit and nonempty text bounds. Root
inspected collapsed landscape, observer, portrait, expanded landscape and 720×450
screenshots. The revised 7.9 live score includes the actual landscape stroke; earlier
control fit alone did not justify that reach claim.

## Round-2 repeated verification

All eight gates and isolated fresh boot PASS under `u4a-r2-repaired-gate-*`:
**10,025 unit passes/four existing skips**, including shared 452, server 2,738,
client 6,835 across all 87 batches. Bundle: **137.51 KB gzip / 175 KB limit**.
Full browser suite: **263 passes/three existing skips**, 266 cases/attempts in
24.1 minutes, zero failed attempts, retries, flaky cases, attempt/reporter errors
or raw step-ID diagnostics. All five U4a cases pass. No gate was skipped or retried.

Fresh boot on 5176/8789 passes server/client/module readiness, 30-second survival,
final health/module checks, empty error scan and owned cleanup. Existing 5174/8787
services were preserved. Root independently reconciled counts and all 24 hashes at
HEAD `351b5485`, inspected final landscape/observer screenshots and checked all six
U4a reach reports: five expanded reports of 18 controls and one compact report of
five, with no empty text measurements, failed text fit or missed hits. See
`u4a-r2-repaired-gates-report.md`, `u4a-r2-repaired-devboot-report.json`,
`u4a-r2-root-unit-audit.json` and `u4a-r2-repaired-gate-e2e-evidence/`.

Only result/frontier records changed after that gate freeze. Production and tests
remain identical to the verified snapshot. Final review has its own 24-path freeze.

## Final review round 3 and bounded owner checkpoint

All four fresh STATIC assignments completed. UI/input and test validity PASS;
documentation and state/authority FAIL. Union: **three P3 findings**, cumulative
**3 → 3 → 3**, **12 completed assignments**, **zero semantic agent errors**.
Root read all reports and verified HEAD and all 24 frozen hashes. Reports are
`u4a-r3-{ui,tests,docs,state}-review.md`. No fourth round will run: both cap and plateau
are reached. U3a/U3b acceptance remains closed; this checkpoint applies only to U4a.

The three findings are bounded: hidden controls reset when Tools/Help temporarily
unmounts the phone drawing sheet; the guide's phone summary still describes the
old compact strip; the handoff's absolute all-PASS sentence omits the owner-acceptance
path after capped review. The source repair keeps disclosure in MobileLayout,
resets it when drawing ends and leaves drawing preferences in their existing controller.
The child now receives required controlled disclosure props; its existing test
harnesses supply them, preserving their state/history assertions. The two wording
contradictions are corrected.

Two strictly compiled transition regressions reproduce the reset, with 54 passing
controls. The initial live attempt timed out on the new test's incorrect case-sensitive
`Close Tools` selector, with one failed attempt/two error objects; this is retained
setup failure, not behavioral RED. Correct existing lowercase close labels strictly
compile, and `u4a-postcap-browser-behavioral-red` fails at the intended missing Show
controls assertion after closing Tools: one attempt/error, no retries/flaky/reporter
errors, two raw step-ID occurrences on one line. Failed screenshots are preserved
in `u4a-postcap-browser-{setup,behavioral}-failure/`.

The repaired focused run passes **197 tests/eight files**, including both temporary
sheet transitions and reset on actually ending drawing. All seven affected actual
test roots strictly compile. The existing in-mount disclosure and responsive-state
characterization remain passing. `u4a-postcap-browser-green` passes **15 tests/15
attempts** in 62.5 seconds, zero failures/skips/retries/flaky/attempt/reporter errors
or raw step-ID markers. It traverses Tools and Help before the fixed landscape
stroke, verifies both clients and history, and checks that restarting Draw expands
the controls. The same 18 expanded/five compact targets pass their nonempty text,
size, exposure and hit checks. Root inspected the current collapsed/observer images.

The two additional authored paths after R3 are existing history test fixtures that
now supply the required disclosure props; their behavior assertions are unchanged.
The bounded snapshot contains 26 paths. There will be no additional semantic review
round.

## Verified post-cap result — subsequently owner-accepted

Completed 2026-09-25 local time (2026-09-26 03:05 UTC). All eight gates pass in
order under `u4a-postcap-gate-*`: build, typecheck, lint, structure, format, full
tests, client bundle check and full E2E. No gate was skipped or retried.

- Units: **10,027 passed/four existing skips** — shared 452, server 2,738 and client
  6,837 across all 87 batches. Root independently reconciled every summary.
- Bundle: **137.53 KB gzip**, below the 175 KB limit.
- Browser: **263 passed/three existing skips**, 266 cases/266 attempts in 19.7
  minutes. Zero failed attempts, retries, flaky cases, attempt errors, reporter
  errors or raw step-ID diagnostics. All five U4a cases pass in the full suite.
- Fresh boot on isolated 5176/8789: server/client/module readiness, 30-second
  survival, final health/module requests, empty error scan and owned-process cleanup
  PASS. Existing 5174/8787 services were preserved.
- Root verified HEAD `351b5485` and all **26/26 frozen paths** unchanged after
  verification, inspected final collapsed-landscape/observer screenshots and audited
  all six U4a reach reports: one compact set of five and five expanded sets of 18
  controls, all with fitting nonempty text, 44px targets, exposure and center hits.

Evidence: `u4a-postcap-gates-report.md`, `u4a-postcap-devboot-report.json`,
`u4a-postcap-root-unit-audit.json`, `u4a-postcap-root-final-audit.json`,
`u4a-postcap-gate-freeze.json` and `u4a-postcap-gate-e2e-evidence/`. Only result/frontier
documentation changes after the gate freeze; production, tests and the player guide
remain byte-identical. The owner checkpoint has its own 26-path freeze,
`u4a-owner-checkpoint-freeze.json`.

The three final findings are repaired: disclosure survives temporary phone sheets
and resets when drawing ends; the phone guide describes the actual sheet; and the
handoff records both the unanimous-PASS and capped-owner-acceptance routes. No known
finding from the final union is left unrepaired. The achieved live mode and remaining
device/eraser-preview limits above still apply; no new coverage is claimed.

The [review-convergence skill](../../.claude/skills/review-convergence/SKILL.md)
requires: **“Cap the rounds at 3. Round 4 is escalation to the owner, not another
loop.”** All four lenses completed in each round; none is missing. This checkpoint
asks the owner to accept the verified U4a result and its scoped local commit despite
the non-unanimous final formal verdicts. The owner accepted continuation on 2026-09-26
with “Can you continue on now?” after being told acceptance was the remaining step.
Commit only the 26 owned paths with Codex attribution, then continue U4b.
No push, merge or deployment is authorized.
