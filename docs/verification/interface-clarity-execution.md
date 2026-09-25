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
  post-cap gate passed and U2 is locally committed as `7923c3de`.
  U3a history: local auth repair `845d078c` and characterized extractions `42152fd3`
  preceded the Generate outcome repair. Review round 1 found
  five distinct issues, now repaired. A player-baseline synchronization error in the
  phone E2E is also corrected. The fresh full ladder, boot and two-client Generate
  journeys pass. Independent round 2's one queue interleaving finding is repaired;
  the repeated full ladder and boot pass. Final round 3 left one P2 recovery finding.
  The owner's 2026-09-24 continuation request authorizes the bounded post-cap repair
  and verification. That repair now passes actual behavioral RED/GREEN checks, six
  desktop/phone Generate journeys, the full eight gates and isolated fresh boot.
  The owner accepted the [verified checkpoint](interface-clarity-u3a-checkpoint.md)
  on 2026-09-24 with “acccepted.” The local semantic commit and U3b continuation
  are authorized; no fourth formal U3a review will run.
  The accepted semantic repair is locally committed as `b473a3dd`.
  U3b's R1/R2 findings are repaired. The final full ladder and boot pass:
  10,018 unit passes/four skips and 258 browser passes/three skips. Final
  R3 finished with one stale audit-status P3, now corrected. Counts are 2 → 5 → 1,
  12 completed assignments, zero semantic agent errors. The owner accepted the
  capped U3b checkpoint with “Accept and commit locally.” U3b is locally complete
  in the commit containing this record; no fourth review. U4–U10 remain unimplemented.
  The U3a owner checkpoint is satisfied.
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

## U3a prerequisite — characterized queue and headroom extraction (active)

U2 is accepted locally at `7923c3de`; no remote delivery occurred. This prerequisite
keeps existing behavior, including characterized defects, before the outcome repair.
The controller queue moved to `useMapStudioQueue`; transport config/callback types,
App/map-edit interfaces and the existing Generate cell/size helpers moved to siblings.
One controller, one queue, existing command IDs and protocol are retained.

Actual baseline evidence in `output/interface-u3a-execution/`: queue 57 PASS
(existing 46 plus new 11); transport/region 44 PASS (new 18 transport, new 7 region,
existing Generate 19); composition 33 PASS (new 3, existing state 19 and App 11).
App transport handoff adds 2 cases. Strict compilation found fixture mistakes
(`paint` instead of `terrain`, nullable background, missing recipe params/users).
Corrected App/composition fixtures were rerun on original HEAD production code:
5 PASS (`u3a-complete-fixture-baseline`). Extracted production was restored afterward.
The combined extraction parity run passed 136 tests in 12 files before the final
users-array fixture addition; full gates below verify the final tree.
`u3a-headroom-final-types.json` explicitly compiled all 23 adopted source/test roots
with the real strict configuration: zero diagnostics, no changed inputs.

Full prerequisite verification is pending. No semantic outcome, containment,
recovery UI or live U3a acceptance is claimed yet. Next: commit this prerequisite
only after the complete ladder, then implement IA-18 and checkpoint before U3b.

First full prerequisite ladder: **FAIL** in one client source-consistency test,
`MessageRouter.session.test.ts:92`, whose config-union path still named websocket.ts.
All seven other gates passed, including E2E 244 PASS / 3 pre-existing skips with
zero retries, failed attempts, flaky cases or reporter errors. Unit execution stopped
before all client batches: observed 5606 client PASS / 1 FAIL / 4 existing skips,
server 2715 PASS, shared 452 PASS; do not read this as a complete unit pass.
All 24 frozen hashes matched before/after; HEAD stayed `7923c3de`.

After that run completed, corrected only the test's CONFIG_SOURCE path and its prose
to `serviceTypes.ts`, preserving every union/guard/subscriber assertion. The four
source-consistency controls plus two final App-handoff cases pass (6 total), under
`u3a-prereq-source-test-repair`. A fresh complete ladder is required before commit.

Second full prerequisite ladder: **FAIL** in E2E only. All 9,809 unit tests passed
(client 6,642, server 2,715, shared 452; four existing client skips), and the other
six non-E2E gates passed. Browser result: 242 PASS / 2 FAIL / 3 existing skips,
247 results, zero retries/flaky/reporter errors. All 25 frozen hashes matched.
The auth case timed out after correcting a rejected password; the hidden-creature
case failed before navigation with `net::ERR_CONNECTION_FAILED` to localhost5175.
Its privacy assertion never ran in that failed case. The runner also printed two
artifact step-ID warnings. Failure artifacts were preserved under
`output/interface-u3a-execution/prereq-final-failure-artifacts/`.

A bounded read-only auth recon and saved video identified a rejected-socket retry
window: FAILED re-enabled Enter Table before the server's scheduled 100ms close.
The exact lost-click timing is inferred, not traced. A deterministic regression
proved the unsafe enabled button and bypassable form handler (2 RED, 1 control PASS).
AuthenticationGate now guards both during FAILED, retaining the editable password
and reason until reset/reconnect. New and existing auth tests: 25 PASS. Actual strict
source/test roots: zero diagnostics. The unchanged auth E2E and unchanged hidden
creature E2E both passed afterward (2 PASS, zero retries). No blind timing delay or
navigation retry was added. A fresh full ladder still precedes the local commits.

Third prerequisite/auth-fixed ladder: **PASS**. All eight house steps completed
in order. Units: client 6,645 PASS / four existing skips, server 2,715 PASS,
shared 452 PASS — **9,812 passed**, all 82 client batches completed. Bundle:
130.92 KB gzip. E2E: **244 PASS / zero failures / three existing skips** in
20.1 minutes; 247 results, zero retries, failed attempts, flaky cases or reporter
errors. Both runner and executor verified all 27 frozen paths unchanged; HEAD
remained `7923c3de`. `git diff --check` passed. Evidence:
`output/interface-u3a-execution/u3a-prereq-auth-fixed-gate-*` and
`u3a-prereq-auth-fixed-gates-report.md`. This completion record was appended after
the frozen verification. Proceeding with the focused local auth repair and the
characterized extraction commits; no remote delivery. U3a's actual outcome repair,
new behavioral regressions, live evaluation and review are still outstanding.

## U3a outcome repair — implementation and focused verification (active)

Prerequisite commits are local: auth `845d078c`, extraction `42152fd3`. The actual
repair was adopted only after behavioral RED tests against those extracted seams.
Old-API client regressions: **12 RED, one ordinary-ACK control PASS** (13 cases),
strict roots clean. These pin eager Built, repeated activation, document identity,
containment, terminal-reply retirement and receipt-without-result recovery. Server:
three baseline characterizations plus three ambiguity controls PASS; one fresh
locked-layer positive-classification assertion RED. The first strict server probe
found extensionless local fixture imports; corrected to `.js`, then all four strict
roots passed and the same six PASS / one RED repeated. Minimal enqueue-time handle
API compiled cleanly before nine queue outcomes failed behaviorally (four assertions,
five unresolved-completion timeouts); missing imports were not counted as RED.

The implementation keeps one controller queue and existing IDs. Entry-owned handles
settle on matching document/command replies or explicit unsent/uncertain drops.
Generate marks Built only on its own success; containment and persistent preview use
the actual document. Fresh pre-apply refusals carry an added value in the existing
error-code union, qualified by continuous send-attempt observation before permitting
direct retry. Receipt ACK alone cannot stop Generate's existing bounded same-ID
retries: a lost application result eventually becomes unconfirmed, requiring refresh
and explicit inspection. No new queue or wire fields were added.

First focused outcome run: **40 PASS** in eight files. Broader map-edit, preview,
phone feedback, App handoff and prior characterizations: **572 PASS** in 66 files.
Layout/transport/controller follow-up: **143 PASS** in three files (the requested
App.test.tsx filter matched no file; no App-test pass is claimed from that run).
The first server green attempt caught a real callback forwarding omission: the
handler adapter dropped the new optional classification argument. Corrected that
forwarding, then **26 PASS** across the seven new server cases and 19 existing
Generate contracts. Shared build passed. All actual changed client/E2E roots and
all eight changed server roots compiled strictly with zero diagnostics. Structure
passed with no new violations. Full semantic gates and review remain outstanding.

Initial semantic lint found two unescaped JSX apostrophes in the recovery buttons;
repair is pending while the first browser attempt finishes. Browser setup exposed a
new helper waiting to close a player-settings window that DM elevation had already
unmounted; saved screenshots corroborate that state. No live U3a PASS is claimed.
Evidence prefixes: `u3a-outcome-old-api-red`, `u3a-server-outcome-strict-red`,
`u3a-enqueue-handle-red`, `u3a-core-outcomes-green`, `u3a-region-ui-parity`,
`u3a-layout-transport-parity`, `u3a-server-outcomes-forwarded`,
`u3a-semantic-{client,server}-types`, `u3a-semantic-structure`,
`u3a-semantic-lint`, `u3a-browser-initial`.

### U3a live evidence and semantic gate frontier

The two JSX apostrophes are escaped; `u3a-semantic-lint-fixed` passes. The initial
browser run ended with zero PASS / four FAIL: two setup timeouts after DM elevation
unmounted player settings, and two assertions incorrectly looking for generated
walls in the decorative-element channel. The helper now closes settings only when
present and checks compiled walls/doors, revision and terrain in the player client.
The next run (`u3a-browser-calibrated`) had three PASS / one FAIL: a phone gesture
at a half-cell snap boundary selected x=13 instead of x=12. Trusted input now uses
cell + 0.2, away from the rounding boundary; the expected 12,12,24,24 region stayed
unchanged. `u3a-browser-snap-margin` then passed all four cases without retries.

Final run `u3a-browser-player-view`: **four PASS, zero failures, skips, retries,
flaky cases or reporter errors**, 98.9 seconds. This also checks the final plain
language transport toast and positions the player's camera using ordinary controls.
Earlier screenshots whose player camera pointed away from the dungeon are not
rendering evidence. Final screenshots in `browser-final-evidence/` were inspected:
the player sees the generated dungeon, without private Generate controls; the phone
retains seed/theme/density after refusal and exposes the explicit recovery path.
Latest actual strict roots pass (`u3a-final-live-path-types.json`), and final App,
transport and queue parity tests pass 20 cases (`u3a-copy-and-app-parity`).

Achieved evaluation mode: **live-two-client**, through the repository's real
Chromium Playwright clients and server on test ports 5175/8788. Each case drives a
DM and separate desktop player; refusal adds a second DM to lock/unlock a layer.
DM sizes: desktop 1440x900 and phone 375x812 with trusted touch gestures. Application
state seams are read-only. A network fault suppresses only Generate application
results while delivering receipt ACKs: four identical sends use one command ID,
the server applies one revision, and refresh/inspection sends no new generation.
Actual phone recovery button boxes meet 44px. No physical device, WebKit, landscape,
or phone-player evaluation is claimed; document switches and late replies are
covered by focused unit tests rather than this browser run.

| Criterion | Weight | Score | Evidence / limits |
| --- | --- | --- | --- |
| Functionality | 0.35 | 8 | Refusal, explicit retry, confirmed success and uncertain completion work |
| Multiplayer integrity | 0.30 | 8 | Player receives one compiled dungeon; private document frames withheld |
| Craft | 0.20 | 7 | Clear pending/recovery language and retained recipe; palette still long |
| Reach | 0.15 | 7.5 | Desktop mouse and 375px touch pass; physical devices untested |

Weighted score: **7.725 / 10**, above 7.0. This is live evidence, not the independent
review verdict. Minor existing shell issue: on the phone, open Build > Generate,
choose a region and trigger a refusal; the 14-tool palette pushes the local result
below the fold. `2-refused-inputs-retained.png` shows this. U3b's grouped palette
should keep Generate status beside its action within the 375x812 sheet. The global
failure toast can also still be visible immediately after a successful retry
(`2-successful-retry.png`); no claim of polished unified notification ownership is
made. New feedback uses the established JRPG palette and headings. Compared with
the initial run, setup, snap targeting and visible player evidence improved; no
new runtime regression was observed in the four final cases.

Next: freeze this actual tree, run all eight house gates plus the required 30-second
dev boot, then bounded independent review-convergence. No semantic commit, remote
push, production delivery, or U3b work is authorized by this evidence alone.

### U3a full semantic ladder — PASS; independent review pending

All eight house gates passed on the frozen semantic tree at `42152fd3`, without
repairs or retries during the run. Unit results: client **6,753 PASS / four existing
skips**, server **2,722 PASS**, shared **452 PASS** — **9,927 passed** total, all 84
client batches complete. Bundle check: **133.86 KB gzip / 175 KB limit**. Full E2E:
**248 PASS / zero failures / three existing skips**, 251 attempts, zero retries,
failed attempts, flaky cases or reporter errors. All four new Generate cases passed
again. Structure scanned 866 files with no new violations. SHA-256 checks matched
all 73 frozen paths before and after; HEAD stayed `42152fd3`.

Fresh dev boot passed for more than 30 seconds on **5176/8789**, with disposable
state. Existing, unowned services occupied the normal 5174/8787 ports and were
preserved. Both new processes became ready; server health and the transformed client
entry returned 200, with no missing-export or SyntaxError logs. Only the new owned
processes were stopped afterward. This is not a claim of a fresh boot on the normal
ports. Full commands, counts, skips and logs:
`output/interface-u3a-execution/u3a-semantic-gates-report.md`.

The completion record and this opening frontier were synchronized after frozen
verification. No product or test file changed. Next is a four-lens, read-only,
independent review-convergence round, with at most three rounds and fresh reviewers
per round. No independent U3a verdict is claimed yet.

### U3a independent review — round 1

Four fresh, read-only reviewers (`gpt-6-sol`, high reasoning) completed; three ran
in parallel and the fourth used the next free slot. Achieved mode was **static**
source review, with saved browser evidence where relevant. **agents_error: 0**;
all 73 review-frozen hashes matched afterward. Verdict: **FAIL**, six raw findings
deduplicated to **five** (the phone toast finding appeared in two lenses):

1. Queue/lifecycle, P1: a refused, dropped or unanswered conflict refresh can strand
   its unsent successor and leave its operation pending.
2. Transport/server, P1: cached Generate replay can claim success after a live-scene
   recompile failed following document persistence.
3. Transport/server, P2: a cached Generate reply omits the campaign weight update.
4. Generate UI/geometry, P2: imported grid offsets can make a pixel-contained region
   exceed the server's 65,536-cell coordinate limit while the client presents it valid.
5. UI plus evidence/honesty, P2: the phone's successful retry can show its previous
   error toast while the current Built message is below the visible sheet. The earlier
   live record disclosed this, but treating it as polish to defer did not satisfy
   U3a's visible outcome contract. It must be repaired in this slice.

Reports: `output/interface-u3a-execution/u3a-r1-{queue,transport,ui,evidence}-review.md`.
The evidence reviewer corroborated gate counts and behavioral RED records; the privacy
lens found no introduced player data leak in reviewed paths. These are scoped static
observations, not independent live passes. Next: behavioral regressions for all five,
bounded repairs, full verification, and a fresh second round. No semantic commit yet.

### U3a round-1 repairs — focused PASS; full recheck pending

Before product repairs, new client regressions gave **six RED / 44 PASS** and
server replay regressions **four RED / two PASS**, with actual strict roots clean.
The strengthened browser journey failed both desktop and phone immediately after
success because the old refusal toast was still present; it did not wait out the
toast timer. A notification ownership test also failed. Its first strict probe found
an overly narrow `null` fixture prop; after widening that prop to `string | null`,
strict compilation passed and the same behavior remained RED.

Repairs are bounded to the five findings:

- Conflict refresh has a document-scoped 12-second prerequisite-GET deadline, separate
  from sent-command outcomes and independent of the panel's loading watchdog. A matching
  not-found, dropped GET or deadline cancels only unsent successors. Late frames cannot
  revive them; switching documents, successful refresh and disposal clear the deadline.
- The existing bounded server command-cache entry records completion only after the
  required Generate work, including live compilation. An incomplete cached result
  remains uncertain. Confirmed replays include the campaign weight and request a public
  live snapshot/save, without applying the command twice. Completion metadata stays out
  of documents and expires with that cache; no second completion store was added.
- The client uses the existing shared terrain-cell magnitude constant for both endpoints,
  retaining drawable invalid geometry while blocking dispatch with a useful reason.
- A map error retains its toast ID and retires only that toast when superseded. The phone
  scrolls its result/action/recovery group into view when the operation status changes.
  Unrelated notifications survive. The successful-retry E2E now checks the old toast's
  immediate absence and that the entire matching Built hint is in the viewport.

Focused repair results: **283 client PASS** and **40 server PASS**, followed by **15
client lifetime/transport PASS** and **four cache-lifetime PASS**. These runs overlap;
they are not added into a distinct-test total. Actual repaired client and server strict
roots pass. Focused client lint and structure pass (867 files, no new violations).

Real browser recheck `u3a-r1-visible-outcomes-green`: **four PASS**, no failure, skip,
retry, flaky case or reporter error, 97.9 seconds. Achieved mode remains
**live-two-client** with the same desktop/phone-DM and desktop-player limits described
above. Inspected `r1-repaired-browser-evidence/2-successful-retry.png`: no stale error,
and Built is visible adjacent to its disabled action. Refusal and uncertainty screenshots
now show their inline results; Refresh and inspection controls are reachable together.
The palette remains long, but it no longer hides these U3a results. Functionality 8,
multiplayer 8, craft 8, reach 7.5 gives **7.925 / 10**. No runtime regression was observed
in these four scenarios; independent re-review and the full new ladder are still required.

Evidence prefixes: `u3a-r1-client-red`, `u3a-r1-server-red`,
`u3a-r1-notification-strict-red`, `u3a-r1-visible-outcome-red`,
`u3a-r1-{client,server}-repairs`, `u3a-r1-repair-lifetimes`,
`u3a-r1-completion-cache`, `u3a-r1-repaired-{client,server}-types`,
`u3a-r1-focused-lint`, `u3a-r1-structure`, `u3a-r1-visible-outcomes-green`.

### U3a repaired ladder — E2E baseline race, correction pending verification

The repaired tree passed build, typecheck, lint, structure, formatting, all **9,943
unit tests** (four existing skips), and the **134.39 KB / 175 KB** bundle check.
The full browser run returned **247 PASS / one FAIL / three existing skips**, zero
retries, flaky results or JSON reporter errors. This ladder is **FAIL**. A fresh
30-second isolated dev boot passed; all 79 frozen file hashes and HEAD `42152fd3`
matched after the run. Existing development processes were preserved.

The phone refusal test failed its unchanged-player-map assertion. The only differences
were the compiled scene's timestamp and source revision, **1 → 2**; the DM document
equality assertion passed. The fixture had captured the player's baseline after seeing
the DM's layer-lock document frame, without waiting for that lock's public scene to
reach the player. The lock arrived during the refused-Generate observation. The
correction waits for the player's scene to match the locked document revision before
capturing its baseline. It retains the complete unchanged-map assertion and does not
retry the failed run, extend timeouts, or alter product behavior.

Evidence: `u3a-r1-repaired-gates-report.md`, `u3a-r1-repaired-gate-e2e-report.json`,
and `u3a-r1-repaired-e2e-failure-52/`. Focused browser verification and a fresh full
ladder are required before round 2. No semantic commit or U3b work has started.

### U3a synchronized baseline — full ladder PASS; ready for round 2

The corrected four Generate journeys passed in **97.3 seconds**, with zero failures,
skips, retries, flaky cases or reporter errors. Latest focused screenshots and JSON
are preserved under `baseline-synced-browser-evidence/`. The phone success screenshot
was inspected again: Built is fully visible next to the disabled action, with no stale
refusal toast. This changes the fixture's prerequisite synchronization, not the product
behavior or the previously stated live coverage limits and score.

The fresh eight-gate ladder then passed on the same frozen candidate: build, typecheck,
lint, structure, formatting, **9,943 unit PASS / four existing skips** (all 84 client
batches), **134.39 KB / 175 KB** bundle check, and **248 E2E PASS / three existing
skips**. The E2E report contains 251 tests and 251 attempts: zero failures, retries,
flaky cases or reporter errors. All four U3a cases passed in that complete run.

A fresh development boot on isolated **5176/8789** passed its 30-second window;
existing 5174/8787 processes were preserved and owned test processes cleaned up.
All **79 frozen SHA-256 hashes** matched before and after, with HEAD `42152fd3`
unchanged. Report: `u3a-r1-baseline-synced-gates-report.md`; logs use
`u3a-r1-baseline-synced-gate-*`. This result supersedes the preceding failed gate for
the current candidate; it does not erase that failure. Next: four fresh independent
round-2 reviewers. No semantic commit, remote delivery or U3b work yet.

### U3a independent review round 2 — one confirmed finding

Four fresh pinned-model reviewers completed in static, read-only mode: queue **FAIL**;
transport with named privacy **PASS**; Generate UI/geometry **PASS**; tests with named
documentation honesty **PASS**. `agents_error: 0`; all 79 review-frozen hashes and HEAD
matched afterward. The valid round is **FAIL**, with **one distinct P2 finding**, down
from five in round 1. Reports: `u3a-r2-{queue,transport,ui,evidence}-review.md`.

The queue treated every dropped GET for the refresh document as loss of its own
conflict-refresh request. A second same-document GET can be dropped while the first
remains viable, incorrectly cancelling an unsent successor. This is established at
the exposed controller/transport boundary; the ordinary map panel disables Open while
saving, and no click-only overflow reproduction is claimed. The bounded repair removes
that uncorrelated fast path and relies on the existing independent 12-second deadline
when no document arrives. Authoritative not-found still terminates immediately.

The UI reviewer initially proposed a stale-frame duplicate-generation P1, then retracted
it after tracing ordered WebSocket delivery, synchronous server handlers and the client
stale-socket guard. An artificially reordered pre-generation frame did not establish a
production path. The reviewer recorded that causal correction in its report; no new
protocol fields are justified by that retracted hypothesis.

A new two-GET regression failed before repair: the waiting handle incorrectly settled
as cancelled-before-send; six existing controls passed (`u3a-r2-refresh-red`). Strict
compilation, bounded repair, re-verification and fresh final round 3 remain required.

### U3a round-2 queue repair — focused PASS; final gates pending

The new failing regression passed strict compilation before repair (zero diagnostics
in `u3a-r2-refresh-red-types.json`). The repair removes only the uncorrelated GET-drop
fast path. A not-found response still fails immediately; a truly lost refresh waits
for the independent **12-second deadline**. This supersedes the earlier round-1 claim
of immediate settlement on a GET transport drop. No wire fields or new timer were added.

The two-GET test now proves the successor remains pending after the unrelated drop,
sends when the valid refreshed document arrives, and succeeds exactly once even after
the old deadline would have elapsed. The lost-GET control stays pending at 11,999 ms,
settles at 12,000 ms and cannot revive on late frames. All **199 focused tests across
18 files** passed, including queue lifetime/ownership and Generate transport outcomes.
The actual repaired source/test roots pass strict compilation; formatting and
`git diff --check` pass. Evidence: `u3a-r2-refresh-green`,
`u3a-r2-refresh-green-types.json`. Full eight gates, fresh boot and fresh final review
round 3 are next. The review cap remains three rounds; no semantic commit yet.

### U3a round-2 repair — complete verification PASS

The final candidate passed all eight gates: build, typecheck, lint, structure,
formatting, **9,944 unit tests** (four existing skips; 84 client batches), the
**134.36 KB / 175 KB** bundle check, and **248 browser tests** with three existing
skips. The browser JSON records 251 tests/attempts, zero failures, retries, flaky
results or reporter errors. Fresh isolated development boot on 5176/8789 passed
30 seconds; existing development processes were preserved. All 79 frozen hashes
and HEAD `42152fd3` matched before/after. Report: `u3a-r2-repaired-gates-report.md`.

The full run repeated all four U3a desktop/phone-DM plus desktop-player journeys.
Final artifacts are under `r2-repaired-browser-evidence/`. Inspected the phone
successful-retry and completion-unconfirmed screenshots and its desktop player's
rendered dungeon: success is visible without the previous error; uncertainty shows
Refresh and disabled inspection together; the player sees the delivered scene.
Achieved evaluation remains **live-two-client**, score **7.925 / 10**, with the same
physical-device/WebKit/phone-player/U3a-specific landscape and tablet limitations.
No new runtime regression was observed. Fresh final independent round 3 is next.

### U3a final review round 3 — owner checkpoint required

All four fresh reviewers completed in static, read-only mode. Queue/lifecycle,
transport with named privacy, and tests with named documentation honesty returned
**PASS**. Generate UI/state returned **FAIL**, with one P2 recovery finding.
`agents_error: 0`; all **79 review-frozen hashes** and HEAD `42152fd3` remained
unchanged. Reports: `u3a-r3-{queue,transport,ui,evidence}-review.md`.

The finding is narrower than the retracted round-2 hypothesis. An ordinary broadcast
that already includes the generation is a usable document to inspect. The harmful
path is **outbound delay while inbound messages still arrive**: Generate's writes
remain in transit beyond retry exhaustion; the user requests Refresh; another DM's
edit broadcasts a document that still predates that generation. The controller
treats this broadcast as completion of the pending GET and enables inspection.
The user can then send a fresh Generate ID. When outbound traffic resumes in order,
both distinct generations can apply. No WebSocket frame reordering or later received
ACK is needed. This is a source-supported interleaving, **not yet a reproduced live
network fault**. The green browser suite does not cover it.

Round findings were **5 → 1 → 1**. This is both the three-round cap and a plateau.
The review-convergence instruction requires stopping and reporting to the owner;
there is no round 4 or unanimous final PASS. Cost recorded here: **12 completed
reviewer assignments across three rounds**, plus four complete semantic verification
ladders and the focused regression runs documented above. No token-cost estimate is
available. Every required lens ran; none is missing.

**Bounded repair proposal for owner approval:**

1. Add a failing two-DM transport regression with FIFO-buffered outgoing Generate and
   GET traffic but live incoming document broadcasts. Prove the stale broadcast
   cannot unlock inspection or cause a fresh Generate, including after the loading
   watchdog releases the generic busy state.
2. Give the recovery GET explicit request correlation, echoed on its document/error
   reply. Gate inspection on that matching receipt, not document object identity,
   generic loading or an edit's applied-command ID. Preserve legacy callers and
   keep ordinary broadcasts updating the document without satisfying recovery.
   Existing GETs identify only the document; this is the concrete protocol gap
   anticipated by the U3a escalation clause. A no-applied-command-ID filter alone
   would not distinguish an earlier same-document GET from this recovery request.
3. Cover matching success/error, deadline, superseding refresh, document switch and
   late replies, then repeat focused/strict checks, the complete house ladder and
   desktop/phone two-client recovery evidence. Record this as an owner-authorized
   post-cap repair, not a fourth formal convergence round.
4. Only after verified repair and owner acceptance, locally commit IA-18 and complete
   the planned U3a checkpoint. U3b and destination relocation remain unstarted;
   remote push, main merge and deployment remain unauthorized.

Current trusted commits remain U2 `7923c3de`, auth prerequisite `845d078c`, and U3a
extraction `42152fd3`. The implemented semantic U3a changes are deliberately left
uncommitted pending this checkpoint. The full latest gates remain green, but U3a
does **not** have final review acceptance.

### Owner-reported hallway keyboard history — local fix, 2026-09-24

Trusted local commit **`4e63230d`** fixes a separately reported Ctrl+Z failure.
A real two-client reproduction showed that leaving Chat open blocked map Undo
even after drawing a hallway on the uncovered canvas. The owner's exact original
window setup was not confirmed. Canvas interaction now focuses the map; only
explicitly opted-in desktop floating panels allow that focused map's Undo/Redo.
Native editing, dialogs, popovers, mobile panels and composition remain protected.

Scoped hotkey review counts were **1 → 0**, across two rounds and four independent
static reviewers, `agents_error: 0`. Round one caught retained map focus allowing
history beneath covering mobile panels. Eight real-component regressions failed
before repair; explicit desktop-only opt-in fixed them. Both fresh round-two
reviewers returned PASS, with 82 frozen hashes unchanged before and after review.
This was a separate hotkey review, not a fourth U3a round or acceptance of U3a.

Final evidence: **395 focused tests passed**, strict actual-source/test checks
passed, both real desktop DM/player hallway journeys passed with Chat open and
closed, and both fresh screenshots were inspected. The full eight gates and an
isolated 30-second dev boot passed after the repair. Browser result: **250 passed,
3 existing skips**, 253 attempts, zero failures/retries/flaky/reporter errors.
All 84 client unit batches passed; captured aggregate unit summaries report
9,957 passes and 4 existing skips. The +3 total increase despite eight new cases
is unresolved in the aggregate logs and is not presented as a unique-test count.
The individual new cases passed in focused testing. Bundle: 134.57 KB / 175 KB.

Details and manual steps: [map-history-hotkeys.md](map-history-hotkeys.md).
Raw records: `output/interface-u3a-execution/hallway-hotkey-r1-gates-report.md`,
`hallway-hotkey-r2-{focus,evidence}-review.md`, and the associated captured logs.
Live mode remains desktop `live-two-client`, score 7.4; no physical mobile keyboard,
native macOS or WebKit claim. The commit contains only this fix and its tests/note,
including only seven focus lines from the otherwise dirty MapBoard file. All 82
working-file hashes still matched after commit. U3a's semantic changes remain
uncommitted, its recovery finding remains paused at the existing owner checkpoint,
and U3b remains unstarted. No remote push, merge or deployment occurred.

### U3a bounded post-cap repair — resumed 2026-09-24

The owner requested continuation from the remaining U3a repair/checkpoint into U3b.
This authorizes the recorded bounded repair; it does not assert acceptance of an
unverified result. HEAD remains `4e63230d`. Preserved the adopted working tree and
captured its original files/hashes under `output/interface-u3a-execution/postcap-original*`.
The three-round review count remains 5 → 1 → 1, with no fourth formal review.

New actual tests passed strict compilation before implementation. The FIFO outbound
fault is now reproduced live in desktop and phone Chromium with two authenticated
DMs and an observing player: both browser cases failed because an incoming DM2 layer
edit enabled inspection while all DM1 Generate/GET frames remained buffered. There
were two failed attempts, no retries, flaky results or reporter errors. This strengthens
the previously static finding; it does not claim physical-device or WebKit coverage.
Three client regressions failed for command broadcast, earlier GET, and post-watchdog
uncorrelated frames. Six request-lifetime tests failed because no receipt identity was
sent. Server tests produced seven failures (missing success/error echo and malformed
identity acceptance), with three legacy/privacy controls passing. Reports use
`postcap-*-red*`; browser screenshots were copied to `postcap-browser-red-evidence/`.

The bounded fix adds an optional GET request ID and a private matching reply echo,
independent client receipt settlement/deadline, and receipt-driven Generate recovery.
Initial focused results: 215 client passes/one failure in the old unqualified-GET
fixture, and 50 server passes. The old fixture is strengthened to reject an unrelated
frame before accepting the matching receipt. Full verification remains pending.

After that fixture update, **686 client tests / 76 files** pass, including all map
controller, Generate, and mobile-panel tests. The final actual source/test roots
pass strict compilation in client and server; structure and diff whitespace checks
pass. All **six desktop/phone browser journeys pass in 2.8 minutes**, with no failed
attempts, skips, retries, flaky results or reporter errors. The new FIFO cases verify
that stale broadcasts and a missing receipt cannot unlock inspection, a fresh GET
can recover after the deadline, only one generation applies, and the player receives
the public dungeon without a private document. Existing refusal/retry and lost-reply
journeys remain passing. The full eight gates and fresh boot are next.

### Post-cap verification complete — owner acceptance pending

The report-only gates runner completed the prescribed eight gates and isolated
fresh boot. Root independently checked the E2E JSON, boot report and snapshot hashes.
All **91 frozen paths** and HEAD `4e63230d` matched through verification. Source and
tests did not change afterward; the following checkpoint documents were updated
after the freeze ended.

- Build, typecheck, lint, structure, format, full units, bundle and full E2E: **PASS**.
- Units: shared **452**, server **2,738**, client **6,791**, total **9,981 passes**;
  **4 existing client skips**, all 84 client batches completed. These are actual
  batch aggregates, not deduplicated per-file totals.
- Bundle: **135.13 KB / 175 KB**, leaving **39.87 KB**.
- Full Playwright: **252 passed / 3 existing skips**, **255 attempts** in 22.3
  minutes; **zero failed attempts, retries, flaky cases, attempt errors or reporter
  errors**. Existing skips remain camera reset, grid visibility and DM-mode toggle.
- Fresh development boot: isolated **5176/8789**, server/page/module ready, 30-second
  survival, no error markers, owned processes cleaned up. Existing **5174/8787**
  services were preserved.

The six focused Generate journeys achieved automated **live-two-client Chromium**
(two DMs plus a player in the FIFO/rejection cases), DM desktop 1440×900 and phone
375×812 with touch emulation, observing player desktop 1440×900. The original final
finding is now live reproduced and repaired. Root inspected saved desktop/phone
uncertainty, refusal/retry, matching-receipt and player-result screenshots. Score
**7.925/10**: functionality 8, multiplayer integrity 8, craft 8, reach 7.5. No new
runtime regression was observed in those journeys. Physical devices, WebKit, native
Mac, phone-player and U3a-specific landscape/tablet coverage remain unverified.

Evidence under `output/interface-u3a-execution/`: `postcap-gates-report.md`, its
linked raw logs/exit records, `postcap-gate-e2e-report.json`, `postcap-devboot-report.json`,
`postcap-gate-freeze.json`, `postcap-live-evaluation.md`, and `postcap-browser-evidence/`.
The [durable checkpoint](interface-clarity-u3a-checkpoint.md) collects the U1/U2/IA-03/04
history, IA-18 repair, current extraction headroom and proposed destination names.

**Historical count correction:** the previously reported hotkey R1 aggregate of
9,957 omitted a real five-test summary at line 568 of
`hallway-hotkey-r1-gate-test.log`: `apps/client test: ·      Tests  5 passed (5)`.
The earlier anchored parser missed the progress dot. Reading all 84 summaries gives
client 6,782, server 2,728, shared 452: **9,962 passes / 4 skips**. The eight-case
increase from 9,954 is resolved, and today's 19 new unit cases yield 9,981. Original
reports and their reported counts are retained; the explicit reconciliation is in
`postcap-unit-count-reconciliation.json` and the hotkey verification note.

Formal U3a review remains **5 → 1 → 1**, three capped rounds, 12 completed assignments,
zero agent errors. No fourth review or unanimous final PASS is claimed. The owner
requested the bounded repair; acceptance of this verified result is pending under
handoff step 5. No semantic commit, staging, U3b implementation, remote push, main
merge or deployment has occurred. After acceptance, commit only the inspected U3a
scope, record the owner's destination choices and local delivery cadence, then
execute U3b. Proposed names remain Table, DM tools, Encounter, Objects, Preferences.

## U3b implementation and focused verification — 2026-09-24

The owner's “acccepted” satisfied the verified U3a checkpoint. Its scoped local
semantic commit is `b473a3dd`; all adopted U3a work was preserved. No fourth U3a
review, remote push, merge or deployment occurred.

U3b characterizes and extracts palette state and active settings before changing
behavior. A shared exhaustive descriptor table now groups Terrain, Structures,
Objects, Lighting and Generate. History, Select/Sample, Layers/Inspect and Done
are separate from scrolling settings. The map name and live relationship are
visible. Decoration is contextual to Room/Hallway and names/outlines the last
placed region. Readiness also checks actual drafts, loading and locked layers;
retained actions read the current target and document. Quick-wheel/favorites/
recents and the phone close-to-aim policy retain their original paths.

Evidence under `output/interface-u3a-execution/`: baseline characterization 22/4
PASS before extraction; extraction 41/5 PASS with strict actual roots. Eight
new grouped-palette cases and two target-validity cases failed behaviorally with
strict-clean roots before repair. A retained-action regression failed after its
initial document-swap setup was corrected to actually open the second document.
Unsupported RTL matcher options, missing new typed fixture fields, the initial
unsolicited document message and an incorrect pnpm project filter were setup
failures, not behavioral RED. Final focused client run so far: 531/64 PASS;
43 actual changed client roots strict PASS. Six existing desktop/phone Generate
journeys PASS (no retries). U3b's first four browser cases: phone journey and
portrait/landscape fit PASS; short-desktop aiming setup hit the expanded Entities
panel, and the tablet inspector genuinely left only 447px of aimable map against
the established 560px minimum. The latter has a bounded tablet height repair;
the desktop fixture now closes Entities through its real control. A repeat is
running. The new browser roots compile strictly after a discriminated-union guard
fix. Full house gates, boot, live evaluation and independent U3b review are still
pending. U4–U10 and proposed destination names remain outside this slice.

U3b pre-gate update: final disclosure/viewport suite 4/4 PASS, strict actual changed
client/E2E roots PASS, final focused mobile/help/disclosure 60/10 PASS. The tablet
now preserves 582.4px of map (560px floor). Two real Layers viewport regressions
failed before the local reveal hook, then passed; desktop Inspect and phone Edit
now open in view. Rapid repeated decoration consumes one target/command and DM
demotion clears private previews in real-hook tests. See interface-clarity-u3b.md
for achieved automated live-two-client mode, score 7.87 and coverage limits.
Full gates and boot begin on a frozen snapshot; U3b remains uncommitted.

### U3b full-suite repair and repeat

First full ladder: seven gates and isolated boot PASS, 10,003 unit passes/four
existing skips, 136.92 KB bundle. Full E2E FAIL: 245 passed/nine failed/three
existing skips; 257 attempts, no retries/flaky cases, 14 attempt error objects,
no JSON reporter errors, two raw step-ID diagnostic lines. All 76 hashes matched.
The old run and attachments remain under u3b-gate-e2e-evidence; no blind retry.

The nine failures are repaired in test navigation/observation: seven missed or
ambiguous selectors; one drag starting on the wider palette border now uses a
measured uncovered path; one player bake wait now shares the existing 30-second
worker budget. It still requires completion, and no renderer fix is claimed.
Actual seven E2E roots strict PASS. Focused **13/13 PASS**, zero failures/skips/
retries/flaky/attempt/reporter errors, 156.2 seconds. Observed post-Undo player
view/worker waits were 9,226ms desktop and 8,215ms phone, both ending idle. Evidence:
u3b-gate-repair-browser-report.json and its decoded evidence directory. Only
E2E test navigation/observation and documentation changed after the first gates.
Fresh full eight gates plus boot now run against u3b-repaired-gate-freeze.json.
Independent U3b review has not begun; U3b stays uncommitted and local only.

### U3b repaired full ladder complete — independent review next

All eight gates plus isolated boot PASS on the repaired snapshot. Units total
10,003 passes/four existing skips; bundle 136.92 KB/175 KB. Full E2E:254 passes,
three existing skips,257 attempts,zero failures/retries/flaky/attempt/reporter
errors or raw step-ID diagnostics,in23.0minutes. All nine prior failures pass.
Root independently reconciled unit summaries and browser JSON and checked all
78 hashes/HEAD b473a3dd. Boot5176/8789 passed readiness/module/30s survival and
owned cleanup;5174/8787 preserved. Evidence:u3b-repaired-gates-report.md,
u3b-repaired-gate-e2e-report.json,decoded u3b-repaired-gate-e2e-evidence/,
u3b-repaired-devboot-report.json. Source/tests stay unchanged; result/status
notes updated after freeze. Fresh four-lens U3b review starts next,cap3 rounds,
allPASS and zero agent errors required. No U3b commit or remote action yet.

### U3b review round 1 — two distinct findings, repair in progress

Four fresh pinned reviewers completed STATIC source/test/saved-evidence review.
UI and interaction each flagged the same phone group-selection P2; privacy/geometry
flagged stale decoration readiness over surviving floor; evidence/documentation
returned PASS. The deduplicated union is **two findings**, with **zero agent errors**.
All 78 frozen file hashes and HEAD `b473a3dd` matched at the end. No reviewer edited
source, tests or docs. Reports: `u3b-r1-{ui,interaction,privacy,evidence}-review.md`.

Group activation already selects a remembered tool, but bypasses the phone tile's
close-to-aim policy. The decoration issue originates in the inherited any-floor
predicate: it does not identify the placed room after Undo or detect a partially
erased footprint. U3b's new named/outlined readiness claim makes it relevant to
this slice. Repair preserves last-placement bounds, using perimeter identity and
floor coverage; it does not add arbitrary-room selection or a second controller.

New actual test roots strictly compile after correcting a missing door fixture
field (setup error, not RED). Before production repair, the bound-controller unit
regressions produce **nine intended failures and four passing controls**: three
phone group-close failures; six target/retained-action failures. The pnpm wrapper
also emits its known recursive-exec text after Vitest's actual assertion summary;
it is not counted as another failed test. Evidence: `u3b-r1-unit-red.log` and
`u3b-r1-regression-types-fixed.json`. Browser reproduction is running. U3b remains
uncommitted; the previous green ladder predates these new tests and repairs.

### U3b R1 repair verification

Both review findings now have behavioral browser RED evidence. The first two-case
run reproduced phone group closure but stopped the decoration leg on a test's
public/private terrain-shape mismatch. That observation was corrected, strictly
compiled, and the decoration-only repeat failed at the intended enabled button
after real Undo and verified surviving player terrain. Reports preserve all three
attempts, no retries; two raw step-ID diagnostics accompanied the second run, with
zero JSON reporter errors. Neither setup mismatch nor diagnostics counts as a
second product defect. Saved attachments are retained in the two RED directories.

The phone group path now applies the same no-settings close rule as tool tiles.
Decoration records required room/hallway perimeter identity with the original grid
and validates every floor cell. The outline, ghosts, enabled state and retained
action share validity; normal repaint, door additions and layer presentation stay
valid. The E2E navigation helper reopens a sheet through the real Tool button when
a remembered no-settings tool closed it. Existing tile-close assertions are now
per-tool, avoiding confusion between group activation and tile activation counts.

Focused map-edit and bound phone suites PASS: **546 tests / 66 files**. The wider
strict root pass found one remaining old layout callback type; corrected by
forwarding the existing alias. Actual strict recheck and focused browser GREEN
are pending; a fresh full ladder, boot and independent R2 follow. No commit yet.

R1 focused browser run: 31 passes, one timeout,32 attempts,zero retries/flaky/
reporter errors/raw step-ID diagnostics,two attempt error objects. Both main
DM/player journeys and Undo-over-painted-floor pass. The new Lighting case passed
sheet closure but timed out; teardown initially obscured its action error. A
separate bounded diagnostic proved the chosen bottom Konva canvas was intercepted
by another canvas. Test input is corrected to assert a map-canvas hit at the point
and use native touchscreen.tap. No production changes were needed. The diagnostic
run and screenshots are preserved; this is not a hidden retry or a second product
finding. Final actual strict check and focused rerun precede fresh full gates.

Lighting follow-up diagnosis: the native viewport tap proceeded, but the test
incorrectly expected one compiled light in the player's scene. A further run
using the established trusted CDP touch helper first proved one light in the
DM's authoritative document, then failed only that player assertion. The existing
server contract (`compiledSceneFor`, roomModel tests) deliberately removes light
geometry from player scenes. The corrected test requires the player's new source
revision, an empty light-geometry list, and no private map-studio-document frame.
This fixes the test oracle; no server/product privacy change is needed. All failed
runs remain retained (`u3b-r1-recovery-final`, `u3b-r1-light-cdp-check`); the latter
has two raw step-ID diagnostics. A missing ServerMessage discrimination guard in
the new assertion was caught by strict compilation and fixed before rerunning.

R1 repairs have focused GREEN evidence: 546/66 unit passes, actual strict roots
pass (final browser root separately rechecked), 31 passing focused browser paths
plus the corrected Lighting case PASS in its one-attempt final run. That final
case takes 7.7 seconds and has zero failure/skip/retry/flaky/attempt/reporter errors.
This is separate-run evidence, not a fabricated 32-case green run. Product source
has not changed since the 31-pass run. All full gates and boot will rerun against
the new freeze before fresh R2. Live mode/score/limits remain recorded in the U3b
verification note. Evidence: u3b-r1-light-final-green-report.json and its decoded
attachments, plus u3b-r1-browser-green-evidence for the other31. No commit yet.

Root's copy audit between R1 and R2 found one additional P3 overclaim: Room help
called blocking walls optional, but the None wall ring omits paint while retaining
the blocking perimeter. Help now says "Drag a room with a floor and perimeter
walls." No behavior changed. This is a root finding, separate from R1's two-issue
union. The r1-repaired gate run stopped after passing build/typecheck/lint; the
remaining five gates and boot did not run. All 84 hashes and HEAD matched before
the correction. That incomplete report remains preserved. The complete ladder
restarts with unique `u3b-r1-final-gate-*` artifacts and a new freeze.

### U3b R1 repairs — full verification PASS, fresh R2 next

The complete final ladder passes all eight gates and isolated boot. Actual unit
summaries total **10,016 passes / four existing skips**: shared452, server2738,
client6826 across all85 batches. Bundle **137.27 KB gzip / 175 KB**. Full E2E:
**256 passes / three existing skips**,259 attempts in23.3minutes,zero failures,
retries,flaky cases,attempt/reporter errors or raw step-ID diagnostics. Both new
R1 regressions and the complete desktop/phone journeys pass in this same run.
Artifacts: `u3b-r1-final-gates-report.md`, `u3b-r1-final-gate-e2e-report.json`,
decoded `u3b-r1-final-gate-e2e-evidence/`, `u3b-r1-final-devboot-report.json`.

Root independently reconciled counts, boot readiness/30-second survival/owned
cleanup and all84 hashes plus HEAD b473a3dd. Existing5174/8787 were preserved.
Final screenshots inspected: desktop target, phone Generate/Inspect, player
after Undo, direct Lighting group and Undo-over-paint. Player bake waits8248ms
desktop/8214msphone ended idle. Actual mode remains automated live-two-client,
Chromium mouse/emulated touch; score7.87 and recorded limits unchanged.

Only result/status documentation is updated after this freeze, including an
IA-06 disposition in the original audit. Fresh R2 will freeze85 files; source and
tests are unchanged. Four new independent pinned static reviewers are next.
R1 union remains2, agents_error0; root copy finding is separately recorded above.
No U3b commit, U4 implementation or remote action yet.

### U3b review round 2 — five findings repaired, full verification next

All four fresh STATIC reviewers completed, agents_error0; root independently
confirmed all85 hashes and HEAD b473a3dd unchanged before releasing the freeze.
The union is five: P2 hidden perimeter omitted by target validity; P3 IA-07
incorrectly left pending in the new audit disposition; P3 inherited Scatter
rotation-row and shortcut overclaims; P3 inherited Room painted-ring overclaim
when None is chosen; P3 new Ambient-light help pointing to unnamed layer-opacity
sliders. UI/interaction duplicated the rotation issue, counted once. Reports:
`u3b-r2-{ui,privacy,evidence,interaction}-review.md`. Formal counts2→5; R3 is final.

New room/hallway tests strictly compile before RED, use real controller updates
and shared updateMapElement/compileScene, then fail readiness/outline/ghost/action
after hiding removes the relevant geometry. Two failures plus eight passing
controls; known pnpm wrapper text is not another test failure. Two browser cases
strictly compile and fail exactly Decorate enabled after real desktop/phone
inspector hiding and verified player wall removal. No setup failures, no retries,
zero reporter errors; two attempt errors and two raw step-ID diagnostic lines
(each repeats its diagnostic). All failed attempts and images remain preserved.

Repair adds only hidden-state comparison to the shared target predicate. Existing
Ambient-light slider labels now match their help, with unchanged opacity commands;
this does not claim U5 relocation/combined Save. Guide/audit copy is corrected.
Actual final80 TypeScript roots pass strict checking; focused548/66 unit PASS;
twelve browser attempts PASS in167.6seconds,zero failures/skips/retries/flaky/
attempt/reporter/raw diagnostic errors. Both hidden-perimeter screenshots were
inspected. Browser mode and score/limits stay unchanged. Evidence prefixes:
`u3b-r2-regression-types`, `u3b-r2-unit-red`, `u3b-r2-browser-red`,
`u3b-r2-repair-types`, `u3b-r2-final-actual-types`, `u3b-r2-focused-green`,
`u3b-r2-browser-green`. Next fresh full8+boot under `u3b-r2-repaired-gate-*`, then
four fresh independent reviewers for final R3. No U3b commit or remote action.

### U3b R2 repairs — full verification PASS, final R3 next

On September 25, `u3b-r2-repaired-gates-report.md` completed all eight gates and
isolated boot PASS on the same 87-file freeze. Gates 1–6 finished September 24;
the mechanical runner then hit its usage limit. The owner's resume was followed
by an independent hash/HEAD audit, then gates 7–8 and boot without repeating the
unchanged passing checks. One recovered mechanical-runner error is disclosed;
it does not void the already completed R1/R2 semantic reviews (agents_error: 0).
R3 had not started during the interruption.

Actual unit summaries: **10,018 passes / four existing skips**, shared 452,
server 2,738, client 6,828 across 85 batch summaries. Bundle **137.29 KB /175 KB**.
Full browser run: **258 passes / three existing skips**, 261 attempts, 23.5 minutes,
zero failures/retries/flaky/attempt/reporter errors and raw step-ID diagnostics.
Root independently reconciled the captured summaries/JSON and all 87 hashes plus
HEAD `b473a3dd`. Fresh 5176/8789 boot passed health/client/module readiness,
30-second survival, empty boot-error list and owned cleanup; 5174/8787 preserved.

Root decoded final screenshots and inspected desktop named target, phone
Generate/Inspect, player after Undo, both hidden-perimeter cases and tablet Select.
The invalid target's gold decoration outline disappears while cyan selection can
remain. Player render settlement was 9,203ms desktop/8,158ms phone, ending idle;
tablet exposed map remained 582.4px. Automated live-two-client mode, score7.87 and
recorded limits remain unchanged. Evidence prefix `u3b-r2-repaired-gate-e2e`, boot
`u3b-r2-repaired-devboot-report.json`, strict `u3b-r2-final-actual-types.json`.
Source/tests are unchanged; result docs are updated before a fresh R3 freeze.
Next: four fresh pinned independent read-only reviewers, final round 3. No U3b
commit, U4 work or remote delivery yet.

### U3b final review round 3 — owner checkpoint required

Four fresh pinned independent STATIC reviewers completed, with zero semantic
agent errors. UI/state and privacy/geometry PASS; evidence/documentation and
interaction FAIL on the same P3 stale audit-status sentence. The IA-06/07
disposition still said R2 repairs were undergoing verification after its ladder
and boot had passed. This is one distinct documentation finding; no additional
product defect was found. Root read all four complete reports and independently
confirmed all 87 frozen hashes and HEAD `b473a3dd` before releasing the freeze.
Reports: `u3b-r3-{ui,privacy,evidence,interaction}-review.md`.

Formal counts **2 → 5 → 1**, three rounds, **12 completed reviewer assignments**,
`agents_error: 0`. The mechanical runner's recovered usage error remains separately
disclosed above. The final round is not unanimous PASS. The count decreased, but
the [review-convergence cap](../../.claude/skills/review-convergence/SKILL.md) is
reached: “Cap the rounds at 3. Round 4 is escalation to the owner, not another loop.”
No fourth review will run.

After review, root corrected only the flagged audit sentence and updated result/
frontier documentation. Source/tests remain unchanged from full verification.
The audit now reports the completed gates/boot and the pending owner checkpoint.
This bounded documentation correction is not represented as a fresh formal PASS.
The concrete [U3b checkpoint](interface-clarity-u3b.md) asks the owner to accept the
verified result and its scoped 87-path local commit. Existing working tree remains
preserved, with nothing staged or committed for U3b. No push/merge/deployment/U4.

### U3b owner acceptance and local closeout — 2026-09-25

The owner explicitly answered **“Accept and commit locally”** to the verified
checkpoint, including the corrected audit-status sentence. This satisfies the
U3b cap checkpoint. The scoped 87-path local commit containing this entry follows
accepted U3a `b473a3dd`; final result/acceptance docs are the only changes after
the reviewed freeze. Source/tests remain identical to the green full-gate and
R3 snapshots. The two PASS/two FAIL final verdicts, one duplicate P3 and formal
counts 2 → 5 → 1 remain the honest historical record; no fourth review ran.

U3b groups existing build tools, preserves persistent controls and phone input
behavior, and names/validates the last decoration target. The working tree and
earlier local commits were preserved. All eight gates and isolated boot passed,
10,018 unit passes/four existing skips, 258 browser passes/three existing skips,
137.29 KB gzip. Verification mode and limitations remain in the U3b record.
This completes the requested continuation through U3b. U4a is the next slice;
no U4 implementation, remote push, merge or deployment was performed.
