# U4b — terrain footprints and Sample routing

Started 2026-09-26 in the existing `dev` checkout at accepted U4a commit
`681bc391` (parent `351b5485`). U3a/U3b/U4a remain accepted and closed.
Status: round 2's two bounded repairs pass focused/live checks, all eight gates and
isolated boot: 10,080 unit passes/four existing skips, 265 browser passes/three existing
skips, 138.88 KB gzip, zero browser errors/retries. Final round 3 is VOID/incomplete
after an agent-limit dispatch error. The owner accepted the verified checkpoint on
2026-09-26 with “Accepted”; the scoped local commit is authorized. The incomplete
final review remains recorded, without a unanimous final-review PASS claim.

Scope: square 1×1, 3×3 and 5×5 terrain brush footprints (default 1×1), matching
preview, continuous deduplicated strokes, and explicit Sample routing to Paint
for paintable materials or Place for objects. Ctrl/Cmd sample keeps its active
tool. Desktop gains the named Pin action already available on phone; shared
material pins/recents remain intact. Collection browsing remains U4c.

Preserve one App controller, one command/undo entry per stroke, zero commands on
cancel, document-coordinate placement, privacy and existing validation limits.
Terrain commands allow at most 16,384 unique cells with coordinate magnitude at
most 65,536. Grid sizes can be arbitrarily small positive numbers, so interpolation
must be clipped and bounded rather than iterating unchecked distances. Semantic
grid/material/size changes must not mix two stroke configurations; ordinary revision
or callback changes must retain the accepted U2 lifetime behavior.

Verification plan: strict current-behavior characterization before extraction;
compile-valid behavioral RED for footprints, fast motion, Sample and controls;
focused GREEN with boundaries/transforms/cancellation; two authenticated clients
with mouse and emulated touch, actual preview/commit/erase/Undo and mobile reach;
all eight ordered house gates plus isolated boot, then fresh bounded independent
review. Initial full gates passed; round 1 and its repaired focused/live results are
recorded below. R1-repaired full verification passed; R2 repairs and their focused/live
results are recorded last. Their full verification passes; final round 3 could not
complete. The owner checkpoint records that limitation and the local commit decision.

The five characterization files passed 55 tests before production edits, with
strict actual-root compilation. New regression roots then strictly compiled and
produced 21 behavioral failures/9 passes against the old implementation. The first
strict attempt had three invalid Testing Library selector options; that setup
failure is preserved and is not RED evidence.

The first implementation passed strict compilation and 703 focused tests, with
seven failures: two old cancellation expectations omitted the newly interpolated
middle cell, three expected Erase to have no settings, one Erase panel omitted the
shared section wrapper, and one new label fixture referenced a nonexistent Barrel
asset. The fixture now uses the real Crate asset; its earlier missing-readout failure
does not establish a valid Barrel label oracle. These failures and repairs remain
visible in `u4b-first-focused.log`. The initial footprint and fast-motion regressions
passed in that run. The initial repaired and expanded focused run passed **722 tests in
74 files**; all 47 current source/test roots strictly compile (`u4b-final-focused-types`).

Initial automated **live-two-client** desktop and 375px phone journeys plus two
existing touch-painting cases pass: four attempts, no failures/retries/flaky tests,
attempt errors or reporter errors (`u4b-browser-first`). They verify exact 1/9/25
cell previews and commands, Erase and single-stroke Undo on the observing player,
one-move interpolation, five-cell cancellation, explicit material/object Sample,
desktop Control/Meta preservation, pins and measured control reach. Map offsets,
transforms, negative indexes, fractional/tiny grids and protocol bounds have unit
coverage; those transformations were not driven through the browser UI.

Screenshot inspection found the phone dimensions wrapping between the numbers.
Strictly compiled `u4b-readout-red` failed with two text lines instead of one;
the nowrap size fragment passes the same phone journey (`u4b-readout-green`, one
attempt, zero failures/errors/retries). Its RED report retains one assertion error
and two raw step-ID diagnostic occurrences; failed screenshots were copied before
the next run. The passing journey also asserts Cancel is enabled during a held stroke.

Desktop screenshots exposed the sampled object name below the scroll area. A new
strict regression failed on the missing persistent readout (one failure/six passes,
`u4b-desktop-feedback-red`). The palette now keeps tool/selection above Done, and
the final focused run passes. Expanded live verification additionally checks that
desktop feedback is in view and reruns the existing short-desktop/phone build journeys.
The final `u4b-final-browser` run passes **six tests/six attempts** in 119 seconds,
with zero skips, failures, retries, flaky cases, attempt/reporter errors or raw
step-ID diagnostics. Root inspected the current desktop object/material feedback,
phone 5×5 preview and landscape feedback screenshots, plus all size/Pin and five-slot
reach records. Every measured control is at least 44px high with a reachable center
and fitting text. The automated live-two-client evaluation scores **7.9/10** against
the 7.0 threshold; its evidence and limitations are recorded in the ignored
`u4b-live-evaluation.md`. This is focused live evidence, not a full-gate or review verdict.

One browser strict-check attempt lacked the discriminator guard for RoomSnapshot
versus other server messages. It was fixed before any browser execution and is a
setup failure, not behavioral RED. Lint preflight passed before the desktop feedback
addition; the final snapshot also passes lint in the complete ladder below.

Browser mode is Chromium with trusted Playwright mouse/key and CDP touch input,
two separate authenticated identities, and read-only observation of the E2E seam,
WebSocket frames and real Konva preview nodes. No physical-device, WebKit or native
Mac coverage is claimed. No protocol, server or committed terrain renderer changes.

## Initial full verification — 2026-09-26

All eight gates pass in order under `u4b-recovered-gate-*`: build, typecheck, lint,
structure, format, full unit tests, client bundle and full E2E. Units total **10,066
passes/four existing skips**: 452 shared, 2,738 server and 6,876 client, across all
88 client batches. The bundle check reports **138.82 KB gzip / 175 KB**.

Browser raw summary and JSON agree: **265 passes/three existing skips**, 268 cases
and attempts in 24.2 minutes, zero failed attempts, retries, flaky cases, attempt
errors, reporter errors or raw step-ID diagnostics. Both U4b journeys pass. Root
compared the skipped titles with the accepted U4a report; the same three remain.
The isolated boot on 5176/8789 passes readiness, 30-second survival, final health
and client-module checks, empty error scan and owned-process cleanup. Existing
development services on 5174/8787 were preserved.

The original `u4b-gate-build` failed before pnpm started because the sandboxed
invocation could not load the installed pinned runtime. No approval rejection
occurred. The runner stopped and retained that report; no product build or test
ran in that attempt. Normal approved execution recovered with new unique prefixes
and the same 53 frozen authored paths. No source changes or green-test retries
were used to recover the setup failure.

Root independently reconciled every gate, all unit summaries, browser results and
boot evidence. All 53 gate hashes and HEAD `681bc391` match; all strict compiler
inputs remain unchanged. Current full-suite desktop object/material feedback,
phone 5×5 preview and landscape screenshots were inspected, along with all three
U4b reach reports. Evidence: `u4b-recovered-gates-report.md`, `u4b-root-final-audit.json`,
`u4b-root-unit-audit.json`, `u4b-devboot-report.json` and
`u4b-recovered-gate-e2e-evidence/`. Only result/frontier documents change afterward.

## Round 1 and bounded repairs — 2026-09-26

All four fresh independent STATIC reviews completed with zero semantic agent errors.
UI/state returned FAIL; tests/docs returned PASS. Root verified all 54 review paths
and HEAD. The union is **two findings**: P3 idle hover persists after canvas exit,
and P2 decimal grid division excludes mathematically complete edge cells.

Strictly compiled new regressions reproduced both: the boundary run had two intended
failures/11 passes, and the desktop browser run failed on the retained outline after
moving to Done building (one attempt/error, zero retries/reporter errors, two raw
step-ID diagnostic occurrences on one line). Both failed screenshots were copied
before another browser run. No production repair preceded those behavioral failures.

The Stage now routes mouse leave to an idle-cursor clear action while preserving held
strokes. Grid containment normalizes rounding-sized deviations at legal cell edges in
cell units, avoiding a pixel tolerance that would admit partial cells on tiny grids.
New tests cover both decimal document edges, preview/path/one-command output and three
genuinely partial exclusions, including a tiny-grid case. The browser journey checks
idle exit/re-entry for Paint/Erase at all three sizes and preserves a held stroke.

Repaired focused verification passes **759 tests/75 files**, including the existing
MapBoard suite, and all **47 actual source/test roots** strictly compile. Evidence:
`u4b-r1-before-red-types`, `u4b-r1-boundary-red`, `u4b-r1-hover-red`,
`u4b-r1-repaired-focused` and `u4b-r1-repaired-types`. The repaired browser run passes
**six cases/six attempts in 113.3 seconds**, with zero skips, failures, retries, flaky
cases, attempt/reporter errors or raw step-ID diagnostics. Root inspected the retained
hover failure, repaired desktop/phone held previews and all three valid reach records.
Evidence: `u4b-r1-repaired-browser-report.json` and decoded evidence directory.
Fresh round 2 remains pending. The initial full-gate counts above describe the
earlier snapshot; the repaired full results follow.

## R1-repaired full verification — 2026-09-26

All eight ordered gates and isolated boot PASS under `u4b-r1-repaired-gate-*`.
Units total **10,071 passes/four existing skips**: 452 shared, 2,738 server and
6,881 client, with all 88 client batches completed. The bundle is **138.87 KB gzip
/ 175 KB**. Browser raw output and JSON agree on **265 passes/three existing skips**,
268 cases/attempts in 24.3 minutes, zero failed attempts, retries, flaky cases,
attempt/reporter errors or raw step-ID diagnostics. The same three skipped titles
remain as in accepted U4a. Both U4b desktop/phone journeys pass in this full run.

Fresh boot on 5176/8789 passes server/client/module readiness, 30.049-second survival,
final health/module checks, empty error scan and cleanup of both owned processes.
Existing development ports were preserved. Root independently checked every result,
all 54 frozen hashes, HEAD and all strict compiler inputs; none changed during gates.
Current desktop object/material feedback, phone 5×5 pending footprint and landscape
screenshots were inspected, along with all three valid size/Pin/five-slot reach records.
Only result/frontier documents change before the fresh round-2 review freeze.

Evidence: `u4b-r1-repaired-gates-report.md`, `u4b-r1-repaired-root-final-audit.json`,
`u4b-r1-repaired-root-unit-audit.json`, `u4b-r1-repaired-devboot-report.json` and
`u4b-r1-repaired-gate-e2e-evidence/`. R1's two findings and four completed STATIC
assignments remain the historical review result, with zero semantic agent errors.

## Round 2 and bounded repairs — 2026-09-26

Four fresh independent STATIC reviewers completed with zero semantic agent errors.
UI/state FAIL; tests/docs PASS. Root verified all 54 reviewed hashes and HEAD unchanged.
The union is **two P3 findings**: the footprint remains after ordinary touch release,
and raw decimal cursor/path quotients can choose the preceding interior cell. Both R1
repairs improved; neither finding is a regression caused by those repairs. Counts are
**2 → 2**, eight completed assignments; the next formal round is the third and final.

Three actual regression roots strictly compiled before production changes. The unit
RED produced four intended failures/34 passes: two retained touch outlines and two
wrong exact-boundary cells. Nearby points and mouse release cases passed. The real
phone CDP journey then failed on a retained 50×50 outline after lift (one attempt/error,
zero retries/reporter errors, two raw step-ID diagnostics on one line). Both failure
images were preserved before another browser run; root inspected the phone failure.

The tool now clears its cursor after touch brush release while retaining mouse hover.
Cursor and path grid coordinates now use the same bounded cell-unit normalization as
document edges. New tests cover Paint/Erase with touch/mouse release, exactly 12 unique
committed cells in one command, repeat release, decimal interior boundaries and nearby
points including a tiny grid. Existing partial-cell exclusions remain intact.

Repaired focused verification passes **768 tests/75 files** and all **47 actual roots**
strictly compile with unchanged inputs. The expanded browser run passes **six cases/six
attempts in 115.4 seconds**, with zero skips, failures, retries, flaky cases, attempt/
reporter errors or raw step-ID diagnostics. Every real CDP release now asserts an empty
footprint; the held previews, exact command cells, observer state, Undo and cancellation
checks remain. Root inspected the current phone held/post-release state and all three
valid reach records. Decimal/tiny-grid evidence remains unit-level, not a browser claim.

Evidence: `u4b-r2-union.md`, four R2 reports, `u4b-r2-before-red-types`,
`u4b-r2-unit-red`, `u4b-r2-touch-red`, `u4b-r2-repaired-types`,
`u4b-r2-repaired-focused` and `u4b-r2-repaired-browser` with decoded evidence.
Fresh full gates/boot and final R3 remain pending. Earlier full results describe the
R1-repaired snapshot; no full-gate claim is made for these latest repairs yet.

## R2-repaired full verification — 2026-09-26

All eight ordered gates and isolated boot PASS under `u4b-r2-repaired-gate-*`.
Actual totals: **10,080 unit passes/four existing skips** (452 shared, 2,738 server,
6,890 client across all 88 batches); **138.88 KB gzip / 175 KB**; **265 browser
passes/three existing skips**, 268 cases/attempts in 24.1 minutes. Raw summary and
JSON agree, with zero failed attempts, retries, flaky cases, attempt/reporter errors
or raw step-ID diagnostics. The skipped titles match accepted U4a. Both U4b journeys
pass, including ordinary touch-release cleanup in this full run.

Boot on 5176/8789 passes readiness, 30.059-second survival, final health/module checks,
empty error scan and owned-process cleanup; existing development ports were preserved.
Root independently audited all 54 hashes, HEAD, all strict inputs and every result.
No source, test or document changed during gates. Root inspected current desktop
material feedback, phone held/released previews and landscape feedback, plus all
three valid reach records. Only five result/frontier documents change before R3.

Evidence: `u4b-r2-repaired-gates-report.md`, `u4b-r2-repaired-root-final-audit.json`,
`u4b-r2-repaired-root-unit-audit.json`, `u4b-r2-repaired-devboot-report.json` and
decoded `u4b-r2-repaired-gate-e2e-evidence/`. Formal counts remain **2 → 2**, eight
completed STATIC assignments and zero semantic agent errors. Four fresh final-round
reviewers are next; U4b is not committed and no remote delivery is authorized.

## Verified owner checkpoint — final review incomplete

U4b is implemented and fully tested in the preserved `dev` checkout at `681bc391`.
It adds 1/3/5-cell terrain footprints and matching previews, continuous deduplicated
strokes, explicit Sample routing, shared settings, named Pin controls and persistent
armed feedback. All four confirmed R1/R2 findings are repaired and verified.

Final R3 hit the tool error **`agent thread limit reached`** while dispatching the
documentation reviewer. The state/authority/privacy reviewer never started. The UI
and test-validity reviewers had started; they stopped expanding their reviews and
filed **partial STATIC reports without PASS verdicts**. Neither established a new
actionable defect, but neither completed its full assigned coverage. R3 is **VOID /
INCOMPLETE**, not a finding-free approval. This was an agent-capacity error, not an
automatic approval-review rejection. No fourth formal review was attempted.

Review accounting is **2 → 2 → INCOMPLETE**: eight completed assignments across R1/R2,
two partial assignments in R3, **one R3 dispatch error**, and two unperformed R3 lenses.
Root checked both partial reports and all 54 review hashes/HEAD; no authored file
changed during review. Only the five result/frontier documents change for this checkpoint.
Source, tests and the player guide retain the fully verified bytes.

The latest verified result remains **10,080 unit passes/four existing skips**, **265
browser passes/three existing skips**, **138.88 KB gzip**, all eight gates and fresh
boot PASS, zero browser failures/errors/retries. Strict compilation covers all 47
actual source/test roots; focused checks passed 768 tests and six browser cases.
Device limits remain Chromium emulation, without physical-device/WebKit/native-Mac
claims. There is no currently established unrepaired product finding; the outstanding
limitation is incomplete independent final review.

Evidence: `u4b-r3-incomplete-review.md`, `u4b-r3-ui-review.md`,
`u4b-r3-tests-review.md`, `u4b-r3-review-freeze.json`, and the complete R2-repaired
verification records above. Cost record: eight full reviewer assignments, two partial
assignments and one failed dispatch; three full U4b browser runs took 24.2, 24.3 and
24.1 minutes. No monetary or token-cost figure is available.

The [review-convergence rule](../../.claude/skills/review-convergence/SKILL.md) says
an errored result is "VOID" and requires escalation at the final-round cap. **The
owner accepted this concrete checkpoint on 2026-09-26 with “Accepted”, authorizing
the scoped local commit despite the recorded incomplete final review.** Commit the
54 owned paths with attribution, verify the committed tree and continue to U4c under
the existing onward authorization. No fourth review. Do not reopen accepted
U3a/U3b/U4a/U4b checkpoints or repeat unchanged green
tests. No push, merge or deployment is authorized.

Ignored evidence stays in `output/interface-u3a-execution/u4b-*`. No push, merge
or deployment is authorized.
