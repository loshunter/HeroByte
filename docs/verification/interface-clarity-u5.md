# U5 — Properties and ambient light

Status: owner authorized the two final R3 repairs and required verification with
“Proceed” on 2026-09-27. Both repairs have compiled behavioral RED and focused
GREEN, and the full ladder and dev boot now PASS on the combined tree (see the
verified checkpoint below). R1 and R3 remain VOID; no fourth review ran. The owner
accepted this verified checkpoint with "yes" on 2026-09-27. Scoped local commits on
`dev`: the door-pan fix (`eb28f30a`) alone, then U5, on accepted U4c
`a56e92e12a387dc31da27b0176dc75fc32d16b27`. No push, merge or deployment. Earlier
accepted checkpoints remain closed.

## Verified checkpoint — interrupted run, door-pan fix, full gates PASS

The `u5-postcap-gate-*` ladder passed build, typecheck, lint, structure, format,
full units (**10,148 PASS/four existing SKIPs**) and bundle (**143.35 KB/175 KB**).
Its browser suite was then cut off when the executing agent hit its usage limit:
the raw log stops at case 87 of ~274 with no final JSON, exit record or verdict,
so it is **not** a browser result. Boot did not run. Before the cut-off, one case
failed: Atlas touch ownership at line 276, the player's door read `open` after the
player's own middle-button pan toward it.

This was a real, pre-U5 product bug, not a timing flake. The server log shows the
player's uid sending `toggle-door` during that pan. Konva fires `click`/`tap`
whenever press and release land on the same shape, for any mouse button and with
no movement slop, and a pan carries the door along under the pointer. So any pan
that started on a door (left-drag in the default mode, middle-drag, or one-finger
touch) swung it for the whole table. The Atlas case hit it only when the random
door sat where its bounded pan began, which is why earlier full runs passed.

Repair, in its own scope: `DoorsLayer.tsx` records the press point on the door's
hit line and ignores the activation if the button is not primary or the release
moved more than 8 CSS px. Still clicks, still taps and the DM's alt-click lock
cycle are unchanged. Seven new `DoorsLayer.test.tsx` cases: five failed before the
repair (middle, right, primary drag, finger drag, stale press) while both still
click/tap positive controls passed; all 20 pass after it. New
`apps/e2e/door-pan.spec.ts` drives a DM, a desktop player and a 375 px touch player
on a seeded dungeon. Setup pans press only door-free canvas; each tested pan
presses the door (Konva hit test), is held until the door is back under the
pointer, and must send no `toggle-door` and leave the door shut on all three
clients. A still click/tap on the same door must then swing it for all three.
Against the pre-repair file it failed for left-drag, middle-drag and touch (a
first version released faster than Konva redrew and missed the left case; the
held release fixes that oracle). With the repair it passes, as do the Atlas
touch-ownership and dungeon smoke specs. Codex's 350 ms Atlas launcher separation
is unchanged.

Full ladder on the combined tree (U5 plus this repair), run by the gates-runner:
shared build, lint, format:check, structure guard and both typechecks PASS. Units:
**10,155 PASS/four existing SKIPs** (452 shared, 2,738 server, 6,965 client), the
earlier 10,148 plus the seven door cases. Browser: **272 PASS/three existing SKIPs**,
zero failures or flaky cases, 21.0 minutes, retries off. The three skips are the
accepted baseline (`map-navigation.spec.ts` ×2, `ui-state.spec.ts`). Dev boot PASS:
server and Vite ready, no export/syntax errors. Bundle, run separately: **143.35
KB/175 KB**. Logs: `.tmp/gates-20260927-144241/`. This run did not repeat the
hash-freeze and root-audit ceremony of earlier checkpoints; the tree was not
edited while the ladder ran.

## Authorized final repairs — verified

The owner's “Proceed” authorizes the bounded remount and accessibility proposal
below. `currentMyStuffAssets` returns a copied current-session snapshot to both
the shelf initializer and summary resolver, with validated persistent fallback
before a session mutation. Empty snapshots preserve removals despite stale storage.
Direct Lighting and both Layers sliders now expose percentage value text; direct
Lighting links its Dark → Daylight help through a unique React ID.

Four real-hook regressions cover failed-write upload/replacement, empty and stale
storage, remount, removal, a later upload and copied consumer entries. Four ambient
regressions cover all three sliders at 20%, 0%, 100%, unique endpoint descriptions
and in-progress gesture value text. Strict compilation precedes eight intended
unit failures/eleven passes (`u5-postcap-unit-red`). A browser message-union guard
initially failed compilation; that was corrected before browser RED and is not
behavioral evidence. Three browser REDs then reproduce missing desktop/phone
percentage text and the uploaded item disappearing on picker reopen.

After repair, **194 tests/24 files PASS**, as do **34 strict roots/1,040 inputs**
and stable formatting. One intermediate focused failure exposed test-session
leakage: storage was reset while the module cache persisted. The upload-hook and
phone-picker suites now start fresh module sessions between cases, retaining every
assertion and same-case remount state. The failure remains recorded.

The two property/lighting journeys PASS in `u5-postcap-browser-verified`; that
combined run remains FAIL because the new upload test's reused inspector helper
required an unrelated X field to be 100% in view (observed 0.9954). Earlier the new
test omitted Free stamp activation, and later targeted the fields group instead
of its sibling summary. These test-input/oracle failures and traces are preserved;
no production change or existing reach assertion was weakened to resolve them.
The corrected upload-only journey, `u5-postcap-upload-green`, PASSes in 10.3 seconds
(35.4 seconds reported total), zero errors/retries/raw step diagnostics. It blocks
only inventory storage writes, uploads real PNG bytes, reopens/replaces/reopens,
places through real input, checks the player's matching upload and DM summary,
and confirms storage stayed empty. Earlier failed runs have teardown step-ID
diagnostics; their causes are not claimed fixed by this selector correction.

Root's `u5-postcap-focused-audit.json` records the two earlier passing cases and
corrected third case without relabeling a failed run as PASS. It confirms unchanged
strict inputs, only the upload spec changed since the earlier cases, **20 reach
reports/78 controls**, matching receipts and both clients' uploaded asset. Saved
images show the Copper torch summary and shared placement. Live mode is automated
**live-two-client Chromium emulation**; physical devices, actual screen readers,
native zoom and first-time human testing remain unperformed. The storage remount
now has a real browser failure drill; removal/copy isolation remains unit evidence.

All **58 authored paths** were then frozen for `u5-postcap-gate-*`. That run was
cut off in its browser suite; its outcome and the later full ladder are recorded
in the verified checkpoint at the top. No fourth semantic review, U5 commit or U6
follows automatically. Preserve accepted U3/U4 and all failed evidence.

## Contract

Desktop and phone share document/element-scoped drafts. One Save changes action
queues the existing general-property and door commands, each with its own matching
outcome. This remains two operations and may need two Undo map edit actions.
Partial failure retains only unsaved fields for retry. Unknown completion requires
an identified refresh and deliberate inspection; queue idle or revision is not an
acknowledgement. Selection offers Save changes, Discard changes and Keep editing.

Ambient light belongs in Lighting, reusing the existing lighting-layer opacity.
Percentages, Dark → Daylight endpoints, collapsed advanced properties and visible
units must remain reachable on desktop, phone, tablet and short landscapes.

## Owner checkpoint — final review void, two repairs proposed

Historical R3 stop: the owner subsequently authorized the proposal above. The
review remains VOID; the following findings describe the snapshot before repair.

All four final R3 lenses completed in STATIC mode: documentation FAIL/one P3,
state FAIL/one P2, UI FAIL/one P3 and tests FAIL/one P3. The tests finding duplicates
the state's upload-remount finding, giving **three unique retained flags**.
Runtime/dispatch `agents_error: 0`; no R3 lens was missing or unperformed. However,
the tests reviewer disclosed that a broad search inadvertently returned one line
from the peer documentation report. They did not open or rely on that report,
but strict peer-output independence was breached. R3 is therefore **VOID**, not a
valid complete independent verdict. Reports are preserved as
`u5-r3-{docs,state,ui,tests}-review.md` under the ignored execution directory.

The retained findings and disposition are:

1. **P2, open — session-only uploads revert or disappear after picker remount.**
   `myStuffStore.ts` updates its session mirror before a failed storage write,
   while `useMyStuffAssets.ts` initializes a new picker from persisted storage.
   With blocked writes, replacing **Old torch** with **Amber torch.png** then
   closing/reopening My uploads restores the old shelf name; an initially empty
   persisted list loses the new shelf item. A later shelf mutation can overwrite
   the current session inventory. The existing regression never remounts the hook.
2. **P3, open — ambient sliders lack accessible percentage value text.** The
   direct Lighting and both Layers sliders expose 0.2 on a 0–1 range while showing
   20% visually. The direct Dark → Daylight help has no accessible association.
   This is a static markup finding, not a claim about a tested screen reader.
3. **P3, checkpoint bookkeeping addressed — stale current status.** The live
   Remaining section and IA-11/IA-12 disposition directed a reader back to R2 and
   called pre-R2 numbers latest. This checkpoint updates those instructions and
   labels the older counts historical. No fresh review PASS is claimed.

Proposed bounded work, **pending owner direction**: expose a copied current-session
upload snapshot and use it for both shelf initialization and summary lookup, with
validated persistent fallback before a session snapshot exists. Preserve upload,
replacement, removal and cap semantics. Add strictly compiled behavioral RED tests
using the real hook with throwing storage writes, unmount/remount after upload,
replacement and removal, initially empty and stale persisted lists, and a later
upload that must preserve earlier session entries. Require shelf/summary agreement.
For all three ambient sliders, expose percentage `aria-valuetext`; associate the
direct slider's endpoint help through a unique description ID. Add regressions for
20%, 0%, 100% and the endpoint description, proving RED before repair.

After authorization, verify focused store/hook/property/lighting tests, actual strict
roots, affected browser paths, the exact fail-fast eight-gate ladder and isolated
boot, then audit hashes and evidence and return a verified owner checkpoint.
No automatic fourth semantic review, U5 commit or U6 work is authorized by this
proposal. Do not reopen accepted U3/U4 checkpoints or push, merge or deploy.

Round history is **VOID (five retained) → valid FAIL (three) → VOID (three retained)**.
This is not a valid plateau trend. R1 had one completed/two partial/one undispatched
assignment and one dispatch error; R2 and R3 each completed all four lenses.
Across U5, eleven semantic agents launched plus one failed dispatch. Captured cost
so far: **108 completed command receipts, 226.843 summed command minutes**, including
59 full-gate commands/206.5956 minutes. Twenty-three nonzero receipts include intended
REDs and setup/format failures, not 23 product defects. The interrupted browser run
has no final receipt and is excluded. Standalone strict compilation and boot time
are separate; token/billing cost and total elapsed task time are unavailable.
See `u5-cost-summary.json` for the accounting limits.

The [review-convergence rule](../../.claude/skills/review-convergence/SKILL.md) says:
“At round 3, on a plateau, or on any voided run, stop and report to the owner”.
Both the cap and VOID status apply. No repair or replacement review followed R3.
Root verified all 53 review hashes, HEAD, full inventory and empty staging at
2026-09-27 13:20 UTC. Only the five result/frontier documents change afterward for
this checkpoint; source, tests and user guide retain their verified/reviewed bytes.
The post-review documentation audit and new owner-checkpoint freeze are recorded
as `u5-r3-checkpoint-doc-audit.json` and `u5-owner-r3-checkpoint-freeze.json`.

## Historical verified snapshot — before final R3

The corrected `u5-r2-format-gate-*` ladder passes all eight exact commands in
order. Full units: **10,140 PASS/four existing SKIPs** (452 shared, 2,738 server,
6,950 client), all 91 client batches. Bundle: **143.28 KB/175 KB**. Full browser:
**270 PASS/three existing SKIPs** in **23.6 minutes**, 273 cases/attempts, zero
failures, retries, flaky cases, attempt/reporter errors or raw step-ID diagnostics.
The three browser skips match the accepted baseline. The interrupted formatting
attempt below retains its failed status and incomplete browser evidence.

Fresh `u5-r2-devboot` passes server/client/module readiness, **30,027 ms** survival
and owned-process cleanup on 5176/8789. Root's `u5-r2-root-final-audit.json` confirms
all **53 frozen hashes**, HEAD/full inventory, empty staging and **31 strict roots /
1,038 unchanged inputs**. Both four-command property/lighting evidence sets have
matching receipts. Nineteen reach reports cover **77 valid controls**. Atlas has
two trusted launcher clicks, canceled aim touch, one link, no extra door toggle
and no compatibility mouse stream. Phone saved-state and short-landscape images
were inspected; all copied browser evidence and the runner report are preserved.

Actual live mode remains **live-two-client**, Chromium emulation. Functionality,
multiplayer integrity, craft and reach remain **8/8/8/8**, weighted **8.0/10**.
Physical devices, native zoom, screen-reader use and a first-time human study remain unperformed.
Boundary scale submission and failed-storage naming have controller/component
evidence; only the scale draft interaction is additionally driven with real touch.
No separately injected browser storage-failure drill is claimed. No new live finding
is established by the current checks. The bounded Atlas timing change still does
not claim a production/physical-device gesture correction.

Only five result/frontier documents changed between this green gate freeze and
the final R3 freeze. Four fresh pinned STATIC lenses ran in two batches of two;
the independence lapse and retained findings are recorded in the owner checkpoint
above. No source/test/user-guide edit followed verification or R3. No U5 commit yet.

## R2 — three findings and bounded repairs

All four independent, pinned STATIC reviewers completed in two batches of two,
with `agents_error: 0`. UI FAIL: one P2; documentation FAIL: two P3; state/privacy
and test validity PASS with no established findings. All 52 review hashes, HEAD,
full changed/untracked inventory and empty staging matched before/after. Reports:
`u5-r2-{ui,docs,state,tests}-review.md`. R1 remains VOID with five retained flags;
R2 is valid with three unique flags. The later R3 outcome is recorded above.

The phone resize buttons previously clamped numeric scales to 0.1–10: Bigger
turned 20 into 10, and Smaller turned 0.05 into 0.1. The repair retains 0.1 steps,
removes the upper clamp and enables a button only when both finite positive axes
would move in its named direction. Smaller is disabled at/below its 0.1 step floor;
numeric positive scales remain saveable. The uploaded summary now reads the latest
local session shelf mutation even if persistence throws; replacing/removing an entry
also overrides stale storage. The old 143/12 “Latest” paragraph below is explicitly
historical, preserving its counts while pointing to the later checkpoints.

`u5-r2-compiled-red-types` strictly compiles the new actual regression root before
`u5-r2-repairs-red` records three intended behavioral failures/nine passes: stale
uploaded name, reversed Grow and enabled Shrink below the floor. After the two
production fixes, `u5-r2-repairs-focused` passes **170 tests across 20 files**,
including the existing upload store/hook checks. The new name regression uploads
through the real shelf hook, checks session selection, replaces the same hash and
removes it against failed writes and stale persisted names. Phone tests inspect
draft values and submitted transforms. The browser journey additionally stages
both boundary values with real touch, then restores normal scale before its existing
two-client save/lighting checks. `u5-r2-repaired-types` passes all **31 actual roots**
and **1,038 unchanged compiler inputs**. `u5-r2-phone-green` passes in 30.3 seconds
(51.9 seconds reported total), with zero failures, retries, flaky cases, attempt/
reporter errors or raw step-ID diagnostics. Eleven reach reports cover **44 valid
controls**, and all four property/lighting commands have matching receipts.
Root's `u5-r2-focused-audit.json` confirms these counts and unchanged strict inputs;
the short-landscape image was inspected. The upload-name failure remains a real
hook/component drill, not an injected browser storage failure. Full gate/boot
results for the **53 authored paths** and final R3 are recorded above.

### First R2 gate attempt — formatting failure and fail-fast correction

`u5-r2-gate-*` passes build, typecheck, structure, full units (**10,140 PASS/four
existing SKIPs**, all 91 client batches) and bundle (**143.28 KB/175 KB**).
Lint and format fail on the new upload test's chained-call layout. The earlier
single formatter write did not produce stable formatting. The runner continued
under its older guidance until the current arc plan §8 fail-fast rule was noticed;
the in-progress browser suite was stopped. Its raw log contains ten partial list
results, no final JSON/exit record and **no browser verdict**. Boot did not run.
Owned test processes were stopped; user services were preserved. The runner report
and `u5-r2-interrupted-audit.json` retain this failed attempt and verify all 53
hashes/HEAD/inventory and 31 strict roots/1,038 inputs unchanged.

A second scoped formatter write fixes the declaration. A subsequent formatter
check and targeted ESLint pass. `u5-r2-format-declaration-audit-v2.json` proves only
whitespace in that declaration changed and its parsed syntax is identical. Earlier
raw-scanner/raw-source-inclusive audit attempts remain preserved as invalid syntax
comparisons, not behavior failures. `u5-r2-format-types` strictly passes all 31 roots.
The fresh fail-fast `u5-r2-format-gate-*` ladder and `u5-r2-devboot` then pass as
recorded above. No third semantic review had run before that green checkpoint.

## Verified snapshot before R2

`u5-gesture-gate-*` passes all eight full commands in the required order.
Units: **10,137 PASS/four existing SKIPs** (452 shared, 2,738 server, 6,947 client),
all 91 client batches. Entry bundle: **143.18 KB/175 KB**. Browser: **270 PASS/three
existing SKIPs** in 23.5 minutes, 273 cases/attempts, zero failures, retries, flaky
cases, attempt/reporter errors or raw step-ID diagnostics. The three skips match
the accepted baseline. Earlier failed runs below remain failures.

Isolated `u5-r1-devboot` passes server/client/module readiness, **30,036 ms** survival
and owned-process cleanup on 5176/8789. Root's `u5-r1-root-final-audit.json` confirms
all **52 frozen paths**, HEAD/full inventory, nothing staged, all **29 strict roots**
and **1,038 compiler input hashes**. Both four-command property/lighting evidence
sets have matching receipts; 19 reach reports cover **77 valid controls**. Atlas
records two trusted DM launcher clicks, canceled aim touch, one link, no extra
door toggle and no compatibility mouse stream. Final phone saved-state, Lighting
and short-landscape images were inspected. Browser mode remains live-two-client
Chromium emulation; the previously recorded physical-device and native-zoom limits
apply. The bounded timing correction does not claim physical-device gesture repair.

The runner report is `u5-gesture-gates-report.md`; 228 browser attachments are copied
under `u5-gesture-gate-e2e-evidence/`. Only the five result/frontier documents change
after the gate freeze for review. R2 used four pinned, independent, read-only
STATIC lenses in two batches of two; no reviewer may read another R2 report.
R1 remains VOID and counts toward the three-round cap. Any new agent error stops
the round at the owner; no replacement dispatch or false all-PASS verdict.

## Authorized repairs after R1

The owner authorized the five bounded repairs, verification and fresh review with
“yes” on 2026-09-27. The 50-path owner checkpoint and HEAD matched before edits.
R1 remains VOID; this is a repair phase, not an unrecorded replacement review.

Ambient light now holds a local value through pointer/keyboard gestures and submits
the final value on release or blur. Pointer cancellation drops the gesture; an
identified document key remounts the control on document switches. The existing
controller remains the only queue, and existing errors are shown beside the control.
Phone Properties remains available on a locked selection, with editing/Save disabled
and draft resolution reachable. Native numeric inputs preserve incomplete input as
an invalid draft, rather than coercing it to zero; Save stays disabled until valid.
Uploaded summaries use an available local shelf name plus a short content identifier,
or an identified Uploaded image fallback. The two stale phone guide paragraphs now
name Properties and its X/Y controls.

New checks strictly compiled before behavioral execution. The first strict run
found a missing width/height in the new typed stamp fixture; corrected before tests,
not claimed as behavioral RED. `u5-r1-repairs-compiled-red-types` passes two roots.
`u5-r1-repairs-red` then records six intended failures before production edits.
Trusted phone keyboard input also reproduces the numeric failure: typing `-25.5`
renders `025.5` (`u5-r1-keyboard-browser-red`, one failure/no retries). Its full
trace/screenshots and command evidence are copied and preserved.

The first repair run has 27 PASS/one FAIL: blur after pointer release cleared the
displayed ambient value while saving. The bounded correction ignores duplicate
commits without another pending value. Expanded regression checks cover cancellation,
keyboard repetition, refusal feedback, both locked phone disclosure states, and
document switches in both layouts. `u5-r1-repairs-focused` passes **152 tests across
18 files**, including nine new repair cases. The final incomplete numeric readout
uses a dash instead of exposing an internal invalid-number label.

`u5-r1-browser-green` completed desktop PASS/phone FAIL. Both clients' negative
typing and the phone's 75% → 50% → 20% drag assertions passed; trace calls show the
touch-end succeeded before cleanup incorrectly issued another touch-cancel. The
preserved diagnosis is `u5-r1-touch-cleanup-diagnosis.json`. The helper now cancels
only an active touch and always detaches its CDP session. Production is unchanged.
The failed run has one attempt error, no retries/reporter errors and two raw step-ID
diagnostics. The earlier intended keyboard RED also has two raw step-ID diagnostics;
both counts are preserved separately from JSON errors.

`u5-r1-touch-repaired-types` passes all **28 actual roots** with unchanged compiler
inputs. Only the affected phone journey was repeated: `u5-r1-phone-green` PASS in
36.2 s (59.4 s reported total), zero errors/retries/flaky cases/raw diagnostics.
The earlier desktop PASS remains evidence; its mouse path is unchanged. Both
journeys use real mouse/touch movement through three intermediate slider values,
assert no command before release, then require exactly one final layer command.
Trusted keyboard typing now retains `-25.5`. Separate DM/player clients still verify
matching save receipts, public lighting updates and private-data redaction.

Root's focused audit confirms 19 reach reports/**77 controls**, all at least 44 px
visible/hittable, and both four-command receipt sets. Phone saved-state and short
landscape screenshots were inspected. Actual mode: **live-two-client**, Chromium
emulation. Scores: functionality 8, multiplayer 8, craft 8, reach 8; weighted **8.0/10**.
Physical-device, native-zoom and first-time human limits remain unchanged. Locked
selection, refusal and asset-name repairs use the controller/component regressions;
they are not claimed as separately injected live browser drills.

Source formatting and diff whitespace pass. An extra direct guide-format check
found only two pre-existing hand-formatted tables, confirmed unchanged at accepted
HEAD; their proposal is preserved, with no cosmetic rewrite. The house format gate
does not include docs/. The repaired full ladder below ran against **51 authored
paths**; semantic R2 had not started at that checkpoint.

The first repaired full-gate dispatch (`u5-r1-gate-build`) did not execute a build:
the worker could not access the pinned pnpm entry point and also supplied the old
shared-only build arguments instead of the required `build`. The exit record and
runner report preserve both facts. No later gate or boot ran; all 51 frozen hashes,
HEAD/inventory and 1,037 strict input hashes matched. Root confirmed pnpm 10.17.1
is accessible with the existing runtime escalation. The corrected full attempt uses
`u5-r1-runtime-gate-*`, exact current arguments and runtime permissions. This is a
runner setup failure, not a product build failure or a semantic R2 result.

### Repaired full run — one menu-reopen failure

`u5-r1-runtime-gate-*` passed gates 1–7: **10,137 unit passes/four existing skips**
(452 shared, 2,738 server, 6,947 client), all 91 client batches, **143.18 KB/175 KB**.
Full E2E completed **269 PASS/one FAIL/three existing SKIPs** in 24.0 minutes:
273 cases/attempts, zero retries/flaky/reporter errors, one attempt error and two
raw step-ID diagnostics. All three U5 lighting/properties cases passed. Boot did
not run after failure. The copied browser evidence contains 227 files.

The failure is the unchanged Atlas touch-ownership test reopening the phone DM
menu after its ordinary door-touch controls. Playwright reports a completed tap,
but the launcher stays unpressed. Both clients' closed→open→closed door checks
already passed; the test has not reached the aimed-link/native ownership checks.
The cause is unproven. No weaker menu, door, link or privacy assertion is adopted.

Root's `u5-r1-failed-run-audit.json` independently verifies all 51 frozen hashes,
HEAD/full inventory and 1,037 strict inputs unchanged, exact gate arguments/order,
and the failed counts above. This is an integrity pass, **not a verification pass**.
The runner report is `u5-r1-runtime-gates-report.md`; all failed artifacts remain.
After freeze release, the actual Atlas root compiled strictly before adding
read-only native input/menu-state diagnostics. This adds one authored test path;
production is unchanged. Focused diagnosis, fresh full verification/boot and R2
remain ahead; accepted U4 checkpoints stay closed.

The strictly compiled diagnostic (`u5-r1-atlas-diagnostic`) reproduced the same
menu failure: trusted pointer/touch down/up reach the button without cancellation,
but no click or pressed-state transition follows. Its one attempt error and two
raw step diagnostics remain preserved. The new capture is passive/read-only.

Three bounded isolated-HTML probes distinguish the input sequence from HeroByte
state. Two canceled canvas taps without a pan produce the next button click in
all six mixed/same-session trials. Adding a pan suppresses it in all six trials.
The timing probe retains that failure at 160 ms between the final canvas release
and the button press (two trials), including longer 40/100 ms button presses
(two each). Separating the next gesture by 350 or 700 ms produces its click in
both trials at each interval. These are Chromium input experiments, not live app
acceptance or proof of its exact internal cause. Physical-device behavior remains
unverified. Reports: `u5-r1-touch-{channel,pan,timing}-probe.json`.

The Atlas test now separates its ordinary-door positive-control phase from the
next menu gesture by 350 ms. It still performs one real launcher tap, requires
the pressed state, and retains every aim/door/link/public-projection assertion.
No retry, larger timeout, forced click or production change was introduced.
`u5-r1-atlas-separated-types` passes **29 actual roots**. The focused real-table
case passes in 7.3 s (32.3 s reported total), zero errors/retries/flaky/raw markers.
Saved native events show the trusted launcher click and false→true transition;
all original two-client/native ownership checks pass. The initial full failure
and diagnostic reproduction remain failures. This is a bounded test-input
correction; it does not claim to fix rapid physical-device gesture handling.
Fresh full verification uses `u5-gesture-gate-*` on **52 authored paths**, then
the still-unperformed `u5-r1-devboot` and fresh R2.

## Owner checkpoint — review interrupted, five issues flagged

The first formal U5 round stopped when documentation dispatch returned
`agent thread limit reached`. The required review-convergence stop applies; no
replacement reviewer, repair, further round, U5 commit or U6 work followed.
Earlier owner acceptance closed U4c and authorized U5; it does not accept this
new checkpoint. The verified implementation remains uncommitted on `dev`.

The completed UI reviewer returned FAIL in STATIC mode with four findings. State
stopped with a PARTIAL STATIC report and two established findings, one overlapping
the UI guide finding. Test-validity stopped after reading the brief/manifest, before
semantic review or a before-review per-file hash check. It established no finding.
The documentation reviewer never started. R1 therefore has **one completed, two
partial and one undispatched assignment; agents_error: 1; no valid round verdict**.
Test-validity semantic work and the named documentation lens are unperformed;
state/privacy has partial coverage only. Counts: **R1 INCOMPLETE, five unique flags**
(six reported findings before merging the overlapping guide issue), not a converged
five-issue verdict. The complete UI report remains FAIL; partial reports are not PASS.

The preserved flags and proposed bounded repairs are:

1. Ambient dragging can be interrupted by disabling the range after its first
   intermediate update. Preserve the drag's local value and commit the intended
   value through the existing update path; pin pointer and keyboard behavior.
2. A phone draft becomes inaccessible when its selected element is remotely locked.
   Keep Discard/Keep editing reachable while fields and Save remain disabled.
3. Eager numeric parsing prevents naturally typing a negative coordinate. Preserve
   intermediate numeric text and validate before committing; pin real keyboard input.
4. Uploaded-image selections share the generic `Uploaded image` summary. Resolve an
   available local asset name and provide a distinct fallback for unnamed uploads.
5. The phone guide still says X/Y fields are absent and names the old Edit control.
   Align those adjacent instructions with Properties → Position and scale.

These are static findings, not fresh live reproductions. UI labels the first three
P2 and the guide P3; state labels uploaded names and its overlapping guide issue P2.
Reports: `u5-r1-ui-review.md`, `u5-r1-state-review.md`, `u5-r1-tests-review.md` in
`output/interface-u3a-execution/`. Root's `u5-r1-post-stop-audit.json` confirms all
50 review hashes, full changed/untracked inventory and HEAD remain unchanged after
the interruption, with nothing staged. Only five result/frontier documents are
updated afterward to record this checkpoint; source, tests and user guide stay frozen.

Cost so far: three pinned `gpt-6-sol` high review agents launched, one dispatch
failure, approximately 8.4 minutes from review freeze to the post-stop integrity
check. Captured U5 runner commands total 127.1 minutes across 55 exit records,
including 114.9 minutes for the four full-ladder attempts (27 executed gates).
Those figures exclude strict-compiler runs, agent reasoning, editing and idle time;
token/dollar cost is unavailable. The green final ladder and isolated boot below
remain valid for the unchanged implementation; they do not override these flags.

**Owner direction received 2026-09-27:** “yes” authorizes triage and bounded repairs for
the five preserved issues, regression/strict/focused/live checks and the full house
ladder/isolated boot, then a fresh bounded R2 if reviewers are available. Retain R1
as VOID and the three-round cap; any further dispatch error again stops at the owner.
This authorizes repairs and verification, not acceptance of the five unresolved issues.
Do not commit U5 or start U6 before the recorded verification/review closeout is satisfied.

## Pre-repair verified snapshot

The fourth full ladder (`u5-resize-gate-*`) passes all eight commands in the required
order. Full units: 452 shared, 2,738 server and 6,938 client passes, **10,128 total**,
four existing skips and all 91 client batches. Bundle: **142.82 KB / 175 KB**.
Full browser: **270 PASS / three existing SKIPs** in 29.9 minutes, 273 cases/attempts,
zero failures, retries, flaky cases, attempt/reporter errors or raw step-ID diagnostics.
The three browser skips match the accepted baseline. Isolated boot on 5176/8789
passes readiness, 30-second survival and owned cleanup; existing 5174/8787 remain.

Root's `u5-root-final-audit.json` independently checks exact command order/arguments,
all 50 frozen paths and HEAD, complete inventory, 27 strict roots and 1,036 unchanged
compiler input hashes. Both property command sets have matching member receipts.
All 77 measured controls across 19 reach reports pass; final desktop/phone saved-state
and short-landscape screenshots were inspected. Artifacts are copied under
`u5-resize-gate-e2e-evidence`; the runner report is `u5-resize-gates-report.md`.
Earlier failures below remain preserved. Only result/frontier documents are updated
after this audit for the independent review snapshot; implementation/tests stay frozen.

## Focused verification history

Artifacts are in ignored `output/interface-u3a-execution/`; failed attempts remain.

- `u5-characterization-types`: six actual strict roots PASS.
- `u5-characterization`: 69 baseline tests across six files PASS before extraction.
- `u5-before-red-types`: two invalid Testing Library selector options; corrected
  before execution. This setup failure is not behavioral RED.
- `u5-compiled-red-types`: four actual roots PASS.
- `u5-properties-red`: eight intended behavioral failures before production edits:
  absent combined Save, lost desktop draft, immediate phone door command, missing
  correlated action handles and mutable queued payload.
- `u5-operation-green`: 25 tests across four files PASS after the bounded action
  handle/payload change. No new queue, wire command or server transaction.
- `u5-properties-implementation-types`: old inspector fixture APIs and six layout
  toolbar fixtures required migration; no production diagnostics.
- `u5-properties-migrated-types`: seven actual roots PASS with unchanged inputs.
- `u5-property-ui-first-green`: 23 PASS, two FAIL. One malformed older element
  fixture lacked asset data; one Save button ignored its external disabled prop.
  Both were repaired and pass in the later focused set, including lifetime/recovery.

Further focused verification:

- `u5-lifetime-before-tests`: three actual strict roots PASS.
- `u5-lifetime-first-check`: 15 PASS/two FAIL, exposing a retained selection
  callback crossing documents and missing invalid-width guidance. Both repaired.
- `u5-ambient-before-red`: two actual strict roots PASS;
  `u5-ambient-red-lifetime-green`: seven lifecycle PASS/five intended ambient RED.
- `u5-recovery-detail-before-red`: two actual strict roots PASS;
  `u5-recovery-detail-red-lighting-green`: eight PASS/two intended recovery RED.
  Refresh must wait for every pending member, and inspection must show all saved
  fields. Both repaired; confirmed members remain named alongside uncertain ones.
- `u5-properties-lighting-focused-types`: all twelve authored client roots PASS.
- `u5-properties-lighting-focused`: 142 PASS/one FAIL in 17 files. The remaining
  old palette inventory omitted Lighting's new phone settings panel. Corrected;
  `u5-palette-repair-green`: all four inventory checks PASS. The complete affected
  set is 143 passing cases across these runs; unchanged cases were not repeated.
- `u5-browser-initial-types`: helper accidentally shadowed the browser `document`
  with a map document. Corrected to `window.document` before browser execution;
  this is a setup/type failure, not behavioral RED. The corrected strict checks pass.

Implemented Lighting's shared ambient slider, percentage/endpoints, phone sheet
retention and Layers percentages. Updated the map-editor guide and four affected
browser paths. Added a real-server two-client property/lighting journey with a
withheld final member receipt, public-revision checks and non-vacuous hidden-door
redaction. Browser execution and rendered reachability pass as recorded below.

## Focused live verification

Historical pre-R1 focused checkpoint: 143 affected unit cases and twelve affected
browser journeys passed across these bounded runs. The later R1 repair run passes
152 tests across 18 files; the affected browser set grows to thirteen below, and
the pre-R2 full ladder passes 270 browser cases. No failed attempt was erased
or silently retried. `u5-landscape-browser` passes desktop; phone exposed the shared
coarse-pointer selector overriding the 48 px input rule. A scoped specificity repair
fixes that override. `u5-phone-landscape-browser` passes the phone journey in 32.2 s
(54.8 s total) with zero attempt/reporter errors, retries or raw step-ID diagnostics.
Its complete copied evidence includes portrait, landscape and tablet reach reports.

The browser mode achieved is **live-two-client** with separate DM/player contexts,
real local server and trusted mouse/touch gestures. The final member's real reply
is held while public snapshots arrive: Save stays pending until that reply is
released. Door state/position/width use two command identities and matching receipts;
hidden-door geometry disappears from the player after a positive visible control.
Both clients receive ambient 20% at the acknowledged revision; the player receives
public light pools and no private document or compiled light geometry. Reopening
Lighting/Layers retains the value. Dirty properties survive closing/reopening during
resize. All measured controls retain at least 44 px of visible, hittable area.

Root inspected saved desktop/phone Properties screenshots and the painted-floor
player lighting screenshot. Live scores: functionality 8, multiplayer integrity 8,
craft 7.5, reach 8; weighted **7.9/10**. The bounded short-landscape clipping and
phone CSS precedence regressions are repaired. Coverage uses Chromium emulation
at 375×812, 812×375, 820×1180, 1280×720 and 640×360. The last is a 200%-equivalent
viewport, not native browser zoom. Physical devices and a first-time human study
were not run; rejection/unknown-completion drills use the real controller harness,
while the browser injects only delayed delivery. These limits remain explicit.

The final strict check (`u5-final-types`) passes all 26 actual roots with zero
diagnostics and unchanged inputs/loaded sources. Additional resize screenshots are
attached by the final browser spec without changing its assertions.

`u5-browser-focused` completed 10 PASS/two FAIL in 231.5 seconds, zero retries.
All ten migrated existing journeys pass. Both expanded U5 journeys expose a real
short-landscape target clipping issue: visible Door width height 43.53125 px,
below the required 44 px. Labels also scrolled above the short settings area.
Artifacts, screenshots and traces are preserved in `u5-browser-focused-evidence`.
The bounded U5 CSS repair gives fields/actions 48 px boxes and places labels beside
fields at viewport heights ≤500 px. The reach check scrolls the associated field
label into view and still requires ≥44 px visible hit area. Strict compile passes;
`u5-landscape-browser` then passed desktop and exposed the phone specificity issue
resolved by the final phone run above.

The first browser run (`u5-browser-first`) finished one phone PASS/one desktop FAIL
in 70.8 seconds with zero retries. Desktop reached its final small-viewport check,
then the test incorrectly used touch input in a mouse-only context. The captured
attempt error and raw step-ID diagnostics remain preserved. Input is corrected;
expanded checks now measure property fields/actions after resize and preserve drafts
across closing/reopening. A real painted floor makes lighting screenshots meaningful.
Initial screenshots and all command/receipt/geometry artifacts were copied before
the next run. `u5-browser-corrected-types`, `u5-browser-reach-types` and
`u5-browser-ground-types` PASS with unchanged inputs. The affected 12-case browser
run and its bounded repairs are recorded above; final full results are at the top.

## Full verification history

The third ladder (`u5-light-gate-*`) again passed gates 1–7 with the same unit and
bundle counts. E2E finished 269 PASS/three existing SKIPs/one FAIL in 30.0 minutes,
273 attempts, zero retries/flaky cases, one attempt error and zero reporter errors.
Two raw step-ID diagnostics appeared on one coalesced line after the failed test;
they remain preserved separately from the JSON error counts. The migrated legacy
Light test and the phone Properties journey pass. Desktop Properties timed out
finding Ambient light after resizing to 640×360. Trace inspection shows the test's
immediate `isVisible` branch ran before the responsive layout committed, skipped
opening Tools and then looked for its hidden slider. The failed screenshot shows
the compact shell with Tools closed. All 50 frozen hashes, HEAD, full inventory
and strict inputs matched afterward; copied evidence is `u5-light-gate-e2e-evidence`.
The bounded test repair now awaits the expected compact/desktop navigation before
opening settings. Production, timeouts, retries and reachability assertions are
unchanged. `u5-resize-types` passes all 27 actual roots, and formatting passes.
Both affected journeys (`u5-resize-focused`) pass in 77.2 s, zero attempt/reporter
errors, retries, flaky cases or raw step-ID diagnostics. All artifacts are copied.
These repairs preceded the fourth full ladder and boot recorded above. No formal
review was run against the failed snapshot.

The second full ladder (`u5-repaired-gate-*`) passed gates 1–7: 10,128 unit passes,
four existing skips, all 91 client batches and 142.82 KB gzip against 175 KB. Full
E2E finished 269 PASS/three existing SKIPs/one FAIL in 30.3 minutes, 273 attempts,
zero retries/flaky/reporter errors/raw step-ID diagnostics and one assertion error.
The older mobile Light placement test expected automatic sheet closure. U5 keeps
Lighting open for its ambient control, so the test now verifies that control and
uses To the map before retaining the original tap/drag light-count assertions.
The original file strictly compiled before migration; production behavior is unchanged.
Both new U5 journeys passed. All 49 frozen hashes, HEAD, full inventory and 26-root
strict inputs matched after the run. Copied screenshots, video and trace are in
`u5-repaired-gate-e2e-evidence`; root's failure audit confirms the same single failure.
Boot and formal review did not run. `u5-light-repaired-types` passes all 27 actual
roots with unchanged inputs. The repaired journey (`u5-light-migration-focused`)
passes in 8.8 s (35.7 s total), with zero attempt/reporter errors, retries, flaky
cases or raw step-ID diagnostics. Its original placement assertions are retained;
formatting passes. The affected set is now thirteen passing browser journeys.
The subsequent full ladder is recorded above.

The first full ladder (`u5-gate-*`) passed build and typecheck, then stopped at
lint: `ElementPropertiesForm.tsx` had one unescaped JSX apostrophe in the inspection
button. It is now escaped without changing the rendered label. Gates 4–8 and boot
did not run. All 49 frozen hashes, HEAD, inventory and strict inputs matched after
that failed run. The failure artifacts remain; the following strict checks and
full ladders include the bounded repair.

## Remaining

None for U5. The full ladder and boot pass on the repaired snapshot plus the
door-pan fix (see the verified checkpoint at the top); the owner accepted it and U5
is committed locally on `dev` after the separate door-pan commit. R3 remains VOID
and recorded; acceptance does not turn it into a review PASS.
U4c's accepted incomplete review does not waive U5's checkpoint. No remote action
has occurred. After U5 closes, U6 is “Current map, library and World become
distinguishable”; it has not started.
