# Interface clarity — execution ledger

**Started:** 2026-09-22, following the owner's “let's execute” instruction.
**Plan:** [interface-clarity-arc-plan.md](../planning/interface-clarity-arc-plan.md).
**Starting checkout:** `dev` at `0007e517`.
**Delivery:** local commits under the house ladder; no remote push or main merge authorized.

## Frontier

- U1's verified post-cap record was **accepted by the owner on 2026-09-23** with
  “Approve.” Local acceptance commits are now authorized; no fourth formal review or
  unanimous final-review PASS is claimed. U1 is committed through `290f9a3d`, following
  startup `7dfbdbbe`, whisper `71c06a5c` and IA-03 `1bcb7ec3`. Nothing has been pushed.
  The generated-name collision is repaired and committed as `44c6ab82`.
- U2's inventory (`fa747232`), characterized extraction (`7eb5dacf`) and drawing-history
  prerequisite (`f6a4c684`) are committed. Interaction changes are implemented locally;
  round 2 found three further paths, now repaired with focused and two-client evidence.
  The repeated full gate passed; final formal review round 3 left one Atlas touch-aim
  finding. Following the cap checkpoint, the owner's “resume u3a” authorizes the
  bounded remaining repair, verification and local U2 closeout before U3a. No fourth
  formal review or unanimous round-3 PASS is claimed. The bounded repair and full
  post-cap gate now pass; U2 is ready for its authorized local acceptance commit.
  U3a is next. U3a–U10 remain unimplemented; ignored preparation
  is not acceptance. The checkpoint after U3a remains in force.
- The September 22 audit is historical evidence; new acceptance results are recorded here.
- The U2 history follow-up is repaired: recipient-scoped history feedback distinguishes
  ordinary Undo to an empty map from a table-wide Clear All. Its independent verification
  and local commit `f6a4c684` are recorded below; do not reopen it as a new defect.

## U1 / IA-03 — player Clear All

**Behavior:** carry the existing DM capability through drawing-toolbar props. Omit Clear
All when capability is absent, including after demotion. Retain the existing DM confirmation
and server/handler permission checks. Mobile's drawing sheet already has no Clear All
action; its existing controls remain covered by the focused suite.

**Regression evidence:** the new toolbar/real-hook test failed on the original code because
the player could see Clear All. After the fix, four focused files passed, 150 tests total.
The first full typecheck caught overly narrow inference in the new test's initial props;
the fixture type was corrected, its two tests passed again, and typecheck passed.
Temporarily ignoring the DM confirmation return value made the second new test fail on an
unexpected `clear-drawings` send. Restoring the guard returned both tests to green. The
probe was reverted before the final browser gate; no mutation probe is part of the fix.

**Browser coverage added:** distinct DM/player contexts draw through
actual pointer input; the player has no Clear All; DM cancellation retains replicated
drawings and working Undo/Redo; confirmation clears both clients. The partial-erase smoke
test no longer clicks a player's no-op Clear All in setup; the automatic fixture reset
already gives it a clean table.

**Live development check:** `live-two-client` at 1440×900. DM elevation used the actual
settings/password UI; a player drew through pointer input; the drawing replicated to the
DM; player Clear All was absent; declining the DM confirmation preserved the drawing on
both clients. Inspected [player screenshot](./interface-clarity-u1/player-no-clear.png)
and [DM screenshot](./interface-clarity-u1/dm-clear-cancelled.png). No physical-device pass
is claimed. This is evidence for IA-03, not acceptance of the remaining U1 navigation.

**Gates:** build, typecheck, lint/frozen contracts, structure, formatting, the full unit
suite (client 51 batches / 6,056 passing tests; server 2,637; shared 449), and the bundle
check (123.90 KB gzip against 175 KB) passed. Isolated dev startup passed. The first E2E
run exposed a new-test locator mistake: exact title text included the close control in the
rendered window. The test now waits for that window's accessible close button; focused
browser rerun passed both affected tests. The full E2E rerun passed **211 tests, 3 existing
skips**, with no failures (11.3 minutes). Independent focused review passed. U1 as a
whole is not complete: the Move/Chat changes still need integration and their own gate.
Raw logs are in the ignored
`output/interface-u1-execution/` directory.

**Environment:** the default bundled pnpm 11 launcher began recreating dependencies before
the first test. It was stopped; the repository's pinned pnpm 10.17.1 restored all 518
packages from local cache with `--frozen-lockfile --offline`. Subsequent commands explicitly
put that launcher first on PATH, including child commands. No package/lockfile change.

**Focused review, round 1:** two independent static reviewers completed, no agent errors.
Correctness passed; evidence review found two test gaps. The browser test now rechecks
player Clear All absence after the player's history is nonempty and after DM updates,
and missing snapshots throw instead of masquerading as empty drawing lists. A mutation
that exposed Clear All whenever Undo was available failed the new post-drawing assertion;
the mutation was reverted. Both affected browser tests passed again after the probe
(33.6 seconds). The full-suite result above precedes
these assertion-only improvements; product code is unchanged.

**Focused review, round 2:** two fresh independent static reviewers returned PASS, no
agent errors and no new scoped findings. This was a bounded review of the focused repair;
the U1 navigation acceptance/review remains separate. Role changes are covered by a real
hook/toolbar rerender test; live role-revocation coverage is not claimed. No mutation probe
remains. Committed locally as `1bcb7ec3`.

## U1 / player navigation — validation in progress

**Behavior:** explicit desktop Move returns to ordinary token movement and map panning;
the header groups Play tools and Panels & settings. Ping and Draw name the two launchers.
Chat & Rolls replaces Log on desktop and as the phone screen title; the five-slot phone
dock uses Chat. First entry shows Chat. An explicit Chat/Rolls choice survives window and
responsive-layout remounts for that player, using session storage with a bounded in-memory
fallback when storage is denied. Snapshot updates do not change the selected tab.

The existing roll result presentation still belongs to the dice roller (`useDiceBuild`),
whose result/animation behavior is unchanged. Public/DM/self roll visibility and server
chat recipient filtering are unchanged. The round-2 composer repair below blocks sends
when the selected whisper recipient disappears. Compose drafts keep their existing lifetime: snapshot
updates preserve the draft; closing the window or switching away from Chat still unmounts
the composer. No draft-retention expansion is claimed.

**Regression evidence so far:** the new navigation tests failed against the old default
and labels; a separate denied-storage remount regression failed before adding the fallback.
The integrated focused suite passed 155 tests across seven files. The first browser run
passed the two-client Draw → Move → token movement → Chat journey and the 375px touch dock
journey, but caught a duplicate Draw name when the drawing window was open. Manual phone
inspection also found the connection badge covering the Chat & Rolls title. Both findings
were repaired before the full U1 acceptance gate. The drawing tool is now Freehand on
both layouts; the launcher remains Draw. The shared phone screen header reserves 30px
above its title/close row for status. A geometry test failed with the original overlap
(badge bottom 40px, title top 25.05px) and passed after the title moved to 55.05px.
Freehand also needed narrower internal chip padding: both portrait/landscape label-fit
regressions failed before the padding repair. Font size and the 44px floor are preserved.

**New browser coverage:** the player draws with real pointer input and the DM receives the
same drawing; Move permits a one-cell token drag which both clients observe; a player chat
message appears once in both clients; closing/reopening remembers Rolls and mounts one
window. On a 375×812 touch-emulated phone, the five dock buttons retain their 44px floor,
Chat fits on one line, and the screen opens Chat before remembering an explicit Rolls
choice. Rendering and geometry are read from the browser, never used to cause app state.

**Live evaluation:** `live-two-client` on the disposable development table at 1280×720,
including actual UI/password DM elevation and the full drawing → Move → token drag →
public Chat journey. Both clients observed the drawing, token position and single message.
The first attempt timed out waiting for page load while the heavy unit suite was running;
the repeat after that suite completed passed. No failed attempt is counted as acceptance.
Manual phone/tablet checks used touch emulation at 375×812, 812×375 and 768×1024.
Freehand measured 104.33×44px in portrait and 102.56×44px in landscape; its text now fits
inside the padded content box. Physical devices and WebKit are not certified by this run.

| Criterion | Score / 10 | Evidence and limit |
| --- | --- | --- |
| Functionality (0.35) | 8 | Drawing, explicit Move, movement, first Chat and remembered Rolls passed; denied storage and identity transitions have unit coverage. |
| Multiplayer integrity (0.30) | 8 | Separate real DM/player contexts received the same completed drawing, movement and public message; recipient routing was not changed. |
| Craft (0.20) | 7 | Clear names and visible groups retain JRPG styling; title occlusion and ambiguous Draw names repaired. Existing chat body/composer use 8px small text; include this concrete readability finding in U10. |
| Reach (0.15) | 8 | Phone dock/close touch floor measured, portrait/landscape Freehand inspected, tablet Chat inspected; no physical-device claim. |

**Weighted score: 7.8/10** against the evaluate-live threshold of 7.0. This is the live
evidence, not the independent review verdict. No critical/major failure remains in the
exercised U1 journey. The existing small chat text is a minor U10 follow-up: apply the
readable body face and a measured mobile text floor to message/composer content without
changing the intentionally dense desktop toolbar. U2's remote-clear history issue remains
recorded in the frontier and is not described as repaired.

Screenshots: [player after Move](./interface-clarity-u1/player-move-after-drawing.png),
[DM receives Chat](./interface-clarity-u1/dm-received-player-chat.png),
[phone Chat](./interface-clarity-u1/phone-chat.png),
[tablet Chat](./interface-clarity-u1/tablet-chat.png),
[landscape Freehand](./interface-clarity-u1/landscape-freehand.png).
Compared with the initial U1 render, the title/status overlap and cramped Freehand label
are improved. The final DM capture waits for the elevation toast to expire; no screenshot
pixels were edited. The review's header correction is recorded below.
The disposable development table accumulated more than twenty test seats; the DM header
capture also exposes the existing crowded Party region. U1 does not repair that region
or certify its crowded layout. The compact roster and preserved map space are U7 work.

**Mechanical gate so far:** build, typecheck, lint/frozen contracts, structure, formatting,
all unit tests (client 6,065 in 51 batches; server 2,637; shared 449), and bundle budget
(124.34 KB gzip / 175 KB) passed. The first full E2E run finished with 210 passed,
3 existing skips and 5 selector failures: two exact-title assumptions omitted the
window's close control, one loose CHAT match included the launcher/close button, and
two older phone tests still looked for Log. These tests now use the precise close/tab/dock
controls and explicitly visit Rolls where needed. Product code did not change during
that run. All five repaired cases passed their focused rerun. The intermediate full
rerun finished with **214 passed, 1 flaky, 3 existing skips** (14.5 minutes): an existing
mobile map-edit test first reached an unstyled, zero-height canvas and then passed on
retry. The screenshot confirms missing core styles; the initial request failure's cause
is unproven because no network trace was captured for that attempt. A focused startup
recovery fix is in progress. This run predates the review's header change and new privacy
tests; it is not the final gate for the current tree.

**Independent review, round 1:** four read-only static reviewers completed with
`agents_error: 0`. A before/after file-hash manifest confirmed that reviewers did not alter
the tree. Behavior/state passed. Layout, test evidence, and doc/privacy lenses failed on
three actionable findings; all were retained. No reviewer claimed the still-running full
browser rerun had passed.

- Player View belonged with view settings and wrapped alone on a third DM header row.
  It now sits in Panels & settings, while Map stays in Play tools. The grouping assertion
  failed before the move; both header test files then passed, 43 tests. Actual 1280px DM
  geometry now measures Play tools at y41–74 and Panels & settings at y82–115, recovering
  the approximately 30px orphan row. See [DM header](./interface-clarity-u1/dm-header-after-review.png).
- The public Chat journey did not prove whisper privacy through either UI surface.
  Added two three-client journeys for a desktop sender and a touch phone sender, with
  a public positive control, sender/recipient whisper delivery, then a later public
  barrier before asserting observer snapshot and UI absence. Both passed, then both
  failed at the observer's negative assertion when a temporary server-filter mutation
  deliberately delivered whispers to everyone. Exact source bytes were restored in a
  `finally` block and the server diff checked clean. Both tests passed again (38.2 seconds).
  These are actual UI journeys with three distinct clients; the dev seam only reads
  outcomes, apart from the existing fixture's DM elevation during setup.
- The player guide's ME wording contradicted recipient filtering. It now states that
  other players and DMs do not receive a ME roll. Root's accompanying source check also
  corrected two existing guide claims: DM navigation has six tabs including Atlas, and
  drawings are shared on completion, not continuously during a stroke.
  The terminal-drag investigation also confirmed that token drag previews are disabled
  by default; the movement guide now promises the replicated position on release.

The live development journey passed again after the header move. One repeat initially
matched two identical messages retained from previous local runs; its local harness now
uses a unique message, while the isolated E2E keeps a clean-table fixture. The corrected
repeat passed. The intermediate full E2E rerun was built before the header move and new
privacy tests; a final post-review gate and fresh review round remain required.

## U1 gate follow-up — startup recovery

The unstyled phone in the intermediate full suite exposed a startup-recovery gap.
The original transport failure was not traced, so its cause remains unproven. A deliberate
core-stylesheet abort reproduced the unusable mounted app: the watchdog considered any
React children healthy. Chromium retained a stylesheet object whose rules threw on
access; the first test draft's null-sheet assumption was corrected before accepting red
evidence. The new check captures initial same-origin stylesheet links and requires readable
rules as well as a mounted root. Optional cross-origin and later dynamic styles stay
outside this startup check.

A successful first retry restores the styled mobile dock and visible canvas. A second
failure ends the React app and shows an inline-styled error beside its empty, hidden,
inert root. Reload requires a successfully written and read-back session
marker; read denial, write denial and discarded writes produce a visible error without
a reload loop. Healthy startup remains usable when retry storage is denied.

The authenticated failure test found another real defect in the initial repair: after
the terminal error appeared, ArrowRight still sent a `step-object` from the hidden app.
The test first proves ordinary keyboard movement through an outgoing command and the
server's token position, then verifies the same resumed seat after reload. The final
implementation unmounts React, cleaning up its listeners and portals. The negative
assertion observes zero movement commands and unchanged token state in a separate live
client after pressing ArrowRight at the error; the failed page's retained E2E snapshot
is not an authoritative post-unmount observer.

**Focused evidence:** intended stylesheet and storage regressions failed against the old
watchdog; write/discard probes failed with the old retry guard temporarily restored; the
hidden-table movement assertion failed before an initial keyboard guard. All probes were
restored. That intermediate production build and **9 browser cases passed with retries disabled**
(2.1 minutes), including the two existing vendor-JavaScript recovery cases. The CSS cases
block service workers only in their fault-injection contexts so interception still sees
the reload. Product service-worker policy is unchanged. Persistent failures observe for
five seconds beyond the error before checking that no further navigation occurred.

Raw evidence is in ignored `output/interface-u1-execution/css-boot-*` logs/JSON and
`css-boot-evidence.md`. The complete post-review house gate passed on the integrated
navigation and initial startup repair: build, typecheck, lint/frozen, structure, formatting,
6,065 client / 2,637 server / 449 shared unit tests, bundle 124.34 KB / 175 KB, and
**224 browser tests passed, 3 existing skips, no retries** (14.8 minutes). The run ended
2026-09-22 at 18:56 PDT; logs use the `review-r1-*` prefix. Independent round 2 remains
pending. This follow-up will have its own focused source commit.

Before freezing that repair for review, root identified a terminal-state coverage gap:
Character settings/creation render in body portals outside the hidden React root, and
app capture listeners can precede the late keyboard guard. Actual pointer input at a
retained Create button after terminal failure created a character which a separate
client received. A second case opened a new Character dialog from retained Settings.
Both were reproduced before the repair.

The watchdog now dispatches `herobyte-boot-failed`; `main.tsx` owns the actual React root
and unmounts it through React. Unmount alone removed the portals but exposed another
confirmed failure: Konva emits `dragend` while destroying a held token, before passive
WebSocket cleanup. A positive-control drag first moved the token two cells on both
clients; a second held drag committed two more cells during unmount. The final repair
marks the page terminal **before** unmount and guards the public WebSocket send boundary,
so cleanup callbacks neither send nor enqueue commands. Already-dispatched operations
are not reversed. React cleans up component timers, listeners and portals; the old late
keyboard guard was removed. There is no blanket suppression of pointer release events.

The corrected held-drag test reads actual Konva drag state and uses a separate client's
token position. Initial probes wrongly expected disabled drag-preview messages and are
recorded as test-characterization failures, not product red evidence. The final focused
run passed **12 browser tests, zero retries/failures/skips** (2.9 minutes), the existing
WebSocket suite passed **28/28**, and the production build, scoped formatting and whitespace
checks passed. Exact commands and intended red/restored green outcomes are recorded in
ignored `output/interface-u1-execution/css-boot-terminal-evidence.md` and associated logs.
No held mobile-pad failure was reproduced or claimed.

The healthy development journey passed again with two clients after the terminal cleanup
change, including UI/password DM elevation, drawing, Move, token movement and Chat. DM
header groups remained at y41–74 and y82–115. The final complete house gate passed on
this tree: build, typecheck, lint/frozen, structure, formatting, **6,065 client / 2,637
server / 449 shared unit tests**, and bundle **124.40 KB / 175 KB**. The browser suite
passed **227 tests, 3 existing skips, zero failures or retries** (16.4 minutes), ending
2026-09-22 at 19:46 PDT. Logs use `terminal-final-*`; the earlier 224-pass gate remains
historical evidence for its exact tree. Production source and test assertions were
unchanged throughout this run. This is the pre-round-2 gate; the repairs below require
a new complete gate before round 3.

## U1 independent review, round 2 — repairs verified; final review pending

Four fresh independent static reviewers completed, `agents_error: 0`. All were read-only;
the before/after SHA-256 manifest was unchanged across all 78 reviewed files. Test validity
passed. Correctness, layout, and documentation each identified one actionable finding
(three total, the same count as round 1). No review or live acceptance is inferred from
these static verdicts. Round 3 is the final permitted round; any unresolved finding or
non-convergence must be reported to the owner instead of starting round 4.

- **Whisper recipient removal (P1):** the composer silently changed a missing recipient
  to Everyone while retaining the draft. Preserve the selected recipient and draft,
  show that the recipient is unavailable, and block both Enter and SEND until the author
  explicitly selects another recipient or Everyone. This also applies when there are no
  remaining whisper targets. Reappearance of the same UID restores that recipient;
  it never selects a different person or a public destination implicitly.
- **Guide screenshots (P2):** four images directly contradicted the new Chat/Freehand
  labels. The broader image inventory also found old desktop header labels in the other
  in-table images referenced by the two changed guides. Recapture these states using
  actual rendered UI and inspect the images before acceptance.
- **Header group labels (P2):** the newly introduced Play tools and Panels & settings
  labels were 8px. Increase them to 11px and verify containment, wrapping and overlap
  at 1280px and narrower desktop sizes without restoring the orphan third row at 1280px.

The six new component regressions all failed on the original composer because a private
draft reached `onSendChat` with a public destination. After the repair, all 25 nearby chat
tests passed. Removing only the handler guard made all six fail; removing only the disabled
button state made three fail while the other three passed. Both mutations were restored
byte-for-byte in `finally`, and the same 25 tests passed again. The obsolete test that
required automatic public fallback was replaced by these explicit audience assertions.
Browser reproduction and guide captures are still in progress; no final gate or round-3
verdict is claimed here.

The old composer was restored temporarily for an actual four-client browser reproduction,
then the repaired bytes were restored in `finally`. After the DM removed the recipient
through Players and the real heartbeat grace, desktop Enter and a 375px phone tap on SEND
each emitted a public chat command; both drafts appeared in the independent DM's snapshot
and rendered log. This is the intended privacy failure. Earlier harness attempts failed
on extra transport `commandId` fields and the window title's close-button text; neither
counts as privacy evidence. A subsequent repaired run reached all blocked-send and
retarget assertions but failed at the final command-array assertion for the same legitimate
transport metadata; its two existing whisper-privacy cases passed. The final array checks
now allow transport metadata while still requiring exactly one matching chat command.

The corrected removal test then passed with zero retries (1.1-minute test, 1.5-minute
isolated run). Four independent browser contexts exercised actual UI authentication and
DM elevation, player-to-player whispers with a non-recipient DM observer, both draft send
attempts, public barriers, and deliberate public/private retargeting. Passive wire reads
confirmed zero blocked chat commands and exactly one command per deliberate send. The
native [phone](./interface-clarity-u1/phone-whisper-recipient-unavailable.png) and
[desktop](./interface-clarity-u1/desktop-whisper-recipient-unavailable.png) captures were
inspected; the preserved recipient, draft and 11px unavailable message fit both surfaces.
This run used the isolated preview stack. An independent **live-two-client** evaluation
then repeated the four-client flow on the development runtime in a new disposable private
table, created and joined through UI. UI DM elevation, both private preflights, real removal
grace (60.8 seconds), blocked Enter/touch sends, and both deliberate retargets passed on
the first run, without page errors. Both 11px messages fit their rendered boxes at desktop
and 375px. Its focused privacy-flow score was 8.65/10; this supplements the overall U1
score rather than rescoring unexercised surfaces. Chromium touch emulation is not a physical
phone or software-keyboard pass. All owned browser contexts closed; development servers
were left running. Evidence is in ignored `recipient-dev/evaluation.md` and its report.
The new complete gate and round-3 acceptance remain pending.

Header-label validation achieved `live-two-client` with actual password UI authentication
for fresh player and DM contexts. All twelve label instances measured 11px at 1280, 1024
and 900px, without clipped labels, child overlap or horizontal group overflow. At 1280px
both groups remain 33px tall; narrower widths wrap inside their groups. Inspected native
[1280px DM](./interface-clarity-u1/dm-header-labels-1280.png) and
[900px DM](./interface-clarity-u1/dm-header-labels-900.png) captures, plus the other four
captures in ignored `header-label-repair/`. The existing crowded Party limitation remains.

**Guide refresh:** all 19 images referenced by the two changed guides were recaptured
and visually inspected. The first six-walkthrough run passed five but exposed a drawing
capture that released outside the visible canvas. The harness now collapses Entities
before drawing and requires both replicated strokes; that focused walkthrough passed.
Image inspection then prompted actual Focus/touch-pan framing for visible tokens, a
taller combat capture, and accurate image alt text. The final four affected walkthroughs
passed (1.8 minutes); unchanged login and Atlas captures passed in the initial run.
The combat image demonstrates the banner, controls and active character; its card bottoms
remain outside the limited Entities area, so it does not claim complete cards or ordering
across multiple combatants. This is existing layout behavior reserved for U7, not a new
U1 regression. The other 23 JPEGs emitted by the harness were restored byte-for-byte
from verified originals; only the 19 guide images belong to this repair. No screenshot
pixels were edited. Documentation capture setup is not substituted for live acceptance.
Raw capture logs, image inventory and visual checks are in ignored `docs-refresh/`.

The first post-round-2 gate built successfully, then typecheck rejected Playwright-style
`exact` options in the new Testing Library role queries. String role names already match
exactly there; the unsupported options were removed without weakening assertions. All
six recipient cases passed again. The restarted full ladder remains in progress. The
earlier mutation failures were actual callback/disabled-state assertions, not compiler
failures; no compilation failure is counted as a behavioral regression proof.

The restarted full ladder completed successfully on **2026-09-22 at 20:46:53 PDT**.
Build preceded typecheck and tests; lint/frozen, structure and formatting passed.
All 51 client batches passed: **6,070 client tests** (four existing skips), plus
**2,637 server and 449 shared tests**. Entry bundle: **124.52 KB / 175 KB**.
The complete browser run passed **228 tests, three existing skips, zero failures
or retries** (15.0 minutes). Raw logs use the `review-r2-final-*` prefix. Production
source and test assertions were unchanged throughout this restarted run. The separate
development-runtime evidence above covers the current header and whisper repairs.
This is the completed gate for round 3; a review verdict is still pending.

## U1 independent review, round 3 — cap reached; repairs under verification

Four fresh pinned-model reviewers completed in **STATIC, read-only** mode;
`agents_error: 0`. The SHA-256 manifest was unchanged across all **104 files**.
Correctness returned PASS; test validity, documentation/privacy, and accessibility
returned FAIL. The deduplicated finding counts were **3 → 3 → 5**. This is the
three-round cap and plateau: twelve independent reviewers across three rounds.
There is no fourth automatic review and no claim of unanimous final acceptance.
The repaired result and verification record must go to the owner before U2.

The five findings and bounded repair decisions are:

1. **P2, navigation test isolation:** the denied-storage case left a shared in-memory
   preference under the UID used by other tests. Shuffle seed 1 reproduced one failure
   with six controls passing. Give each test a fresh identity, including its secondary
   and denied-storage identities; do not add a production cache-reset API. Seeds 1,
   2 and 3 then passed all seven cases. The existing remount-memory assertions remain.
2. **P1, recipient return:** disappearance blocked sending only while the UID was
   absent. The same UID returning could identify a new seat, yet enabled the old draft
   automatically. Two component cases reproduced an actual callback after a return
   under the same or a changed name. Latch the need for a new audience choice after
   an observed disappearance; the returning recipient must be explicitly selectable.
   This does not add account identities or claim to repair the accepted offline-UID
   limitation. A disappearance the composer never observes is outside this local guard.
3. **P1, guide privacy wording:** qualify seat-based delivery with the already accepted
   fully-offline-UID/session-grace limitation. This is a correction to the new guide's
   promise, not a new finding against the owner's deferred identity decision. No
   authentication, session token, recipient-filter or role behavior is changed.
4. **P2, lost recipient name:** outgoing history joined names against the current
   roster and became “unknown” after removal. Stamp optional `toName` from the server
   roster when a whisper is created; preserve its original name through rename,
   removal and restart. Keep a guarded legacy roster/unknown fallback in the client.
   Extract only the shared ChatMessage type so the oversized barrel shrinks by 29
   lines. The request schema still accepts no authoritative client-supplied name;
   per-recipient filtering and public export policy remain unchanged.
5. **P2, tab semantics:** CHAT/ROLLS were pressed buttons without tab relationships.
   Add a horizontal tablist, unique linked tabs/panels, selected state, roving focus,
   and Arrow/Home/End handling that does not reach table movement. Keep inactive
   content unmounted, preserving the documented draft lifetime. This is scoped to
   Chat & Rolls, not the separately deferred DM-menu tabs.

**Focused proof so far:** recipient return tests failed twice on real send callbacks,
then all seven recipient cases passed. Historical-name component tests failed on
renamed/missing labels before the display repair; the integrated four-file chat suite
then passed **33/33**. Server creation/filter/export/persistence/import coverage failed
seven intended assertions before stamping, then **48/48** nearby server cases passed.
Removing only the assignment failed three of eight focused service cases; restoring it
passed all eight. Shared legacy type characterization passed before and after extraction.
The new tab suite failed 13 of 17 cases before semantics; after repair all 17 passed.
Removing only propagation isolation failed exactly eight owned-key cases while nine
controls passed; exact bytes were restored and all 17 passed again. The nearby tab,
navigation, chat and formatting component suites passed **48/48**.

The integrated production build and both typechecks passed after these repairs. The
development evaluation and strengthened browser journeys are in progress; the final
complete gate has not yet run on this post-cap tree. A default-sandbox formatting call
resolved the fallback package-manager shim and began recreating dependencies. It was
stopped, then the exact lockfile was restored offline with escalated pnpm 10.17.1 in
15.9 seconds. Package manifests and lockfile are unchanged. The resulting missing-runner
failure is a tooling failure, never behavioral red evidence. All further pnpm commands
use the explicit pinned executable through the escalated runner.

**Post-cap live development validation:** an independent evaluator achieved
`live-two-client` on four isolated Chromium contexts in a new private table created
and joined through the visible UI. Password-based DM elevation and the actual dev
runtime both worked. A positive ArrowRight control moved the player's token exactly
one cell on all four clients. Tab Arrow/Home/End handling then changed selection and
focus with zero movement commands and unchanged token positions after a public
barrier. Linked tab/panel identities, roving focus and selected state passed on
desktop and the 375×812 touch-emulated phone.

Two private preflights reached only sender and recipient. After a real page close,
60,872 ms disconnect / 64,267 ms heartbeat age, and DM Players → Remove, both drafts
remained blocked and previous whispers retained the original recipient name. A new
page in the same browser context joined normally with the original UID. Both senders
still required an explicit audience choice; desktop Enter and a phone tap on the
disabled SEND coordinates emitted zero chat commands. Independent public barriers
preceded snapshot and rendered-log absence checks on all four clients. Deliberate
Everyone, new-recipient and returned-recipient choices each delivered once to the
correct clients. No page errors or retries occurred; all evaluator-owned contexts
closed and the development services stayed running.

The focused flow scored **8.65/10**, supplementing the earlier overall U1 score.
All six native captures were inspected: [desktop tabs](./interface-clarity-u1/postcap-desktop-tabs.png),
[phone tabs](./interface-clarity-u1/postcap-phone-tabs.png),
[desktop unavailable](./interface-clarity-u1/postcap-desktop-recipient-unavailable.png),
[phone unavailable](./interface-clarity-u1/postcap-phone-recipient-unavailable.png),
[desktop returned](./interface-clarity-u1/postcap-desktop-recipient-returned.png), and
[phone returned](./interface-clarity-u1/postcap-phone-recipient-returned.png).
Phone tabs were 60×44 and 68×44 px, the recipient select 329×44 px, and composer/SEND
60 px tall. Both 11px status messages fit without ancestor clipping. This is Chromium
touch emulation, not physical-device, software-keyboard, WebKit or assistive-technology
certification. The legacy fallback is covered by component tests, not newly seeded
legacy data in this live run. This evaluation is **not a fourth formal review**.
Ignored evidence: `postcap-dev/evaluation.md`, `report-1790137133411.json`, and `verify.mjs`.

**Collateral observation for the owner checkpoint:** removal/rejoin assigned the
returning identity Player 4 instead of Player 2, duplicating another live label. Old
whispers correctly retained Player 2. Explicit selection in the validation used the
underlying option UID because the visible name was ambiguous. This naming behavior
needs a separate focused follow-up. Subsequent read-only comparison proved that all
seven causal files are unchanged from `1bcb7ec3`: `PlayerService.createPlayer` starts
at `players.length + 1`, so removing a middle row can produce an occupied name on the
next join. The bounded repair should advance to the next unused generated name while
preserving intentional fresh-seat provisioning, UID routing and existing history.
It is not silently treated as resolved or folded into the capped review repair.
The exact scope and baseline comparison are in ignored
`postcap-dev/generated-name-follow-up.md` and `naming-baseline-comparison.json`.

The first strengthened preview run passed navigation, recipient removal/return, both
Freehand-width cases and the mobile dock. Two privacy cases stopped at stale option
value assertions after the recipient selector gained its disjoint value namespace.
Correcting those two assertions preserved raw UID payload checks; both privacy cases
then passed with zero retries (33 seconds). Those selector failures are harness
adaptation errors, not privacy regression evidence. The final full gate is pending.

## U1 post-cap verification complete — owner checkpoint

The strengthened return journey was challenged by removing only the latched
`needsChoice` contribution to the unavailable guard. It compiled and reached the real
removal/return flow. Desktop Enter and the phone SEND tap each emitted the retained
private draft after return; both outgoing-command assertions and the sender/recipient
snapshot and rendered-log absence assertions failed. This is behavioral red evidence,
not a setup or compiler failure. The source was restored byte-for-byte in `finally`
with matching SHA-256, and the same browser journey then passed with zero retries
(1.1-minute test / 1.5-minute isolated run). Evidence:
`recipient-return-browser-mutation.log`, `recipient-return-browser-restoration.json`,
and `recipient-return-browser-restored.log` in the ignored execution directory.

The final complete house ladder ran from **2026-09-22 21:26:07 to 21:45:32 PDT**:

| Gate | Result |
| --- | --- |
| Build, then both typechecks | PASS |
| Lint and frozen contracts | PASS |
| Structure enforcement and formatting | PASS |
| Client unit suites | **6,095 passed**, all 51 batches; four existing skips |
| Server / shared unit suites | **2,649 / 450 passed** |
| Total passing unit tests | **9,194** |
| Entry bundle | **124.98 KB / 175 KB**, PASS |
| Complete browser suite | **228 passed, three existing skips, zero failures or retries**, 15.4 minutes |
| Separate development runtime | Four-client live validation above, PASS |
| Source/test/evidence stability | All **120 files** identical by SHA-256 before and after the gate |

The browser skips are the existing camera-reset, grid-visibility and DM-mode-toggle
cases; none was introduced to avoid a repair failure. Raw gate logs use
`postcap-final-*`. The stability manifests are `postcap-final-before.json` and
`postcap-final-after.json`; only this ledger and the plan's checkpoint wording are
updated after that comparison. `git diff --check` also passed.

**Review status is still capped, not converted to PASS by tests.** Formal review cost
was twelve independent reviewers across three rounds, with deduplicated counts
**3 → 3 → 5**, `agents_error: 0`, and no missing lens. Round 3 passed correctness and
failed test validity, documentation/privacy and accessibility. The five repairs are
implemented and verified as recorded above; they have not received a fourth formal
review. The separate live evaluator and naming reconnaissance are not substitutes
for that verdict. No exact aggregate token or monetary cost is available.

The project's [review-convergence rule](../../.claude/skills/review-convergence/SKILL.md)
says, **“Round 4 is escalation to the owner, not another loop.”** Its plateau rule also
applies. The owner must decide whether to accept this verified post-cap record before
U1 acceptance and further slice execution. No U1 acceptance commit, remote push or U2
implementation follows automatically from the green gate.

**Recommended next frontier after that decision:** record the decision and finish local
U1 commits with honest tested-tree provenance; repair the pre-existing generated-name
collision as a separate focused fix; then start U2 with the fresh complete Escape-owner
inventory and executed characterizations. The ignored U2/U3a preparation is still
unrun, not accepted implementation. Keep the U3a checkpoint before broader DM-menu
relocation. Existing offline-UID limitations, physical-device/WebKit coverage and the
remaining U2–U10 interface work remain exactly the recorded scope and limitations.

### Owner decision — 2026-09-23

The owner replied **“Approve”** to accepting this U1 checkpoint, committing the verified
work locally and continuing toward U2. This resolves the review-cap escalation; do not
ask for the same approval again. It does not authorize a remote push or main merge and
does not turn the capped review into a fourth-round PASS.

Before committing, all 120 entries in the final gate manifest were checked again.
Only the two checkpoint documents differed; product code, tests and captures still
match the verified tree. The local commits separate startup recovery, whisper repairs
and navigation/documentation for review. The full ladder and live evidence apply to
the combined accepted U1 tree, not independently reconstructed intermediate commits.
No identical-tree gate rerun is claimed or needed to record the owner's decision.

The focused local fixes are `7dfbdbbe` (startup lifetime/recovery) and `71c06a5c`
(whisper audience and history). This record accompanies the completing U1 navigation
commit, which also contains the integrated browser journeys, guide captures and arc
plan. The U2 Escape inventory remains outside U1 and unaccepted until refreshed.

## Separate follow-up — generated player-name collision

**Base:** accepted U1 at `290f9a3d`. A new or intentionally removed/rejoining seat
could receive Player 4 while another Player 4 remained, because automatic naming
used only roster length. The allocator now begins at the same count-plus-one value
and advances synchronously until its exact generated name is unused. It does not
rename existing seats, enforce uniqueness on custom names, revive removed state,
change identity policy, or rewrite historical whispers. New PC naming continues
through the existing provisioning path.

**Focused evidence:** the unchanged allocator failed three new cases while seventeen
controls passed: a non-tail removal, consecutive collisions including custom names,
and real removal/re-provisioning with both seat and PC name assertions. After the
allocator change, all **72 tests** in the two new suites and existing player,
removal and multi-room contracts passed. Replacing the collision loop with one `if`
failed the consecutive-collision case while five controls passed. Exact source bytes
were restored and both new suites passed **8/8** again. The join tests use actual
domain services and provisioning; they do not claim to exercise password UI or
dispatcher authorization. Evidence is in ignored `output/interface-name-fix/`.

**Full gate:** PASS, 2026-09-23 06:04:50–06:29:11 PDT. Build, typecheck,
lint/frozen tests, structure and formatting passed. Units passed **9,202** tests:
client 6,095 (four existing skips), server 2,657, shared 450. The entry bundle is
**124.98 KB gzip / 175 KB**. Browser tests passed **228**, with three existing skips,
zero failures and no retries, in 17.5 minutes. All four source/test/ledger files in
`gate-before.json` matched `gate-after.json` by SHA-256. This result paragraph and
the two selected captures were added afterward; production and tests remain unchanged.

**Separate dev acceptance:** achieved `live-two-client` using four isolated Chromium
contexts, with desktop 1440×900 and touch-emulated 375×812 senders. The focused score
is **8.65/10** (Functionality 9, Multiplayer 9, Craft 8, Reach 8; threshold 7.0).
Normal UI table creation, password elevation and real removal grace produced the
original Player 1/2/3/4 roster. Removing Player 2 and returning in the same browser
context produced a fresh non-DM **Player 5** seat and PC with new character/token IDs;
all four snapshots agreed. Both senders explicitly selected **Whisper to Player 5**
by visible name. Original whispers retained **Player 2**. Drafts stayed blocked through
absence and return, and attempted Enter/touch submission emitted no chat frames.
Deliberate retargeting delivered exactly once with correct public/private recipients;
independent public messages preceded negative delivery assertions.

A normal reconnect preserved the custom **PC** name Cedar Returner and the generated
seat name Player 5, along with UID, character and token identity. This does not claim a
custom player-seat rename was exercised live. Nine native captures were inspected;
the phone select was 329×44 px and SEND 60×60 px, with no chat-control clipping.
Selected captures: [desktop](interface-generated-names/desktop-player-5.png) and
[375px phone](interface-generated-names/phone-player-5.png). No page, console or captured
network errors occurred in the successful run. The initial attempt was boot-blocked
before table creation; it remains recorded as static, with no score. A retry after
healthy dev endpoints passed without a source change or server restart. This is
Chromium touch emulation, not physical-device, WebKit or assistive-technology coverage.
The live script used real UI causes and passive wire/read-only snapshot observations.
All owned browser contexts closed. This new repair does not reopen U1's capped review.

**Focused review R1:** two fresh, independent, pinned reviewers returned **PASS** in
static read-only mode: correctness/domain identity and test validity/documentation/privacy.
Both inspected all eight new cases and the behavioral red/green/mutation evidence.
The union contains **zero findings**, `agents_error: 0`; all six reviewed files matched
their before/after SHA-256 manifests. This is a small allocator change, not an all-PASS
claim about the wider interface arc. Only this review-result paragraph was added after
the stability check. The separate repair is accepted for a local focused commit;
remote shipping remains unauthorised. Next: U2 inventory and executed characterizations.

## U2 — inventory and characterization frontier

**Base:** generated-name repair committed locally as `44c6ab82`. No U2 production
handler has changed. The [complete Escape inventory](interface-escape-inventory.md)
was rescanned at that commit: 694 source files, fifteen owners (eight global, seven
local), sixteen Escape sites, and all 35 owner/context fingerprints unchanged from
the accepted U1 scan. This establishes the required inventory before handler edits.

Sixteen test/fixture files were adopted into their actual characterization directories,
formatted, and executed against unchanged production. All **77 cases** passed:
17 overlapping owners/keyboard history, 21 map/annotation gesture lifecycles,
15 selection/Character picker lifetimes, and 24 server history/projection/storage/export
contracts. These are current-behavior characterizations, not repaired U2 acceptance.
Explicit `BASELINE BUG`/`BASELINE GAP` expectations must be replaced during the repair,
never skipped or retained as claims of correct final behavior.

A controlled mutation changed only normal terrain release from flush to discard.
Four real callback assertions failed while nine controls passed; these were behavioral
failures after successful test loading. Source bytes were restored in `finally` and
all thirteen map lifecycle cases passed again. The source SHA-256 restoration record
and raw logs are under `output/interface-u2-execution/`. The inventory, bounded
characterizations and this record form the first U2 commit once the house gate passes.
Production, independent acceptance and U2 formal review remain pending.

**Baseline house gate passed, 2026-09-23 07:21–07:45 PDT:** build, typecheck,
lint/frozen tests, structure guard, formatting, all unit suites, bundle and full E2E.
Units: client **6,148** (four existing skips), server **2,681**, shared **450**;
**9,279 passed** in total. Bundle **124.98 KB / 175 KB**. Browser suite:
**228 passed, three existing skips, zero failures or retries (17.4 minutes)**.
All eighteen inventory/test/ledger hashes matched before and after the gate;
`git diff --check` passed. Raw `baseline-gate-*` logs and manifests remain under
`output/interface-u2-execution/`. Only this outcome paragraph was added afterward.
This first U2 commit pins the unchanged application; it does not claim that any
Escape, focus, cancellation or history defect has been repaired. Next: characterized
extractions, then desired-behavior regressions and implementation.

**Characterized extraction phase, based on `fa747232`:** the existing map mode-exit
cleanup moved into its cancellation hook; map-tool types moved to a bounded sibling.
Annotation mode exit reuses its existing cancel primitive. Character's Status Effects
state remains in the mounted parent through an unconditional hook; its markup moved
without a new host wrapper. Server history helpers moved out of MapService without
changing their operation rules. Drawing types moved to a type-only shared module,
retaining the public barrel names. No Escape owner or desired behavior changed yet.

All **77 unchanged baseline cases passed after extraction**. Two shared public-type
characterizations passed before and after the move, with the shared compiler passing
both times; the existing MapService suite also passed **19/19**. The map hook is now
**263 lines** (from 349), annotation **325** (335), Character settings **544** (665),
and MapService **248** (413); new modules stay below 348. The grandfathered Character
parent shrank but is not represented as below the cap. Eight nearby client suites
passed **103/103**. Existing dev services remained healthy (5174 and 8787 returned
HTTP 200) after rebuilding the type-only shared extraction. Full extraction gate pending.

**Extraction house gate passed, 2026-09-23 07:49–08:14 PDT:** all eight steps passed.
Units: **6,148 client** (four existing skips), **2,681 server**, **452 shared**;
**9,281 passed**. Bundle **125.04 KB / 175 KB**. E2E **228 passed, three existing
skips, zero failures or retries (18.0 minutes)**. All thirteen frozen hashes matched
after the gate and `git diff --check` passed. The original dev server also logged
successful tsx restarts after the new history module and shared rebuild, with no
boot error. Logs/manifests use `extraction-gate-*` under the same output directory.
Only this result paragraph was added after comparison. This accepts the extraction
for a local commit; desired behavior, live U2 acceptance and formal U2 review remain
pending. Next: focused server-history repair, then interaction-owner integration.

**Focused drawing-history repair, based on `7eb5dacf`:** Undo and Redo now choose
the newest operation that can change the current drawing geometry. Executing it
discards stale entries above it and preserves lower dependencies, including nested
partial erases. An already-restored drawing no longer reports false Redo success.
Snapshots optionally report only their recipient's confirmed `canUndo`/`canRedo`;
recipientless snapshots omit this field. Reading capabilities does not mutate stacks.
Session exports strip this transient metadata, retaining the existing fixed-time
export bytes. Existing disk, Redis and session loaders still reset history; this
does not claim that Redis never writes the runtime history fields.

The desired server regressions first ran against the extracted old implementation:
**37 assertion failures and eight passing controls**, including direct behavioral
failures for stale Undo and false-success Redo. After repair all **45 passed**.
Two controlled mutations were caught: restricting selection to the top entry caused
two failures with two controls; removing the export strip caused one failure with
six controls. Exact source hashes were restored in `finally`, then all 45 passed
again. Nearby MapService/message-handler suites passed **37/37**, and the two shared
public-type checks passed. Raw `history-*` logs and the restoration manifest are
under `output/interface-u2-execution/`. Full gate and independent focused review
remain pending. Client history controls and live U2 acceptance are not yet implemented.

**History house gate passed, 2026-09-23:** build, typecheck, lint/frozen tests,
structure and formatting passed at 08:26–08:28 PDT. The initial unit run then lost
its esbuild service before one client suite could load; this was a setup failure,
not an assertion result or a passing gate. After the session interruption, all
thirteen frozen file hashes still matched. The resumed complete unit run passed
at 13:10: **6,148 client** (four existing skips), **2,702 server**, **452 shared**,
or **9,302 passed**. Bundle **125.04 KB / 175 KB** passed at 13:11. Full browser
suite finished at 13:29: **228 passed, three existing skips, zero failures or
retries (18.5 minutes)**. All thirteen hashes still matched afterward and
`git diff --check` passed. Original and resumed logs are retained separately.
Only this result paragraph changed after the frozen comparison. Independent
focused review remains pending; this does not claim live U2 interaction acceptance.

**Focused history review R1, 2026-09-23:** two fresh, pinned reviewers completed
read-only static review: correctness PASS, evidence/ownership FAIL; union **one
finding**, `agents_error: 0`. All thirteen hashes were unchanged across review.
The failing case is cross-owner ID reuse: after a DM deletes Alice's two drawings,
Bob can reuse the lower drawing's ID; scanning Alice's stale history can then remove
Bob's drawing. The required repair matches recorded owners during applicability and
removal, rejects duplicate live draw IDs, and remaps conflicting imported IDs without
discarding imported geometry. Focused regressions, the repeated house gate and a fresh
second review round must pass before this repair is committed. R1 is a valid failed
round, not an acceptance or live evaluation.

The ownership regressions reproduced **ten assertion failures with three passing
controls** before the repair. After exact-owner history matching and collision-safe
draw/import ingestion, all **95 focused cases passed in nine files**: thirteen new
ownership cases, forty-five history contracts, nineteen MapService cases and eighteen
message-handler cases. The controls retain occupied-ID restore protection and real
Undo/Redo of an unowned legacy drawing. The red result is preserved as a labeled
tool-output transcription; `history-r2-focused.log` is the raw green output. No wire
message shape changed. The complete repeated gate and fresh R2 review remain pending.

**Repeated history gate passed, 2026-09-23 13:45–14:08 PDT:** all eight steps passed
on the repaired tree. Units: **6,148 client** (four existing skips), **2,715 server**,
**452 shared**, or **9,315 passed**. Bundle **125.04 KB / 175 KB**. Full E2E:
**228 passed, three existing skips, zero failures or retries (17.0 minutes)**.
All fifteen frozen file hashes matched after the gate, and `git diff --check` passed.
The `history-r2-gate-*` logs and before/after manifests are retained. Only this outcome
paragraph was added after comparison. Fresh R2 review remains pending; the client
interaction candidates still require actual adoption and live U2 acceptance.

**Focused history review R2 passed, 2026-09-23:** two fresh pinned reviewers both
returned PASS, union **zero findings**, `agents_error: 0`, achieved mode **static,
read-only**. Both checked the complete fifteen-path diff, including the three new
test files; neither ran a browser or changed implementation. Root independently
confirmed all fifteen review hashes unchanged. R1 → R2 finding counts are **1 → 0**.
The owner/ID reuse defect is closed, with no regression identified in lower history
dependencies, partial erases, recipient metadata, lifecycle reset or export bytes.
The labeled red transcription remains an evidence limitation, not a raw captured log.
This accepts the focused server-history repair for a local commit. U2 itself remains
open: the interaction-owner client integration, live acceptance and full U2 review
are still required. No push, merge to main or deployment is authorized by this record.

### U2 interaction integration — actual source, 2026-09-23

The focused history prerequisite is committed locally as `f6a4c684`. Client adoption
then ran in characterized phases: **63 baseline cases**, **162 foundation cases**,
then **90 intended assertion failures with 38 passing controls** before the behavior
repair. The integrated selection passed **548/548 in 63 suites**. The actual compiler
passed; lint found a test-fixture overload rejected by the base `no-redeclare` rule.
Replacing that fixture with an input-only factory and an explicit native select kept
the same behavior. All 46 affected core/Juice cases passed. Juice adds eight cases:
its original component failed four with four controls; the repair passed eight, and
a wrong containing paint band failed the targeted higher-root probe before exact restore.

The shared owner contract now covers Escape priority, unsent gesture cancellation,
scoped history and the four named windows' close/focus return. Existing local field
editors retain first refusal; passive frames prevent hidden shortcuts without receiving
new close behavior. Cancel acts on pointerdown, including an off-canvas second thumb,
and later movement/release cannot revive a discarded gesture. The original two capture
owners were replaced together. Character Escape discards its unsaved name buffer while
ordinary blur/X saving remains. The map/drawing palettes remain tool context.

The first focused browser batch passed **nine cases, no retries**: two-client desktop
and 375px touch grass, desktop and phone four-window focus/tool retention, personal
annotation history, two drawing-toolbar viewport measurements, and the two existing
touch wall/place cancellation cases. Seven cases were replayed successfully to retain
passed-test screenshots because the first list-only reporter discarded their attachment
bodies. Root inspected the held/cancelled terrain pair, annotation result, restored phone
World launcher, and both drawing layouts. This exposed two reach defects despite green
behavior tests: desktop Cancel was below the palette scroll area; landscape drawing
buttons were partly clipped by the sheet even though their centers hit and their boxes
were inside the viewport. These are acceptance failures until corrected and remeasured.
Desktop's new held-gesture reach assertion reproduced the first defect, then passed
after the history/Cancel group moved to a sticky top position. Phone initially also
overflowed Done entirely; removing Cancel's forced full-width row fixed that larger
overflow, but the screenshot identified the remaining partial clipping. The strengthened
phone check intersects targets with clipping ancestors' client boxes. Final live score,
complete house gate and U2 review remain pending; these focused passes do not close U2.

**Reach and point-action follow-up:** the stronger landscape check failed with only
**36.203px of each 44px bottom-row target exposed**; portrait remained a passing control.
Putting the size label beside its slider preserved its 44px input and font size while
making the full control row fit. Both viewports then passed all fifteen controls'
viewport bounds, full ancestor-clipped exposure, minimum width/height and center hit.
Root inspected the final screenshots and confirmed complete button borders/text.
Desktop's sticky history/Cancel group also passed the strengthened held-stroke check;
the inspected screenshot shows Cancel above the long brush list.

The additional two-client point-action test first failed during setup because it
incorrectly expected the DM-only live document ID in the player's snapshot. Source
projection confirmed that omission is intentional. The test now asserts the omission
and compares shared, filtered terrain/scenery. It passed: one press sent one placement,
the matching command acknowledgement arrived, both clients saw the same crate, Escape
and residual release preserved it, and an acknowledged **map Undo** removed it from the
player's view without drawing-history traffic. Its screenshots were inspected. The
point test and final two reach cases passed together **3/3, no retries**.

**Focused `evaluate-live` result:** achieved mode **live-two-client**, using isolated
browser contexts, real UI login/elevation, trusted Playwright mouse/keyboard and Chromium
CDP touch, passive wire observation and read-only state inspection. The two existing
wall/place Stop cases are single-client supplements; they are not multiplayer evidence.

| Criterion | Score | Observed evidence |
| --- | ---: | --- |
| Functionality | 8 | Held grass and annotation cancel without a command; a fresh gesture still commits; completed point actions remain until map Undo. |
| Multiplayer integrity | 8 | Peer terrain/annotations and map Undo match; each role's drawing history affects its own mark; player document metadata stays redacted. |
| Craft | 7 | Gesture/committed-history labels and enabled states are truthful; named windows return focus and preserve the covered tool. |
| Reach | 7 | 375px touch Cancel works before first-finger release; all fifteen drawing controls expose at least 44px in both tested orientations. |

Weighted score **7.65 / 10** against the 7.0 threshold. Regressions found during this
evaluation—desktop hidden Cancel and phone complete/partial clipping—were repaired and
rerun. Limits: this is Chromium touch emulation, not physical-device or WebKit testing;
room/erase, modal/identity/layout transition edges and native IME/select arbitration
have focused unit/contract coverage rather than a newly claimed two-client live drill.
Chat barriers bound observation; they do not establish total ordering across sockets.
The full house gate and independent U2 review remain required before the local commit.

**First integrated house gate:** build, typecheck, lint/frozen, structure and formatting
passed. The unit runner stopped at one legacy quick-wheel assertion that required Escape
never to reach any bubble listener, encoding the removed capture-phase implementation.
All 162 frozen hashes matched after this failure. The repaired test uses the real tool
hook and asserts the behavior: one consumed Escape closes the wheel once, preserves
Map Edit and makes no sub-tool change. It and the four existing mounting-order/gesture
ownership cases passed **10/10**. Original `ui-gate-*` logs remain intact; the complete
gate is repeated under `ui-gate-repaired-*`. No full-unit or E2E pass is inferred from
this interrupted run, and no independent U2 review round has begun.

**Second integrated house gate:** the first five steps passed again. Units reached
batch 72/73 and found one additional legacy App expectation: toggling Transform to
Move was required to clear selection immediately. U2 deliberately separates tool exit
from the later Move-selection Escape step. All 163 frozen hashes matched on failure.
Independent read-only diagnosis confirmed the test used the real tool/selection manager
and an obsolete expectation, not a missing production call. The revised App case proves
Transform becomes Move without deselection, then Draw still clears once, using the
existing snapshot fixture with the current user's roster row. The App suite, real
selection-owner/role/clear-intent suites, and the final four utility suites passed
**110/110 in eight files**. This is a test-contract repair only. The prior logs remain
under `ui-gate-repaired-*`; the complete gate will repeat as `ui-gate-final-*`.

**Third integrated house gate:** the first five steps passed; the unit run stopped
on MobileLayout's complete forwarding inventory still expecting its removed local
`mapEditCancelSignal` counter. The shared Cancel owner now connects the dock to the
canvas directly; the lower-level optional signal API and its tests remain supported.
All 164 frozen hashes matched on failure. Removing only that obsolete inventory key
preserves exact comparison for the other nineteen forwarded map properties. A focused
run of **all forty final-batch suites passed 869/869**, including the App and mobile
layout suites and all previously interrupted tail tests. Independent read-only search
found no additional stale cancellation contract to change. Logs `ui-gate-final-*`
preserve this failed run; `ui-tail-regression.log` records the passing forty-suite run.
The full gate repeats under `ui-gate-integrated-*`; independent U2 review is still unrun.

**Completed U2 mechanical gate (2026-09-23):** build, typecheck, lint/frozen,
structure, formatting, all unit suites and the bundle check passed on the frozen
165-file tree. Units: **9,713 passed** — 6,546 client (four existing skips), 2,715
server and 452 shared. Main bundle: **130.47KB / 175KB**. The additional strict
actual-source/test compiler check reported zero diagnostics, setup errors or changed
inputs across 153 client roots, 80 test fixtures, 66 test files and ten E2E files.

The first full browser invocation ended with Playwright's saved status `passed` and
no failed test IDs, but the Windows PowerShell wrapper treated a local server stderr
warning as `NativeCommandError` and lost the detailed console summary. Its wrapper
exit was 1; counts and retries cannot be recovered from that invocation. This is
documented in `ui-wrapper-failure-note.md`; it is not presented as a clean wrapper run.
Only E2E was repeated with raw output capture and durable JSON, preserving the seven
other completed gates. The confirmed run exited **0: 234 passed, three existing
skips, zero retries, zero failed attempts, zero report errors**, in 19.3 minutes.
Evidence: `ui-browser-confirmed.log`, `ui-browser-confirmed-report.json` and
`ui-browser-confirmed-exit.json`. The three skips remain the two map-navigation cases
and the legacy DM-toggle case. All **165 hashes matched** the original integrated
gate snapshot afterward, and `git diff --check` passed. No production code changed
between focused live acceptance and these completed gates.

The four-lens U2 `review-convergence` round starts only after this record. Its review
snapshot includes this evidence append; preparation of later Generate work remains
ignored, unadopted and unverified. U2 is not committed or accepted by review yet.

**Formal U2 review, round 1:** four fresh pinned reviewers completed static,
read-only reviews: gesture/cancellation FAIL (two findings), keyboard/focus FAIL
(one), test validity FAIL (one), and documentation/privacy/structure PASS. The
union has four findings; `agents_error: 0`. All reviewers and the executor's final
comparison found all 165 frozen hashes unchanged. This is a valid FAIL, not an
interrupted or accepted review. Reports and union: `ui-r1-gestures.md`,
`ui-r1-keyboard.md`, `ui-r1-tests.md`, `ui-r1-honesty.md`, `ui-review-r1-union.md`.

The repairs are confined to those findings: primary-button admission to canvas
authoring while retaining middle-button camera pan; a shared pending-gesture owner
for marquee selection; Kick's desktop paint/root band raised from 260 to 1100,
above DM's 1002; and acknowledged desktop point journeys for Scatter and Light
alongside Place. The marquee's live ref clears synchronously before residual
release or a selection callback. The first Escape retains Select; a later Escape
can leave it. Secondary release cannot complete a held primary stroke. No touch
router rewrite or protocol change is part of these repairs.

Regression-first evidence: Kick's three new cases failed while 19 controls passed;
the mouse/marquee group failed 16 new assertions while 44 controls passed. After
the production repairs, all **82 cases in seven files passed**, including the 21
new regressions. Logs: `ui-r1-kick-red`, `ui-r1-gestures-red`,
`ui-r1-repairs-green`. A strict actual-test compiler pass found one invalid
Testing Library `exact` option in the new Kick fixture; removing that unsupported
option preserves the string-name match. Its follow-up check is still required.

The first repaired two-client browser run passed all three desktop point journeys
but failed two new test setups. The Quick wheel has a deliberate zero-size radial
anchor and eight visible positioned buttons; asserting the anchor's box visible
was wrong. The revised test checks every button's visibility and center hit, plus
owner mount/unmount. The Kick journey passed its DM/Kick dismissal steps, then
tried to click Help through the overlapping Kick form. Its correction uses real
keyboard traversal to Help. Original failed logs/screenshots remain under
`ui-r1-live-first*`; this **3-pass/2-fail** invocation is not live acceptance.
Production behavior was not changed in response to those two setup mistakes.

**Repaired focused acceptance:** `ui-r1-live-corrected` passed **6/6**, with zero
retries, failed attempts or report errors: Place, Scatter, Light, secondary-mouse
navigation, DM/Kick/Help ordering, and held-marquee cancellation. The desktop point
tests observe exactly one add command while the mouse is held, its matching server
document acknowledgement, preservation through Escape/release, and a separate
acknowledged Undo. Scatter adds seven stamps in one command/Undo step. Light checks
the deliberately published pool fields on both clients, while authored documents
and player compiled-light metadata remain absent from the player connection.

The mouse test checks all eight rendered wheel buttons and their center hits;
right-click and middle-button pan produce zero extra map commands and unchanged
DM/player map content. The marquee test first creates a player-owned drawing, then
checks no selection command or peer-state change after cancellation and residual
release. A fresh drag without rearming Select must select that drawing through the
server on both clients. A later Escape changes only the tool to Move.

Screenshot inspection caught one additional weakness in the passing Kick setup:
the elevation toast had intercepted its title-bar drag, so the Name-field center
was not actually over DM. The test now waits for the toast to disappear, proves the
DM window moved, and asserts the hit-test point lies within both windows. This
strengthened case passed separately **1/1**, zero retries, under
`ui-r1-kick-overlap`; its screenshot was inspected. Kick closes before DM, retains
the unsent Atlas draft, and stays below Help. All screenshots are retained in the
corresponding `*-shots` directories extracted from the durable browser JSON.

**Negative control:** temporarily skipping only desktop Light dispatch still
compiled. The strengthened point suite then passed Place/Scatter and failed Light
at its held-press command-count assertion (**2 pass / 1 expected fail**). The
wrapper restored the original source bytes in `finally`, with matching before/after
SHA-256; restored Light subsequently passed in the six-case acceptance run. Evidence:
`ui-light-probe-types`, `ui-light-probe-red`, `ui-light-probe-restoration.json`.
The failure log also contains fixture-cleanup noise after the real assertion; that
noise is not the negative evidence. The final strict actual-files check passed with
zero diagnostics/setup errors/changed inputs across 162 client roots, 86 test and
fixture roots, 71 test files and thirteen E2E files (`ui-r2-final-types-report.json`).

Achieved evaluation mode remains **live-two-client**. Functionality 8, multiplayer
integrity 8, craft 7, reach 7: weighted **7.65 / 10**. The repaired desktop routes
add coverage; phone reach remains supported by the earlier two-client touch and
44px checks, not a newly claimed phone run. The second-finger marquee path has
real-hook/router tests. Chromium/physical-device and bounded-barrier limits above
remain. No product regression was observed in these focused checks. The full gate
and fresh formal review round 2 remain required before committing U2.

**Repaired full U2 gate (2026-09-23 local):** all eight steps passed: build,
typecheck, lint/frozen contracts, structure, formatting, units, bundle and E2E.
Units: **9,734 passed** — client 6,567 plus four existing skips across 73 batches,
server 2,715 and shared 452. One client summary had concurrent progress dots before
its text; the corrected log parser and manual count agree on all 73 summaries.
Main bundle: **130.48KB / 175KB**. Structure inspected 842 source files, retained
22 grandfathered oversized files and found no new violations.

The browser list summary and durable JSON agree: **239 passed, three existing
skips, zero retries, zero failed attempts, zero report errors**, in 19.9 minutes.
The skips remain the two map-navigation cases and legacy DM-toggle case. Every
gate command exited 0. Evidence is retained under `ui-r2-gate-*`, including the
browser `-report.json` and `-exit.json`; the strict actual-files compiler evidence
above remains applicable. All **177 frozen hashes matched** after the full run,
and `git diff --check` passed. No source changed during verification.

Only this ledger's current frontier and completed-gate evidence are updated before
freezing the round-2 review packet. The four fresh reviewers inspect the complete
U2 diff against `f6a4c684`, including regressions beyond the four repaired findings.
Their mode is static/read-only; executor live evidence is not a claim that reviewers
independently drove the browser. The maximum remains three formal rounds. U2 is
still pending review acceptance and a local commit; no remote shipping is authorized.

**Formal U2 review, round 2:** completed valid FAIL. Gestures reported one finding;
keyboard/focus reported two; test validity and documentation/privacy/structure passed.
The union contains **three findings**, down from four in round 1; all four prior
findings are closed in the reviewed paths. `agents_error: 0`. Each reviewer and the
executor compared the frozen 177 paths before/after with zero hash differences.
Reports and union are retained as `ui-r2-{gestures,keyboard,tests,honesty}.md` and
`ui-review-r2-union.md`. All achieved modes were static/read-only.

The missed paths are a still second finger landing on an inert off-canvas target
before the first finger lifts; Kick's split mobile/desktop open state and lost draft
at the breakpoint; and G opening Kick beneath Character/Help while stealing focus.
The passing earlier touch checks used a stage move or Stop control and do not cover
the new inert-target sequence. The passing DM/Kick composition does not cover G
beneath another window or a layout crossing. Repairs will add those regressions,
characterize any moved state first, and preserve the existing passing paths. Fresh
round 3 follows repaired live evidence and the full gate; no fourth round is allowed.

### U2 round-2 repairs and focused verification

The off-stage second-touch repair adds a passive document capture listener to the
existing router. It clears its active-gesture flag before cancelling, including when
the external target stops propagation. It does not change camera routing or prevent
that external touch's default behavior. Eight DOM-event tests cover both lift orders,
immediate cancellation, a fresh subsequent gesture, stage pinch exactly once, current
callbacks, idle/single-finger controls, cleanup and StrictMode.

Kick now owns one nullable unsent draft in the existing App-level hook. Open derives
from that draft; mobile consumes the same controls. Layout replacement preserves all
fields, while deliberate dismissal, another surface or confirmed role loss discards
it. A null reconnect snapshot preserves it. The G shortcut uses the existing native,
composition and foreground-admission gate. The moved behavior was characterized
first: baseline **48/48 passed**, including three new naming/seed/cancel/submit cases.
The five production files remain under the 348-line working budget (largest 309).
The controlled test fixtures replace obsolete split-state assumptions; existing
pending, command, cancel, focus and baseline assertions were preserved.

**Negative evidence:** the combined compile-valid regression run recorded **21 expected
failures / 43 passing controls**: five touch failures and sixteen Kick failures.
`ui-r2-kick-touch-red` and `ui-r2-kick-touch-types-report.json` retain the evidence.
The first touch fixture used incomplete Touch records; its initial compile failure
is retained and not evidence of a compile-valid negative. Complete Touch records
were used for the combined run and strict pass. Browser Grass reproduced the stray
commit before repair. The initial Place case instead used an incorrect asset ID;
correcting it to the actual `objects:crate` made Place independently reproduce the
same stray add-element command (`ui-r2-offstage-place-red`, zero retries).

**Focused GREEN:** **165 tests passed across eleven files** in `ui-r2-repairs-green`,
including the new regressions and existing Kick/mobile/router controls. The strict
actual-files compiler passed with zero diagnostics, setup errors or changed inputs:
171 client roots, 94 test/fixture roots, 75 test files and fifteen E2E files. A final
repeat after the browser-locator correction is recorded separately under
`ui-r2-repairs-final-types-report.json`.

**Live browser evidence:** `ui-r2-repairs-live` passed five cases: desktop and phone
Grass cancellation, DM/Kick/Help layering, and inert off-canvas second-touch cancellation
for Grass and Place. Both new touch cases prove Cancel is disabled before either finger
lifts, no extra map command or changed DM/player map, and an acknowledged fresh next
gesture. Their external target is actual inert dock padding, with no inserted overlay,
Stop press or intervening canvas move. The sixth case passed its layout steps but
failed an ambiguous Character launcher locator (two cards visible to the DM). Only the
locator was scoped to the card marked You. The complete corrected Kick journey then
passed **1/1 with zero retries, failed attempts or report errors** in
`ui-r2-kick-live-corrected`. The initial mixed run remains **5 pass / 1 setup failure**,
not a full passing invocation.

The corrected journey retains Name, Theme, Density, Size, Seed and Door across both
layout directions and back, checks visible focus and one phone surface, exercises
phone G, and confirms Cancel does not reappear after resizing. Real keyboard traversal
to Character's non-editable Close button and a real Help topic click prove G neither
mounts a hidden Kick form nor steals focus. G opens Kick after the foreground owner
is dismissed. Both clients retain map/Atlas content; no map/Atlas/drawing command is
sent by this journey. It does not claim a live ROLL test: submit/pending behavior is
covered by the characterization, lifetime and existing unit controls.

Screenshots from the passing touch and corrected Kick cases were extracted and
inspected under their `*-shots` directories. Achieved mode is **live-two-client**,
Chromium with 375px touch emulation and 1440px desktop; no physical-device or WebKit
claim. The earlier bounded-barrier limits remain. The U2 evaluation remains **7.65/10**
(functionality 8, multiplayer 8, craft 7, reach 7). Full gates and fresh formal R3
are still required; no U2 commit or broader-menu implementation is claimed.

**Final repaired U2 mechanical gate (2026-09-23 local):** all eight steps passed.
Units: **9,764 passed** (client 6,597 plus four existing skips across 74 batches,
server 2,715, shared 452). Structure inspected 848 files with 22 grandfathered
oversized files and no new violations. The main bundle is **130.73KB / 175KB**.
The full browser list and durable JSON agree: **242 passed, three existing skips,
zero retries, zero failed attempts, zero report errors**, in 19.4 minutes. Skips
remain the two map-navigation cases and legacy DM-toggle case. All commands exited 0.

The mechanical runner hit the usage limit after dispatching the unit suite. That
suite still completed successfully, with its raw log and durable exit record intact.
On resumption the completed six gates were preserved and only bundle/E2E ran. No
formal round-3 reviewer had been dispatched, so this is an interrupted gate runner,
not a void formal review. Evidence: `ui-r3-gate-*` and `ui-r3-gates-report.md`.

The original pre-gate snapshot contained 188 paths. A status-to-manifest audit during
the gate found two already-changed existing test files omitted from the owned list:
`KickPanel.test.tsx` and `useMobileSurface.test.ts`. Both were already in the passing
165-case focused run; no source or test changed when the inventory was corrected.
A supplemental 190-path snapshot was captured then. The executor compared the original
188 and supplemental 190 hashes after completion; both had zero differences, as did
the runner's supplemental comparison. All 190 changed paths now appear in the review
manifest. This does not claim that the supplemental snapshot predated the build.

The expanded strict actual-files compiler also passed: **173 client roots, 96 test/
fixture roots, 77 test files, fifteen E2E files**, zero diagnostics, setup errors or
changed inputs (`ui-r3-complete-inventory-types-report.json`). `git diff --check` passed.
Only this ledger is updated after gate completion and before freezing the full final
review packet. U2 remains uncommitted pending the four fresh independent reviewers;
round 3 is the final allowed round. U3a preparation, including newly identified
transport retry constraints, remains ignored and unadopted.

**Formal U2 review, round 3 — owner checkpoint:** completed **valid FAIL**. Keyboard/
foreground/focus/layout, test validity, and documentation/honesty/privacy/structure
passed; the gesture lens reported one P2. All four fresh independent static/read-only
reviewers completed. `agents_error: 0`; no lens was unavailable. Every reviewer and
the executor compared the frozen 190 paths with zero differences before this record
was appended. Recovered read-command errors are disclosed in the individual reports;
no source was changed during review. Reports: `ui-r3-{gestures,keyboard,tests,honesty}.md`;
union: `ui-review-r3-union.md`.

The remaining source-reviewed path is **Atlas link aim with a stationary first finger
on the map and a second finger on inert off-stage dock padding**. With no stage move,
the stage-only aim guard misses the second finger; the router's new document listener
covers ArmedTouchTool gestures, which excludes Atlas aim. A subsequent Stage tap can
submit an unintended `atlas-create-link`. No new live reproduction is claimed. Existing
Atlas pan/pinch tests and the new Grass/Place off-stage tests do not cover this sequence.
The bounded repair is to mark the aim's active touch sequence non-tap on an off-stage
second touch, preserve the armed aim/camera, and prove a later clean tap places one link.

Finding counts converged **4 → 3 → 1** over three formal rounds with four reviewers
each (twelve completed reviews). Exact reviewer token cost is unavailable. The final
mechanical gate above remains green, but does not override this finding. The project
`review-convergence` skill requires stopping and reporting to the owner at round 3;
no fourth formal review, post-cap code repair, U2 acceptance commit or U3a implementation
has begun. The owner can authorize a bounded post-cap repair/verification/acceptance
path. All local changes and verification evidence are preserved; nothing was pushed.

## U2 post-cap Atlas repair — owner continuation

The owner said “resume u3a” after the round-3 checkpoint. This authorizes the bounded
remaining Atlas repair and local U2 closeout before U3a; it does not turn round 3 into
PASS or authorize a fourth formal review, remote push, merge or deployment.

A passive document-capture touchstart listener now marks an existing stage-origin aim
gesture as non-tap when a second finger lands outside Konva. It leaves camera routing
and armed aim intact and removes its listener on disposal. No protocol change.

Evidence in `output/interface-u2-execution/`:

- `ui-postcap-aim-red`: three desired unit failures, six controls pass; strict-valid
  actual source/tests (`ui-postcap-red-types.json`, zero diagnostics).
- `ui-postcap-aim-live-red-corrected`: both lift orders send one unwanted link on the
  original code. The first run had an extra touchEnd in cleanup masking the assertion;
  that test-only cleanup was repaired before the discriminating rerun.
- `ui-postcap-aim-green`: 25 tests pass across five gesture/aim files.
- `ui-postcap-aim-live-verified`: three browser tests pass, no retries or failed attempts.
  Two new private-table journeys each drive a phone DM and a separate desktop player:
  stage finger, inert real dock padding second finger, no subsequent movement, either
  lift order, no link, retained aim, then exactly one link from a fresh tap. The player
  receives its exit anchor without the undiscovered destination or DM visibility field.
  The existing mobile pan/pinch/door-targeting control also passes. Its camera injection
  is historical fixture behavior; the two new journeys use no injected camera or state.
- The initial green-code browser run reached the fresh-tap/player comparison but failed
  because the fixture expected unredacted DM fields. The corrected assertion requires
  the exact safe player projection; production projection code was unchanged.
- `ui-postcap-final-types.json`: 175 client roots, 97 test/fixture roots and 16 browser
  roots strict-checked with zero diagnostics and no changed inputs.

Live mode: **live-two-client**, Chromium touch emulation at 375×812 plus desktop 1440×900.
Functionality 8, multiplayer 8, craft 7, reach 7 = **7.65/10**. No new gesture regression
observed. Screenshots of retained aim and player after the fresh tap were inspected.
Existing online badge overlaps part of the phone aim heading; its instruction remains
readable. The player screenshot catches progressive terrain painting and is not proof
of a fully rendered link sprite; link synchronization/redaction uses actual snapshot
and passive wire assertions. Physical touch devices and WebKit were not tested.

**Full post-cap gate: PASS.** All eight house steps completed in order: build,
typecheck, lint/frozen tests, structure, format, units, bundle and E2E. Units:
client 6,601 plus four existing skips; server 2,715; shared 452 — **9,768 passed**.
Bundle: 130.73 KB gzip against 175 KB. E2E: **244 passed, three existing skips**,
zero retries, failed attempts, unexpected/flaky results or report errors (19.6 minutes).
The three skips remain camera reset/grid visibility in map-navigation and DM toggle
in ui-state. Structure scanned 849 files with no new violations. Both runner and
executor compared all 193 frozen paths after the gate with zero differences;
`git diff --check` passed and HEAD remained `f6a4c684` during verification.
Raw evidence: `ui-postcap-gate-*`, report `ui-postcap-gates-report.md`. No gate was
retried. This completion record was appended after the frozen code/test verification.
U2 now proceeds to the authorized local acceptance commit; nothing is pushed.
An additional direct Prettier probe of this ledger reported only three pre-existing
table alignments. The house format command does not scan `docs/`; those tables were
left unchanged, and this extra probe is not reported as passing.
