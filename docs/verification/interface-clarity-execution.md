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
  The generated-name collision is under verification; U2's fresh inventory is in progress.
- U2–U10 are not implemented. The checkpoint after U3a remains in force.
- The September 22 audit is historical evidence; new acceptance results are recorded here.
- U2 history follow-up, reproduced through the live UI: after the player draws and the DM
  confirms Clear All, both snapshots contain no drawings but the player's Undo stays
  enabled. This predates IA-03. Fix history feedback without confusing an ordinary Undo
  to an empty map (where Redo must remain possible) with a table-wide clear.

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
